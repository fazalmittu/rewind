import { ClassificationResult, KnownScreen } from "./types";
import { callLLMWithTwoImages, sanitizeJSON } from "./llm";

/**
 * Unified classification: determines if a click is significant,
 * identifies the screen, and describes the action - all in one GPT call.
 */
export async function classifyInteraction(params: {
  previousScreenshotPath: string | null;
  currentScreenshotPath: string;
  previousUrl: string | null;
  currentUrl: string;
  previousScreenId: string | null;
  previousScreenLabel: string | null;
  knownScreens: KnownScreen[];
  clickX?: number;
  clickY?: number;
}): Promise<ClassificationResult> {
  const {
    previousScreenshotPath,
    currentScreenshotPath,
    previousUrl,
    currentUrl,
    previousScreenId,
    previousScreenLabel,
    knownScreens,
    clickX,
    clickY,
  } = params;

  // Build the known screens context
  const knownScreensContext = knownScreens.length > 0
    ? knownScreens.map((s, i) => 
        `${i + 1}. ID: "${s.id}", Label: "${s.label}", URL pattern: "${s.urlPattern}"`
      ).join("\n")
    : "No screens have been identified yet in this session.";

  // Build previous state context
  const previousContext = previousScreenshotPath
    ? `## Previous State (BEFORE the click)
Screenshot: [Image 1 - attached]
URL: ${previousUrl || "unknown"}
Screen: "${previousScreenLabel || "unknown"}" (ID: ${previousScreenId || "none"})`
    : `## Previous State
This is the FIRST interaction in the session. No previous screenshot.`;

  const prompt = `You are analyzing a user interaction in a web application recording session.

${previousContext}

## Current State (AFTER the click)
Screenshot: [Image 2 - attached]
URL: ${currentUrl}
Click position: ${clickX !== undefined && clickY !== undefined ? `(${clickX}, ${clickY})` : "unknown"}

## Known Screens in this session
${knownScreensContext}

## Your Task
Analyze this click interaction and determine:

1. **SIGNIFICANCE**: Did this click cause any meaningful change? Consider:
   - Page navigation (URL changed, new page loaded)
   - Modal, dialog, dropdown, or menu opened/closed
   - Content area updated (list filtered, data loaded)
   - Form field focused or modified
   - Tab or section switched
   - NO-OP: Click on empty space, disabled element, or no visible change

2. **SCREEN IDENTIFICATION** (only if significant): What screen is shown in the CURRENT screenshot?
   - If it matches a known screen (same page, just different data), provide the screen ID
   - If it's a NEW screen not seen before, provide a label and description
   - Use URL patterns as a strong hint: same URL path = likely same screen

3. **ACTION DESCRIPTION** (only if significant): What action did the user perform?
   - Be specific: "Clicked the 'Save' button" not just "Clicked button"
   - Describe the outcome if visible: "Opened the settings menu"

## Response Format (JSON only, no markdown)
If the click is NOT significant:
{
  "significant": false,
  "reason": "Brief explanation why (e.g., 'Click on empty area, no UI change detected')"
}

If the click IS significant and matches a KNOWN screen:
{
  "significant": true,
  "screen": {
    "isNew": false,
    "matchedScreenId": "scr_xxxxx"
  },
  "action": "Description of what the user did and what changed"
}

If the click IS significant and shows a NEW screen:
{
  "significant": true,
  "screen": {
    "isNew": true,
    "label": "Short Screen Name (2-4 words)",
    "description": "One sentence describing this screen's purpose"
  },
  "action": "Description of what the user did and what changed"
}`;

  try {
    const response = await callLLMWithTwoImages(
      prompt,
      previousScreenshotPath,
      currentScreenshotPath
    );

    const result = sanitizeJSON<ClassificationResult>(response);
    
    // Validate the response structure
    if (typeof result.significant !== "boolean") {
      throw new Error("Invalid response: missing 'significant' field");
    }

    if (result.significant) {
      if (!result.screen) {
        throw new Error("Invalid response: significant but missing 'screen' field");
      }
      if (!result.action) {
        throw new Error("Invalid response: significant but missing 'action' field");
      }
    }

    return result;
  } catch (error) {
    console.error("[Classifier] Error classifying interaction:", error);
    // On error, assume significant to avoid losing data
    return {
      significant: true,
      screen: {
        isNew: true,
        label: "Unknown Screen",
        description: "Classification failed, screen unknown",
      },
      action: "User interaction (classification failed)",
    };
  }
}

/**
 * Extract URL path pattern from a full URL.
 * Removes query params and normalizes.
 */
export function extractUrlPattern(url: string): string {
  try {
    const parsed = new URL(url);
    // Keep path, remove query params and hash
    return parsed.pathname;
  } catch {
    // If URL parsing fails, return as-is
    return url;
  }
}

