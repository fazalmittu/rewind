import {
  CapturedEvent,
  DetectedInstance,
  CanonicalScreen,
  WorkflowTemplate,
  WorkflowInstance,
  TemplateStep,
  ParameterDef,
  StepSnapshot,
  SynthesisResult,
} from "../types";
import { callLLMText, sanitizeJSON } from "../llm";
import crypto from "crypto";

/**
 * Synthesize a workflow template from a detected instance
 * Extracts parameters and creates a reusable template
 */
export async function synthesizeTemplate(
  instance: DetectedInstance,
  screens: CanonicalScreen[],
  sessionId: string
): Promise<SynthesisResult> {
  const screenLookup = new Map(screens.map((s) => [s.id, s]));

  // Prepare event data for GPT
  const eventData = instance.events.map((event, idx) => {
    const screen = event.screenId ? screenLookup.get(event.screenId) : null;
    return {
      stepNumber: idx + 1,
      screenType: screen?.label || "Unknown",
      eventType: event.eventType,
      action: event.actionSummary || event.targetText?.slice(0, 100) || "User action",
      inputValue: event.inputValue || null,
      inputName: event.inputLabel || event.inputName || null,
      inputType: event.inputType || null,
      clickedText: event.targetText?.slice(0, 100) || null,
    };
  });

  const prompt = `You are creating a REUSABLE workflow template from a specific execution.

Goal of this workflow: "${instance.goal}"

Events that occurred:
${JSON.stringify(eventData, null, 2)}

Your task:
1. Create a GENERIC workflow template that could be reused with different inputs
2. Identify INPUT PARAMETERS - values the user provided that would vary between executions:
   - Search queries, form inputs, quantities, selections
   - Give them generic names like "search_query", "quantity", "item_name"
3. Identify OUTPUT PARAMETERS - values extracted during execution:
   - Product names clicked, prices seen, confirmation messages
4. Create TEMPLATE STEPS with {placeholders} for parameters

Return JSON (no markdown):
{
  "template": {
    "name": "Search and Add to Cart",
    "description": "Search for a product and add it to the shopping cart",
    "inputs": {
      "search_query": {
        "type": "string",
        "description": "The search term to look for",
        "required": true
      },
      "quantity": {
        "type": "number",
        "description": "Number of items to add",
        "required": false,
        "default": 1
      }
    },
    "outputs": {
      "product_name": {
        "type": "string",
        "description": "Name of the product that was added"
      }
    },
    "steps": [
      {
        "stepNumber": 1,
        "screenPattern": "Search Results",
        "actionTemplate": "Enter {search_query} in search box",
        "usesInputs": ["search_query"],
        "extracts": {}
      },
      {
        "stepNumber": 2,
        "screenPattern": "Product Detail Page",
        "actionTemplate": "Click on a product from search results",
        "usesInputs": [],
        "extracts": {
          "product_name": { "from": "clicked_text" }
        }
      }
    ]
  },
  "instanceValues": {
    "inputs": {
      "search_query": "iPad",
      "quantity": 3
    },
    "outputs": {
      "product_name": "iPad Pro 11-inch"
    }
  }
}

Rules:
- Template name should be GENERIC (not "Search for iPad")
- Parameter names should be snake_case
- Every input mentioned in steps must be defined in inputs
- Extract values that would be useful to know after the workflow completes`;

  try {
    const response = await callLLMText(prompt);
    const result = sanitizeJSON<{
      template: {
        name: string;
        description: string;
        inputs: Record<string, { type: string; description: string; required?: boolean; default?: any }>;
        outputs: Record<string, { type: string; description: string }>;
        steps: Array<{
          stepNumber: number;
          screenPattern: string;
          actionTemplate: string;
          usesInputs: string[];
          extracts: Record<string, { from: string }>;
        }>;
      };
      instanceValues: {
        inputs: Record<string, any>;
        outputs: Record<string, any>;
      };
    }>(response);

    const templateId = `tmpl_${crypto.randomUUID().slice(0, 8)}`;
    const instanceId = `inst_${crypto.randomUUID().slice(0, 8)}`;
    const now = Date.now();

    // Build template
    const template: WorkflowTemplate = {
      id: templateId,
      name: result.template.name,
      description: result.template.description,
      inputs: Object.fromEntries(
        Object.entries(result.template.inputs).map(([key, val]) => [
          key,
          {
            type: (val.type as "string" | "number" | "boolean") || "string",
            description: val.description,
            required: val.required ?? true,
            default: val.default,
            observedValues: result.instanceValues.inputs[key] !== undefined 
              ? [result.instanceValues.inputs[key]] 
              : [],
          } as ParameterDef,
        ])
      ),
      outputs: Object.fromEntries(
        Object.entries(result.template.outputs).map(([key, val]) => [
          key,
          {
            type: (val.type as "string" | "number" | "boolean") || "string",
            description: val.description,
            required: false,
            observedValues: result.instanceValues.outputs[key] !== undefined
              ? [result.instanceValues.outputs[key]]
              : [],
          } as ParameterDef,
        ])
      ),
      steps: result.template.steps.map((step) => ({
        stepNumber: step.stepNumber,
        screenPattern: step.screenPattern,
        actionTemplate: step.actionTemplate,
        usesInputs: step.usesInputs || [],
        extracts: Object.fromEntries(
          Object.entries(step.extracts || {}).map(([key, val]) => [
            key,
            { from: val.from as "clicked_text" | "input_value" | "url_param" | "page_content" },
          ])
        ),
      })),
      createdAt: now,
      updatedAt: now,
    };

    // Build step snapshots from actual events
    const stepSnapshots: StepSnapshot[] = instance.events.map((event, idx) => {
      const screen = event.screenId ? screenLookup.get(event.screenId) : null;
      return {
        stepNumber: idx + 1,
        screenshotPath: event.screenshotPath,
        action: event.actionSummary || event.targetText?.slice(0, 100) || "User action",
        screenLabel: screen?.label || "Unknown",
      };
    });

    // Build instance
    const workflowInstance: WorkflowInstance = {
      id: instanceId,
      templateId,
      sessionId,
      parameterValues: result.instanceValues.inputs,
      extractedValues: result.instanceValues.outputs,
      stepSnapshots,
      createdAt: now,
    };

    console.log(`[Synthesizer] Created template "${template.name}" with ${Object.keys(template.inputs).length} inputs`);

    return { template, instance: workflowInstance };
  } catch (error) {
    console.error("[Synthesizer] Error:", error);

    // Fallback: create basic template
    const templateId = `tmpl_${crypto.randomUUID().slice(0, 8)}`;
    const instanceId = `inst_${crypto.randomUUID().slice(0, 8)}`;
    const now = Date.now();

    const template: WorkflowTemplate = {
      id: templateId,
      name: instance.goal,
      description: `Workflow: ${instance.goal}`,
      inputs: {},
      outputs: {},
      steps: instance.events.map((event, idx) => {
        const screen = event.screenId ? screenLookup.get(event.screenId) : null;
        return {
          stepNumber: idx + 1,
          screenPattern: screen?.label || "Unknown",
          actionTemplate: event.actionSummary || event.targetText?.slice(0, 50) || "Action",
          usesInputs: [],
          extracts: {},
        };
      }),
      createdAt: now,
      updatedAt: now,
    };

    const stepSnapshots: StepSnapshot[] = instance.events.map((event, idx) => {
      const screen = event.screenId ? screenLookup.get(event.screenId) : null;
      return {
        stepNumber: idx + 1,
        screenshotPath: event.screenshotPath,
        action: event.actionSummary || "Action",
        screenLabel: screen?.label || "Unknown",
      };
    });

    const workflowInstance: WorkflowInstance = {
      id: instanceId,
      templateId,
      sessionId,
      parameterValues: {},
      extractedValues: {},
      stepSnapshots,
      createdAt: now,
    };

    return { template, instance: workflowInstance };
  }
}

/**
 * Synthesize templates for multiple instances
 */
export async function synthesizeTemplates(
  instances: DetectedInstance[],
  screens: CanonicalScreen[],
  sessionId: string
): Promise<SynthesisResult[]> {
  const results: SynthesisResult[] = [];

  for (const instance of instances) {
    const result = await synthesizeTemplate(instance, screens, sessionId);
    results.push(result);
  }

  return results;
}

