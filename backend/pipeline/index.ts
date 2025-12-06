import { CapturedEvent, FinalizationResult } from "../types";
import { canonicalizeScreens } from "./screenCanonicalizer";
import { segmentInstances } from "./instanceSegmenter";
import { synthesizeTemplates } from "./templateSynthesizer";
import {
  insertCanonicalScreens,
  insertWorkflowTemplates,
  insertWorkflowInstances,
} from "../db";

/**
 * Main finalization pipeline
 * 
 * Takes raw captured events and produces:
 * 1. Canonical screens (grouped similar screens)
 * 2. Workflow templates (reusable patterns with parameters)
 * 3. Workflow instances (specific executions with values)
 */
export async function runFinalizationPipeline(
  sessionId: string,
  events: CapturedEvent[]
): Promise<FinalizationResult> {
  console.log(`[Pipeline] Starting finalization for session ${sessionId} with ${events.length} events`);

  if (events.length === 0) {
    console.log("[Pipeline] No events to process");
    return { screens: [], templates: [], instances: [] };
  }

  // Step 1: Canonicalize screens
  console.log("[Pipeline] Step 1: Canonicalizing screens...");
  const { screens, eventScreenMappings } = await canonicalizeScreens(events);
  console.log(`[Pipeline] Created ${screens.length} canonical screens`);

  // Step 2: Segment into workflow instances
  console.log("[Pipeline] Step 2: Segmenting into workflow instances...");
  const { instances: detectedInstances } = await segmentInstances(events, screens);
  console.log(`[Pipeline] Detected ${detectedInstances.length} workflow instances`);

  if (detectedInstances.length === 0) {
    console.log("[Pipeline] No workflow instances detected");
    // Still persist screens
    await insertCanonicalScreens(screens);
    return { screens, templates: [], instances: [] };
  }

  // Step 3: Synthesize templates from instances
  console.log("[Pipeline] Step 3: Synthesizing templates...");
  const synthesisResults = await synthesizeTemplates(detectedInstances, screens, sessionId);
  
  const templates = synthesisResults.map((r) => r.template);
  const instances = synthesisResults.map((r) => r.instance);
  console.log(`[Pipeline] Created ${templates.length} templates and ${instances.length} instances`);

  // Step 4: Persist to database
  console.log("[Pipeline] Step 4: Persisting to database...");
  await insertCanonicalScreens(screens);
  await insertWorkflowTemplates(templates);
  await insertWorkflowInstances(instances);
  console.log("[Pipeline] Data persisted successfully");

  return { screens, templates, instances };
}

// Re-export pipeline components for direct access if needed
export { canonicalizeScreens } from "./screenCanonicalizer";
export { segmentInstances } from "./instanceSegmenter";
export { synthesizeTemplate, synthesizeTemplates } from "./templateSynthesizer";

