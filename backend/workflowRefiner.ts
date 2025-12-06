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
 */
export async function refineWorkflows(
  raw: RawWorkflow[]
): Promise<RefinedWorkflow[]> {
  if (raw.length === 0) {
    return [];
  }

  const prompt = `You are analyzing user workflows extracted from a system.

Your job:
- Assign each workflow a clear name (2–5 words).
- Assign each workflow a 1–2 sentence description.
- If multiple workflows represent the same task, merge them into one.
- Maintain the same order of steps within each workflow.
- Do not delete steps.
- Do not add steps.

Workflows (JSON):
${JSON.stringify(raw, null, 2)}

Return JSON ONLY in this format (no markdown, no explanation):
[
  {
    "name": "...",
    "description": "...",
    "steps": [{ "screen": "...", "action": "..." }, ...]
  }
]`;

  const response = await callLLMText(prompt);
  return sanitizeJSON<RefinedWorkflow[]>(response);
}


