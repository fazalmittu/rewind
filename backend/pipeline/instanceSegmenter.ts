import { CapturedEvent, DetectedInstance, SegmentationResult, CanonicalScreen } from "../types";
import { callLLMText, sanitizeJSON } from "../llm";

/**
 * Segment a sequence of events into distinct workflow instances
 * Uses GPT to identify goal-based groupings
 */
export async function segmentInstances(
  events: CapturedEvent[],
  screens: CanonicalScreen[]
): Promise<SegmentationResult> {
  if (events.length === 0) {
    return { instances: [] };
  }

  if (events.length === 1) {
    // Single event = single instance
    return {
      instances: [{
        goal: "Single action",
        startEventIndex: 0,
        endEventIndex: 0,
        succeeded: true,
        events: [events[0]],
      }],
    };
  }

  // Build screen lookup
  const screenLookup = new Map(screens.map(s => [s.id, s]));

  // Prepare event summaries for GPT
  const eventSummaries = events.map((event, idx) => {
    const screen = event.screenId ? screenLookup.get(event.screenId) : null;
    return {
      index: idx,
      screenType: screen?.label || "Unknown",
      eventType: event.eventType,
      action: event.actionSummary || event.targetText?.slice(0, 50) || "",
      inputValue: event.inputValue || null,
      inputName: event.inputLabel || event.inputName || null,
    };
  });

  const prompt = `You are analyzing a sequence of user actions to identify distinct WORKFLOW INSTANCES.

A workflow instance is a complete attempt to accomplish a single goal (e.g., "search for a product and add to cart").

Events in this session:
${JSON.stringify(eventSummaries, null, 2)}

Your task:
1. Group these events into distinct workflow instances
2. Each instance should have:
   - A clear GOAL (what the user was trying to do)
   - A start event and end event
   - Whether it succeeded (completed the goal)
3. Events can only belong to ONE instance
4. Look for patterns like:
   - Search → Browse results → View item → Add to cart (shopping workflow)
   - Fill form → Submit (form workflow)
   - Navigate → Read → Navigate back (browsing workflow)

Return JSON (no markdown):
{
  "instances": [
    {
      "goal": "Search for iPad and add to cart",
      "startEventIndex": 0,
      "endEventIndex": 4,
      "succeeded": true
    },
    {
      "goal": "Search for Christmas tree and browse",
      "startEventIndex": 5,
      "endEventIndex": 8,
      "succeeded": true
    }
  ]
}

Rules:
- Cover ALL events (no gaps)
- Instances should not overlap
- Use meaningful goal descriptions
- If unsure, group related screens together`;

  try {
    const response = await callLLMText(prompt);
    const result = sanitizeJSON<{
      instances: Array<{
        goal: string;
        startEventIndex: number;
        endEventIndex: number;
        succeeded: boolean;
      }>;
    }>(response);

    // Validate and build instances
    const instances: DetectedInstance[] = [];
    
    for (const inst of result.instances) {
      // Clamp indices to valid range
      const start = Math.max(0, Math.min(inst.startEventIndex, events.length - 1));
      const end = Math.max(start, Math.min(inst.endEventIndex, events.length - 1));
      
      instances.push({
        goal: inst.goal,
        startEventIndex: start,
        endEventIndex: end,
        succeeded: inst.succeeded,
        events: events.slice(start, end + 1),
      });
    }

    // Sort by start index
    instances.sort((a, b) => a.startEventIndex - b.startEventIndex);

    console.log(`[Segmenter] Detected ${instances.length} workflow instances from ${events.length} events`);
    
    return { instances };
  } catch (error) {
    console.error("[Segmenter] Error:", error);
    
    // Fallback: treat entire session as one instance
    return {
      instances: [{
        goal: "Browsing session",
        startEventIndex: 0,
        endEventIndex: events.length - 1,
        succeeded: true,
        events: [...events],
      }],
    };
  }
}

