export interface RecordedEvent {
  id?: number;
  sessionId: string;
  timestamp: number;
  url: string;
  eventType: "click";
  screenshotPath: string;
  actionSummary: string;
  screenSummary: string;
}

export interface WorkflowStep {
  screen: string;
  action: string;
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


