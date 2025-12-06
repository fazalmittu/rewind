import { getSessionEvents } from "./db";
import { RawWorkflow, WorkflowStep, SessionState, SessionEvent, KnownScreen } from "./types";

/**
 * Segment a session's events into distinct workflows.
 * 
 * Can work from:
 * 1. In-memory session state (during finalization)
 * 2. Database events (for re-processing)
 *
 * Rules:
 * - Base screens are the top 2 most frequent screen IDs
 * - Workflow starts when leaving a base screen
 * - Workflow ends when returning to a base screen OR when a loop is detected
 */
export async function segmentWorkflows(
  sessionId: string,
  sessionState?: SessionState
): Promise<RawWorkflow[]> {
  // Get events either from session state or database
  let events: Array<{
    screenId: string;
    actionSummary: string;
    screenshotPath: string;
  }>;
  let screenLookup: Map<string, string>; // screenId -> label

  if (sessionState) {
    // Use in-memory session state
    events = sessionState.events.map((e) => ({
      screenId: e.screenId,
      actionSummary: e.actionSummary,
      screenshotPath: e.screenshotPath,
    }));
    screenLookup = new Map(
      sessionState.knownScreens.map((s) => [s.id, s.label])
    );
  } else {
    // Fallback to database
    const dbEvents = await getSessionEvents(sessionId);
    events = dbEvents.map((e) => ({
      screenId: e.screenId || "",
      actionSummary: e.actionSummary,
      screenshotPath: e.screenshotPath,
    }));
    // For DB events, we'd need to look up screen labels separately
    // For now, use screenId as label if no lookup available
    screenLookup = new Map();
  }

  if (events.length <= 1) {
    return [];
  }

  // Count frequency of each screen ID
  const freq: Record<string, number> = {};
  events.forEach((e) => {
    freq[e.screenId] = (freq[e.screenId] || 0) + 1;
  });

  // Get top 2 most frequent screen IDs as base screens
  const sortedScreens = Object.entries(freq).sort((a, b) => b[1] - a[1]);

  const baseScreenIds: string[] = [];
  if (sortedScreens.length > 0) {
    const [topScreenId, topCount] = sortedScreens[0];
    baseScreenIds.push(topScreenId);

    if (sortedScreens.length > 1) {
      const [secondScreenId, secondCount] = sortedScreens[1];
      if (secondCount >= topCount / 2 && secondCount > 1) {
        baseScreenIds.push(secondScreenId);
      }
    }
  }

  const isBase = (screenId: string) => baseScreenIds.includes(screenId);
  const getScreenLabel = (screenId: string) => screenLookup.get(screenId) || screenId;

  const workflows: RawWorkflow[] = [];
  let steps: WorkflowStep[] = [];
  let active = false;
  let seenInWorkflow: Set<string> = new Set();

  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const cur = events[i];
    const prevIsBase = isBase(prev.screenId);
    const curIsBase = isBase(cur.screenId);

    // Leaving base screen - start a new workflow
    if (prevIsBase && !curIsBase) {
      steps = [];
      seenInWorkflow = new Set();
      active = true;
    }

    // If we're in an active workflow
    if (active) {
      // Check for loop BEFORE adding the current step
      const loopDetected = seenInWorkflow.has(cur.screenId);

      // Check if we're returning to base
      const returnedToBase = !prevIsBase && curIsBase;

      if (returnedToBase || loopDetected) {
        // If loop detected, include the repeated screen in the workflow
        if (loopDetected && !curIsBase) {
          steps.push({
            screenId: cur.screenId,
            screenLabel: getScreenLabel(cur.screenId),
            action: cur.actionSummary,
            screenshotPath: cur.screenshotPath,
          });
        }

        // End the workflow (don't include the base screen we returned to)
        if (steps.length > 0) {
          workflows.push({ steps: [...steps] });
        }
        steps = [];
        seenInWorkflow = new Set();
        active = false;
      } else {
        // Add current step to workflow
        steps.push({
          screenId: cur.screenId,
          screenLabel: getScreenLabel(cur.screenId),
          action: cur.actionSummary,
          screenshotPath: cur.screenshotPath,
        });
        seenInWorkflow.add(cur.screenId);
      }
    }
  }

  // If we ended while still in an active workflow, save it
  if (active && steps.length > 0) {
    workflows.push({ steps: [...steps] });
  }

  return workflows;
}
