// ============================================
// CAPTURED EVENTS (Raw data from extension)
// ============================================

/**
 * Event types we capture from the browser
 */
export type EventType = "click" | "input" | "change" | "submit";

/**
 * Raw event captured by the extension
 */
export interface CapturedEvent {
  timestamp: number;
  eventType: EventType;
  url: string;
  screenshotPath: string;
  
  // Click data
  clickX?: number;
  clickY?: number;
  targetTag: string;
  targetText?: string;
  
  // Input/Change data
  inputValue?: string;
  inputName?: string;
  inputLabel?: string;
  inputType?: string;
  
  // Added during classification
  significant?: boolean;
  screenId?: string;
  actionSummary?: string;
}

// ============================================
// CANONICAL SCREENS
// ============================================

/**
 * A canonical screen type (e.g., "Product Detail Page")
 * Multiple specific screens map to one canonical screen
 */
export interface CanonicalScreen {
  id: string;
  label: string;              // Generic label: "Product Detail Page"
  description: string;
  urlPatterns: string[];      // Patterns that match this screen
  exampleScreenshotPath: string;
}

// ============================================
// WORKFLOW TEMPLATES
// ============================================

/**
 * Parameter definition for workflow inputs/outputs
 */
export interface ParameterDef {
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
  default?: any;
  observedValues: any[];      // Values seen across instances
}

/**
 * Extraction definition - how to pull data from a step
 */
export interface ExtractionDef {
  from: "clicked_text" | "input_value" | "url_param" | "page_content";
  description?: string;
}

/**
 * A step in a workflow template
 */
export interface TemplateStep {
  stepNumber: number;
  screenPattern: string;      // Canonical screen type
  actionTemplate: string;     // Template with {placeholders}
  usesInputs: string[];       // Which input params this step uses
  extracts: Record<string, ExtractionDef>;  // What this step extracts
}

/**
 * A reusable workflow template
 */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  inputs: Record<string, ParameterDef>;
  outputs: Record<string, ParameterDef>;
  steps: TemplateStep[];
  createdAt: number;
  updatedAt: number;
}

// ============================================
// WORKFLOW INSTANCES
// ============================================

/**
 * A snapshot of a step as it was executed
 */
export interface StepSnapshot {
  stepNumber: number;
  screenshotPath: string;
  action: string;             // Actual action taken (not template)
  screenLabel: string;
}

/**
 * A specific execution of a workflow template
 */
export interface WorkflowInstance {
  id: string;
  templateId: string;
  sessionId: string;
  parameterValues: Record<string, any>;   // Actual input values
  extractedValues: Record<string, any>;   // Values extracted during execution
  stepSnapshots: StepSnapshot[];
  createdAt: number;
}

// ============================================
// SESSION STATE (In-memory during recording)
// ============================================

/**
 * In-memory state for an active recording session
 */
export interface SessionState {
  sessionId: string;
  events: CapturedEvent[];
  createdAt: number;
}

// ============================================
// PIPELINE TYPES (Used during finalization)
// ============================================

/**
 * Result of screen canonicalization
 */
export interface CanonicalizeResult {
  screens: CanonicalScreen[];
  eventScreenMappings: Map<number, string>;  // eventIndex -> screenId
}

/**
 * A detected workflow instance (before template generation)
 */
export interface DetectedInstance {
  goal: string;
  startEventIndex: number;
  endEventIndex: number;
  succeeded: boolean;
  events: CapturedEvent[];
}

/**
 * Result of instance segmentation
 */
export interface SegmentationResult {
  instances: DetectedInstance[];
}

/**
 * Result of template synthesis for one instance
 */
export interface SynthesisResult {
  template: WorkflowTemplate;
  instance: WorkflowInstance;
}

/**
 * Complete result of finalization pipeline
 */
export interface FinalizationResult {
  screens: CanonicalScreen[];
  templates: WorkflowTemplate[];
  instances: WorkflowInstance[];
}

// ============================================
// API PAYLOAD TYPES
// ============================================

/**
 * Payload from extension for /ingest
 */
export interface IngestPayload {
  sessionId: string;
  timestamp: number;
  url: string;
  eventType: EventType;
  targetTag: string;
  targetText?: string;
  clickX?: number;
  clickY?: number;
  inputValue?: string;
  inputName?: string;
  inputLabel?: string;
  inputType?: string;
}

/**
 * Request body for /ingest
 */
export interface IngestRequest {
  payload: IngestPayload;
  screenshot: string;  // Base64 data URL
}

// ============================================
// DATABASE ROW TYPES
// ============================================

export interface CanonicalScreenRow {
  id: string;
  label: string;
  description: string;
  urlPatternsJson: string;
  exampleScreenshotPath: string;
  createdAt: number;
}

export interface WorkflowTemplateRow {
  id: string;
  name: string;
  description: string;
  inputsJson: string;
  outputsJson: string;
  stepsJson: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowInstanceRow {
  id: string;
  templateId: string;
  sessionId: string;
  parameterValuesJson: string;
  extractedValuesJson: string;
  stepSnapshotsJson: string;
  createdAt: number;
}
