import { RawWorkflow, RefinedWorkflow } from "./types";
import { callLLMText, sanitizeJSON } from "./llm";

/**
 * Refine raw workflows using GPT.
 *
 * GPT will:
 * - Assign clear names (2-5 words)
 * - Assign descriptions (1-2 sentences)
 * - Merge duplicate workflows if they represent the same task
 * - Maintain step order within each workflow
 * 
 * Note: Steps now include screenId for reliable identification,
 * but we pass screenLabel to GPT for human-readable context.
 */
export async function refineWorkflows(
  raw: RawWorkflow[]
): Promise<RefinedWorkflow[]> {
  if (raw.length === 0) {
    return [];
  }

  // Prepare workflows for GPT (use screenLabel for readability)
  const workflowsForGPT = raw.map((w) => ({
    steps: w.steps.map((s) => ({
      screen: s.screenLabel,
      action: s.action,
    })),
  }));

  const prompt = `You are analyzing user workflows extracted from a web application recording.

Your job:
- Assign each workflow a clear name (2–5 words).
- Assign each workflow a 1–2 sentence description.
- If multiple workflows represent the same task (same screens, similar actions), merge them into one.
- Maintain the same order of steps within each workflow.
- Do not delete steps.
- Do not add steps.

Workflows (JSON):
${JSON.stringify(workflowsForGPT, null, 2)}

Return JSON ONLY in this format (no markdown, no explanation):
[
  {
    "name": "...",
    "description": "...",
    "steps": [{ "screen": "...", "action": "..." }, ...]
  }
]`;

  const response = await callLLMText(prompt);
  const refined = sanitizeJSON<Array<{ name: string; description: string; steps: Array<{ screen: string; action: string }> }>>(response);

  // Map back to our type structure, preserving screenId from original
  // Since GPT might merge workflows, we need to match steps back
  return refined.map((r) => {
    // Try to find matching steps from raw workflows to get screenId and screenshotPath
    const stepsWithIds = r.steps.map((step) => {
      // Find a matching step in the raw workflows
      for (const rawWorkflow of raw) {
        const match = rawWorkflow.steps.find(
          (rawStep) => 
            rawStep.screenLabel === step.screen || 
            rawStep.action === step.action
        );
        if (match) {
          return {
            screenId: match.screenId,
            screenLabel: step.screen,
            action: step.action,
            screenshotPath: match.screenshotPath,
          };
        }
      }
      // Fallback if no match found
      return {
        screenId: "",
        screenLabel: step.screen,
        action: step.action,
        screenshotPath: "",
      };
    });

    return {
      name: r.name,
      description: r.description,
      steps: stepsWithIds,
    };
  });
}
