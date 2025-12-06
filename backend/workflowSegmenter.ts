import { getSessionEvents } from "./db";
import { RawWorkflow, WorkflowStep } from "./types";

/**
 * Segment a session's events into distinct workflows.
 *
 * Rules:
 * - Base screens are the top 2 most frequent screen labels
 * - Workflow starts when leaving a base screen
 * - Workflow ends when returning to a base screen OR when a loop is detected
 */
export async function segmentWorkflows(
  sessionId: string
): Promise<RawWorkflow[]> {
  const events = await getSessionEvents(sessionId);

  if (events.length <= 1) {
    return [];
  }

  // Count frequency of each screen label
  const labels = events.map((e) => e.screenSummary);
  const freq: Record<string, number> = {};
  labels.forEach((l) => {
    freq[l] = (freq[l] || 0) + 1;
  });

  // Get top 2 most frequent labels as base screens
  // A screen qualifies as "base" if it appears significantly more than others
  const sortedScreens = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  
  // Take the most frequent screen as primary base
  const baseScreens: string[] = [];
  if (sortedScreens.length > 0) {
    const [topScreen, topCount] = sortedScreens[0];
    baseScreens.push(topScreen);
    
    // Add second screen only if it appears at least half as often as the top
    // and appears more than once
    if (sortedScreens.length > 1) {
      const [secondScreen, secondCount] = sortedScreens[1];
      if (secondCount >= topCount / 2 && secondCount > 1) {
        baseScreens.push(secondScreen);
      }
    }
  }

  const isBase = (label: string) => baseScreens.includes(label);

  const workflows: RawWorkflow[] = [];
  let steps: WorkflowStep[] = [];
  let active = false;
  let seenInWorkflow: Set<string> = new Set();

  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const cur = events[i];
    const prevIsBase = isBase(prev.screenSummary);
    const curIsBase = isBase(cur.screenSummary);

    // Leaving base screen - start a new workflow
    if (prevIsBase && !curIsBase) {
      steps = [];
      seenInWorkflow = new Set();
      active = true;
    }

    // If we're in an active workflow
    if (active) {
      // Check for loop BEFORE adding the current step
      const loopDetected = seenInWorkflow.has(cur.screenSummary);

      // Check if we're returning to base
      const returnedToBase = !prevIsBase && curIsBase;

      if (returnedToBase || loopDetected) {
        // If loop detected, include the repeated screen in the workflow
        if (loopDetected && !curIsBase) {
          steps.push({
            screen: cur.screenSummary,
            action: cur.actionSummary,
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
          screen: cur.screenSummary,
          action: cur.actionSummary,
        });
        seenInWorkflow.add(cur.screenSummary);
      }
    }
  }

  // If we ended while still in an active workflow, save it
  if (active && steps.length > 0) {
    workflows.push({ steps: [...steps] });
  }

  return workflows;
}
