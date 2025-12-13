import { Database } from "bun:sqlite";
import path from "path";
import {
  CanonicalScreen,
  CanonicalScreenRow,
  WorkflowTemplate,
  WorkflowTemplateRow,
  WorkflowInstance,
  WorkflowInstanceRow,
  TemplateStep,
  ParameterDef,
  StepSnapshot,
} from "./types";

let db: Database;

export const getDb = () => db;

export const initDb = (dbPath?: string): void => {
  const finalPath = dbPath || path.join(import.meta.dir, "data.db");
  db = new Database(finalPath, { create: true });

  // Canonical screens table
  db.run(`
    CREATE TABLE IF NOT EXISTS canonical_screens (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT NOT NULL,
      urlPatternsJson TEXT NOT NULL,
      exampleScreenshotPath TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    )
  `);

  // Workflow templates table
  db.run(`
    CREATE TABLE IF NOT EXISTS workflow_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      inputsJson TEXT NOT NULL,
      outputsJson TEXT NOT NULL,
      stepsJson TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);

  // Workflow instances table
  db.run(`
    CREATE TABLE IF NOT EXISTS workflow_instances (
      id TEXT PRIMARY KEY,
      templateId TEXT NOT NULL,
      sessionId TEXT NOT NULL,
      parameterValuesJson TEXT NOT NULL,
      extractedValuesJson TEXT NOT NULL,
      stepSnapshotsJson TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (templateId) REFERENCES workflow_templates(id)
    )
  `);

  console.log("[DB] Database initialized with new schema");
};

export const closeDb = (): void => {
  if (db) {
    db.close();
  }
};

// ============================================
// CANONICAL SCREENS
// ============================================

export const insertCanonicalScreen = (screen: CanonicalScreen): void => {
  db.run(
    `INSERT OR REPLACE INTO canonical_screens (id, label, description, urlPatternsJson, exampleScreenshotPath, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      screen.id,
      screen.label,
      screen.description,
      JSON.stringify(screen.urlPatterns),
      screen.exampleScreenshotPath,
      Date.now(),
    ]
  );
};

export const insertCanonicalScreens = (screens: CanonicalScreen[]): void => {
  for (const screen of screens) {
    insertCanonicalScreen(screen);
  }
};

export const getAllCanonicalScreens = (): CanonicalScreen[] => {
  const rows = db.query(`SELECT * FROM canonical_screens ORDER BY createdAt DESC`).all() as CanonicalScreenRow[];
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    description: row.description,
    urlPatterns: JSON.parse(row.urlPatternsJson),
    exampleScreenshotPath: row.exampleScreenshotPath,
  }));
};

// ============================================
// WORKFLOW TEMPLATES
// ============================================

export const insertWorkflowTemplate = (template: WorkflowTemplate): void => {
  db.run(
    `INSERT OR REPLACE INTO workflow_templates (id, name, description, inputsJson, outputsJson, stepsJson, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      template.id,
      template.name,
      template.description,
      JSON.stringify(template.inputs),
      JSON.stringify(template.outputs),
      JSON.stringify(template.steps),
      template.createdAt,
      template.updatedAt,
    ]
  );
};

export const insertWorkflowTemplates = (templates: WorkflowTemplate[]): void => {
  for (const template of templates) {
    insertWorkflowTemplate(template);
  }
};

export const getAllWorkflowTemplates = (): WorkflowTemplate[] => {
  const rows = db.query(`SELECT * FROM workflow_templates ORDER BY updatedAt DESC`).all() as WorkflowTemplateRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    inputs: JSON.parse(row.inputsJson) as Record<string, ParameterDef>,
    outputs: JSON.parse(row.outputsJson) as Record<string, ParameterDef>,
    steps: JSON.parse(row.stepsJson) as TemplateStep[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
};

export const getWorkflowTemplateById = (id: string): WorkflowTemplate | null => {
  const row = db.query(`SELECT * FROM workflow_templates WHERE id = ?`).get(id) as WorkflowTemplateRow | null;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    inputs: JSON.parse(row.inputsJson),
    outputs: JSON.parse(row.outputsJson),
    steps: JSON.parse(row.stepsJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

// ============================================
// WORKFLOW INSTANCES
// ============================================

export const insertWorkflowInstance = (instance: WorkflowInstance): void => {
  db.run(
    `INSERT INTO workflow_instances (id, templateId, sessionId, parameterValuesJson, extractedValuesJson, stepSnapshotsJson, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      instance.id,
      instance.templateId,
      instance.sessionId,
      JSON.stringify(instance.parameterValues),
      JSON.stringify(instance.extractedValues),
      JSON.stringify(instance.stepSnapshots),
      instance.createdAt,
    ]
  );
};

export const insertWorkflowInstances = (instances: WorkflowInstance[]): void => {
  for (const instance of instances) {
    insertWorkflowInstance(instance);
  }
};

export const getAllWorkflowInstances = (): WorkflowInstance[] => {
  const rows = db.query(`SELECT * FROM workflow_instances ORDER BY createdAt DESC`).all() as WorkflowInstanceRow[];
  return rows.map((row) => ({
    id: row.id,
    templateId: row.templateId,
    sessionId: row.sessionId,
    parameterValues: JSON.parse(row.parameterValuesJson),
    extractedValues: JSON.parse(row.extractedValuesJson),
    stepSnapshots: JSON.parse(row.stepSnapshotsJson) as StepSnapshot[],
    createdAt: row.createdAt,
  }));
};

export const getInstancesByTemplateId = (templateId: string): WorkflowInstance[] => {
  const rows = db
    .query(`SELECT * FROM workflow_instances WHERE templateId = ? ORDER BY createdAt DESC`)
    .all(templateId) as WorkflowInstanceRow[];
  return rows.map((row) => ({
    id: row.id,
    templateId: row.templateId,
    sessionId: row.sessionId,
    parameterValues: JSON.parse(row.parameterValuesJson),
    extractedValues: JSON.parse(row.extractedValuesJson),
    stepSnapshots: JSON.parse(row.stepSnapshotsJson) as StepSnapshot[],
    createdAt: row.createdAt,
  }));
};

// ============================================
// AGGREGATED QUERIES
// ============================================

/**
 * Get all templates with their instances
 */
export const getTemplatesWithInstances = (): Array<WorkflowTemplate & { instances: WorkflowInstance[] }> => {
  const templates = getAllWorkflowTemplates();
  const instances = getAllWorkflowInstances();

  return templates.map((template) => ({
    ...template,
    instances: instances.filter((i) => i.templateId === template.id),
  }));
};

// ============================================
// DATABASE RESET
// ============================================

export const clearAllData = (): void => {
  db.run(`DROP TABLE IF EXISTS workflow_instances`);
  db.run(`DROP TABLE IF EXISTS workflow_templates`);
  db.run(`DROP TABLE IF EXISTS canonical_screens`);

  // Recreate tables
  db.run(`
    CREATE TABLE IF NOT EXISTS canonical_screens (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT NOT NULL,
      urlPatternsJson TEXT NOT NULL,
      exampleScreenshotPath TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS workflow_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      inputsJson TEXT NOT NULL,
      outputsJson TEXT NOT NULL,
      stepsJson TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS workflow_instances (
      id TEXT PRIMARY KEY,
      templateId TEXT NOT NULL,
      sessionId TEXT NOT NULL,
      parameterValuesJson TEXT NOT NULL,
      extractedValuesJson TEXT NOT NULL,
      stepSnapshotsJson TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (templateId) REFERENCES workflow_templates(id)
    )
  `);

  console.log("[DB] All tables dropped and recreated");
};
