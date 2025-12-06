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

  // Prepare event data for GPT with rich context
  const eventData = instance.events.map((event, idx) => {
    const screen = event.screenId ? screenLookup.get(event.screenId) : null;
    return {
      stepNumber: idx + 1,
      screenType: screen?.label || "Unknown",
      eventType: event.eventType,
      // For clicks, show what was clicked
      clickedText: event.eventType === "click" ? (event.targetText?.slice(0, 150) || null) : null,
      // For inputs, show what was typed
      typedText: event.eventType === "input" ? event.inputValue : null,
      inputFieldName: event.eventType === "input" ? (event.inputLabel || event.inputName || null) : null,
      inputFieldType: event.eventType === "input" ? event.inputType : null,
      // For changes (dropdowns, etc)
      selectedValue: event.eventType === "change" ? event.inputValue : null,
      // URL for context
      url: event.url,
    };
  });

  const prompt = `You are creating a REUSABLE workflow template from a recorded user session.

WORKFLOW GOAL: "${instance.goal}"

RECORDED EVENTS (in order):
${JSON.stringify(eventData, null, 2)}

YOUR TASK:
1. Create a generic, reusable workflow template
2. Identify INPUT PARAMETERS - user-provided values that would vary:
   - Text typed into fields (typedText)
   - Selections made (selectedValue)
   - Items clicked that represent choices
   - Give descriptive snake_case names: comment_text, issue_title, assignee_name, status_value
3. Identify OUTPUT/EXTRACTED values - data captured during execution:
   - Confirmation messages, selected item names, status changes
4. Write CLEAR action descriptions for each step

CRITICAL RULES:
- If "typedText" exists for an event, that IS user input - create a parameter for it
- Step descriptions should be specific: "Type {comment_text} in the comment field" NOT "Interact with page"
- Template name must be GENERIC: "Add Comment to Issue" not "Add Comment to IPC Issue"
- Every step must have a clear, specific actionTemplate

Return JSON (no markdown):
{
  "template": {
    "name": "Add Comment to Issue",
    "description": "Open an issue and add a comment to it",
    "inputs": {
      "issue_identifier": {
        "type": "string",
        "description": "The issue title or ID to open",
        "required": true
      },
      "comment_text": {
        "type": "string",
        "description": "The comment content to add",
        "required": true
      }
    },
    "outputs": {
      "comment_posted": {
        "type": "boolean",
        "description": "Whether the comment was successfully posted"
      }
    },
    "steps": [
      {
        "stepNumber": 1,
        "screenPattern": "Issues List",
        "actionTemplate": "Click on issue {issue_identifier}",
        "usesInputs": ["issue_identifier"],
        "extracts": {}
      },
      {
        "stepNumber": 2,
        "screenPattern": "Issue Detail",
        "actionTemplate": "Click the comment input field",
        "usesInputs": [],
        "extracts": {}
      },
      {
        "stepNumber": 3,
        "screenPattern": "Issue Detail",
        "actionTemplate": "Type {comment_text} in the comment field",
        "usesInputs": ["comment_text"],
        "extracts": {}
      },
      {
        "stepNumber": 4,
        "screenPattern": "Issue Detail",
        "actionTemplate": "Click Submit/Post button",
        "usesInputs": [],
        "extracts": {
          "comment_posted": { "from": "page_content" }
        }
      }
    ]
  },
  "instanceValues": {
    "inputs": {
      "issue_identifier": "BUG-123",
      "comment_text": "This looks like a duplicate of the other issue"
    },
    "outputs": {
      "comment_posted": true
    }
  }
}`;

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

