import { CapturedEvent, CanonicalScreen, CanonicalizeResult } from "../types";
import { callLLMText, sanitizeJSON } from "../llm";
import crypto from "crypto";

/**
 * Extract URL pattern from a full URL
 * e.g., "https://amazon.com/dp/B09V3KXJPB" -> "/dp/*"
 */
function extractUrlPattern(url: string): string {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    
    // Replace likely dynamic segments with wildcards
    const patternParts = pathParts.map((part) => {
      // Long alphanumeric strings are likely IDs
      if (/^[A-Za-z0-9]{8,}$/.test(part)) return "*";
      // UUIDs
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)) return "*";
      // Numbers
      if (/^\d+$/.test(part)) return "*";
      return part;
    });
    
    return "/" + patternParts.join("/");
  } catch {
    return url;
  }
}

/**
 * Group events by URL pattern for initial clustering
 */
function groupByUrlPattern(events: CapturedEvent[]): Map<string, CapturedEvent[]> {
  const groups = new Map<string, CapturedEvent[]>();
  
  for (const event of events) {
    const pattern = extractUrlPattern(event.url);
    const existing = groups.get(pattern) || [];
    existing.push(event);
    groups.set(pattern, existing);
  }
  
  return groups;
}

/**
 * Canonicalize screens across all events
 * Groups similar screens and assigns canonical IDs
 */
export async function canonicalizeScreens(
  events: CapturedEvent[]
): Promise<CanonicalizeResult> {
  if (events.length === 0) {
    return { screens: [], eventScreenMappings: new Map() };
  }

  // Group events by URL pattern first (cheap clustering)
  const urlGroups = groupByUrlPattern(events);
  
  // Prepare data for GPT
  const groupsForGPT = Array.from(urlGroups.entries()).map(([pattern, evts], idx) => ({
    groupId: idx,
    urlPattern: pattern,
    sampleUrls: [...new Set(evts.slice(0, 3).map(e => e.url))],
    eventCount: evts.length,
    sampleActions: evts.slice(0, 3).map(e => e.actionSummary || e.targetText?.slice(0, 50) || ""),
  }));

  const prompt = `You are analyzing screen types from a web browsing session.

Given these URL pattern groups:
${JSON.stringify(groupsForGPT, null, 2)}

Your task:
1. Identify the logical SCREEN TYPE for each group
2. Groups with similar purposes should have the SAME canonical label
3. Use GENERIC names (e.g., "Product Detail Page" not "iPad Detail Page")
4. Consider URL patterns as strong hints:
   - /dp/* or /product/* → Product Detail Page
   - /cart/* → Shopping Cart
   - /search or /s?k=* → Search Results
   - /checkout/* → Checkout Page

Return JSON (no markdown):
{
  "screenTypes": [
    {
      "groupIds": [0, 2],
      "canonicalLabel": "Product Detail Page",
      "description": "Page showing details of a single product"
    },
    {
      "groupIds": [1],
      "canonicalLabel": "Shopping Cart",
      "description": "Page showing items in the shopping cart"
    }
  ]
}`;

  try {
    const response = await callLLMText(prompt);
    const result = sanitizeJSON<{
      screenTypes: Array<{
        groupIds: number[];
        canonicalLabel: string;
        description: string;
      }>;
    }>(response);

    // Build canonical screens and mappings
    const screens: CanonicalScreen[] = [];
    const eventScreenMappings = new Map<number, string>();
    const groupIdToScreenId = new Map<number, string>();

    // Create canonical screens
    for (const screenType of result.screenTypes) {
      const screenId = `scr_${crypto.randomUUID().slice(0, 8)}`;
      
      // Collect URL patterns from all groups in this screen type
      const urlPatterns: string[] = [];
      let exampleScreenshotPath = "";
      
      for (const groupId of screenType.groupIds) {
        const entry = groupsForGPT[groupId];
        if (entry) {
          urlPatterns.push(entry.urlPattern);
          // Use first event's screenshot as example
          const groupEvents = urlGroups.get(entry.urlPattern);
          if (groupEvents && groupEvents[0] && !exampleScreenshotPath) {
            exampleScreenshotPath = groupEvents[0].screenshotPath;
          }
        }
        groupIdToScreenId.set(groupId, screenId);
      }

      screens.push({
        id: screenId,
        label: screenType.canonicalLabel,
        description: screenType.description,
        urlPatterns: [...new Set(urlPatterns)],
        exampleScreenshotPath,
      });
    }

    // Map events to screen IDs
    events.forEach((event, eventIndex) => {
      const pattern = extractUrlPattern(event.url);
      const groupId = groupsForGPT.findIndex(g => g.urlPattern === pattern);
      const screenId = groupIdToScreenId.get(groupId);
      if (screenId) {
        eventScreenMappings.set(eventIndex, screenId);
        event.screenId = screenId;
      }
    });

    console.log(`[Canonicalizer] Created ${screens.length} canonical screens from ${urlGroups.size} URL patterns`);
    
    return { screens, eventScreenMappings };
  } catch (error) {
    console.error("[Canonicalizer] Error:", error);
    
    // Fallback: create one screen per URL pattern
    const screens: CanonicalScreen[] = [];
    const eventScreenMappings = new Map<number, string>();
    
    let groupIdx = 0;
    for (const [pattern, evts] of urlGroups) {
      const screenId = `scr_${crypto.randomUUID().slice(0, 8)}`;
      screens.push({
        id: screenId,
        label: `Screen ${groupIdx + 1}`,
        description: `Screen at ${pattern}`,
        urlPatterns: [pattern],
        exampleScreenshotPath: evts[0]?.screenshotPath || "",
      });
      
      // Map all events in this group
      events.forEach((event, idx) => {
        if (extractUrlPattern(event.url) === pattern) {
          eventScreenMappings.set(idx, screenId);
          event.screenId = screenId;
        }
      });
      
      groupIdx++;
    }
    
    return { screens, eventScreenMappings };
  }
}

