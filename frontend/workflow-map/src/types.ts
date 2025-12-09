// Mirror of backend types for the frontend

export interface ParameterDef {
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
  default?: unknown;
  observedValues: unknown[];
}

export interface ExtractionDef {
  from: "clicked_text" | "input_value" | "url_param" | "page_content";
  description?: string;
}

export interface TemplateStep {
  stepNumber: number;
  screenPattern: string;
  actionTemplate: string;
  usesInputs: string[];
  extracts: Record<string, ExtractionDef>;
}

export interface StepSnapshot {
  stepNumber: number;
  screenshotPath: string;
  action: string;
  screenLabel: string;
}

export interface WorkflowInstance {
  id: string;
  templateId: string;
  sessionId: string;
  parameterValues: Record<string, unknown>;
  extractedValues: Record<string, unknown>;
  stepSnapshots: StepSnapshot[];
  createdAt: number;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  inputs: Record<string, ParameterDef>;
  outputs: Record<string, ParameterDef>;
  steps: TemplateStep[];
  createdAt: number;
  updatedAt: number;
  instances?: WorkflowInstance[];
}

export interface CanonicalScreen {
  id: string;
  label: string;
  description: string;
  urlPatterns: string[];
  exampleScreenshotPath: string;
}

