// ============================================
// SCREEN & SESSION TYPES (In-Memory During Recording)
// ============================================

/**
 * A canonical screen identified during the session.
 * Built up as we observe more interactions.
 */
export interface KnownScreen {
  id: string;                    // UUID generated when first seen
  label: string;                 // e.g., "Dashboard", "Patient List"
  description: string;           // e.g., "Main application dashboard with metrics"
  urlPattern: string;            // URL path pattern, e.g., "/dashboard"
  exampleScreenshotPath: string; // First screenshot where we saw this screen
  seenCount: number;             // How many times we've seen this screen
}

/**
 * An event recorded during the session (before DB persistence).
 * References screens by ID rather than raw strings.
 */
export interface SessionEvent {
  timestamp: number;
  url: string;
  screenId: string;              // References KnownScreen.id
  actionSummary: string;
  screenshotPath: string;
  clickX?: number;
  clickY?: number;
}

/**
 * In-memory state for an active recording session.
 * Persisted to DB only on finalization.
 */
export interface SessionState {
  sessionId: string;
  knownScreens: KnownScreen[];
  events: SessionEvent[];
  lastScreenshotPath: string | null;
  lastScreenId: string | null;
  lastUrl: string | null;
  createdAt: number;
}

/**
 * Result from the unified classification GPT call.
 */
export interface ClassificationResult {
  significant: boolean;
  reason?: string;  // If not significant, explains why
  
  // Only present if significant:
  screen?: {
    isNew: boolean;
    matchedScreenId?: string;   // If matched existing screen
    label?: string;             // If new screen
    description?: string;       // If new screen
  };
  action?: string;              // Description of what the user did
}

// ============================================
// DATABASE TYPES (Persisted)
// ============================================

/**
 * A screen stored in the database (persisted after finalization).
 */
export interface ScreenRow {
  id: string;
  sessionId: string;
  label: string;
  description: string;
  urlPattern: string;
  exampleScreenshotPath: string;
  seenCount: number;
  createdAt: number;
}

/**
 * An event stored in the database.
 */
export interface RecordedEvent {
  id?: number;
  sessionId: string;
  timestamp: number;
  url: string;
  eventType: "click";
  screenshotPath: string;
  screenId: string;              // References screen
  actionSummary: string;
  // Legacy field for backwards compatibility
  screenSummary?: string;
}

// ============================================
// WORKFLOW TYPES
// ============================================

export interface WorkflowStep {
  screenId: string;
  screenLabel: string;           // Denormalized for display
  action: string;
  screenshotPath: string;
}

export interface RawWorkflow {
  steps: WorkflowStep[];
}

export interface RefinedWorkflow {
  name: string;
  description: string;
  steps: WorkflowStep[];
}

export interface RawWorkflowRow {
  id?: number;
  sessionId: string;
  workflowJson: RawWorkflow;
  createdAt: number;
}

export interface RefinedWorkflowRow {
  id?: number;
  sessionId: string;
  refinedJson: RefinedWorkflow;
  createdAt: number;
}

export interface WorkflowMapping {
  id?: number;
  rawWorkflowId: number;
  refinedWorkflowId: number;
}

// ============================================
// API PAYLOAD TYPES
// ============================================

export interface IngestPayload {
  sessionId: string;
  timestamp: number;
  url: string;
  eventType: "click";
  x?: number;
  y?: number;
}

export interface IngestRequest {
  payload: IngestPayload;
  screenshot: string;  // Base64 data URL
}
