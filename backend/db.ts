import sqlite3 from "sqlite3";
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

sqlite3.verbose();

let db: sqlite3.Database;

export const getDb = () => db;

export const initDb = (dbPath?: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const finalPath = dbPath || path.join(__dirname, "data.db");
    db = new sqlite3.Database(finalPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.serialize(() => {
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
        db.run(
          `
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
        `,
          (err) => {
            if (err) reject(err);
            else {
              console.log("[DB] Database initialized with new schema");
              resolve();
            }
          }
        );
      });
    });
  });
};

export const closeDb = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      resolve();
    }
  });
};

// ============================================
// CANONICAL SCREENS
// ============================================

export const insertCanonicalScreen = (screen: CanonicalScreen): Promise<void> => {
  return new Promise((resolve, reject) => {
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
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

export const insertCanonicalScreens = async (screens: CanonicalScreen[]): Promise<void> => {
  for (const screen of screens) {
    await insertCanonicalScreen(screen);
  }
};

export const getAllCanonicalScreens = (): Promise<CanonicalScreen[]> => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM canonical_screens ORDER BY createdAt DESC`, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      const screens = ((rows as CanonicalScreenRow[]) || []).map((row) => ({
        id: row.id,
        label: row.label,
        description: row.description,
        urlPatterns: JSON.parse(row.urlPatternsJson),
        exampleScreenshotPath: row.exampleScreenshotPath,
      }));
      resolve(screens);
    });
  });
};

// ============================================
// WORKFLOW TEMPLATES
// ============================================

export const insertWorkflowTemplate = (template: WorkflowTemplate): Promise<void> => {
  return new Promise((resolve, reject) => {
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
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

export const insertWorkflowTemplates = async (templates: WorkflowTemplate[]): Promise<void> => {
  for (const template of templates) {
    await insertWorkflowTemplate(template);
  }
};

export const getAllWorkflowTemplates = (): Promise<WorkflowTemplate[]> => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM workflow_templates ORDER BY updatedAt DESC`, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      const templates = ((rows as WorkflowTemplateRow[]) || []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        inputs: JSON.parse(row.inputsJson) as Record<string, ParameterDef>,
        outputs: JSON.parse(row.outputsJson) as Record<string, ParameterDef>,
        steps: JSON.parse(row.stepsJson) as TemplateStep[],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
      resolve(templates);
    });
  });
};

export const getWorkflowTemplateById = (id: string): Promise<WorkflowTemplate | null> => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM workflow_templates WHERE id = ?`, [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      if (!row) {
        resolve(null);
        return;
      }
      const r = row as WorkflowTemplateRow;
      resolve({
        id: r.id,
        name: r.name,
        description: r.description,
        inputs: JSON.parse(r.inputsJson),
        outputs: JSON.parse(r.outputsJson),
        steps: JSON.parse(r.stepsJson),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      });
    });
  });
};

// ============================================
// WORKFLOW INSTANCES
// ============================================

export const insertWorkflowInstance = (instance: WorkflowInstance): Promise<void> => {
  return new Promise((resolve, reject) => {
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
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

export const insertWorkflowInstances = async (instances: WorkflowInstance[]): Promise<void> => {
  for (const instance of instances) {
    await insertWorkflowInstance(instance);
  }
};

export const getAllWorkflowInstances = (): Promise<WorkflowInstance[]> => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM workflow_instances ORDER BY createdAt DESC`, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      const instances = ((rows as WorkflowInstanceRow[]) || []).map((row) => ({
        id: row.id,
        templateId: row.templateId,
        sessionId: row.sessionId,
        parameterValues: JSON.parse(row.parameterValuesJson),
        extractedValues: JSON.parse(row.extractedValuesJson),
        stepSnapshots: JSON.parse(row.stepSnapshotsJson) as StepSnapshot[],
        createdAt: row.createdAt,
      }));
      resolve(instances);
    });
  });
};

export const getInstancesByTemplateId = (templateId: string): Promise<WorkflowInstance[]> => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM workflow_instances WHERE templateId = ? ORDER BY createdAt DESC`,
      [templateId],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        const instances = ((rows as WorkflowInstanceRow[]) || []).map((row) => ({
          id: row.id,
          templateId: row.templateId,
          sessionId: row.sessionId,
          parameterValues: JSON.parse(row.parameterValuesJson),
          extractedValues: JSON.parse(row.extractedValuesJson),
          stepSnapshots: JSON.parse(row.stepSnapshotsJson) as StepSnapshot[],
          createdAt: row.createdAt,
        }));
        resolve(instances);
      }
    );
  });
};

// ============================================
// AGGREGATED QUERIES
// ============================================

/**
 * Get all templates with their instances
 */
export const getTemplatesWithInstances = async (): Promise<
  Array<WorkflowTemplate & { instances: WorkflowInstance[] }>
> => {
  const templates = await getAllWorkflowTemplates();
  const instances = await getAllWorkflowInstances();

  return templates.map((template) => ({
    ...template,
    instances: instances.filter((i) => i.templateId === template.id),
  }));
};

// ============================================
// DATABASE RESET
// ============================================

export const clearAllData = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Drop all tables
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

      db.run(
        `
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
      `,
        (err) => {
          if (err) {
            console.error("Error recreating tables:", err);
            reject(err);
          } else {
            console.log("[DB] All tables dropped and recreated");
            resolve();
          }
        }
      );
    });
  });
};
