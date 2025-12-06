import sqlite3 from "sqlite3";
import path from "path";
import {
  RecordedEvent,
  RawWorkflow,
  RefinedWorkflow,
  RawWorkflowRow,
  RefinedWorkflowRow,
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
        // Events table
        db.run(`
          CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sessionId TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            url TEXT NOT NULL,
            eventType TEXT NOT NULL,
            screenshotPath TEXT NOT NULL,
            actionSummary TEXT NOT NULL,
            screenSummary TEXT NOT NULL
          )
        `);

        // Raw workflows table
        db.run(`
          CREATE TABLE IF NOT EXISTS raw_workflows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sessionId TEXT NOT NULL,
            workflowJson TEXT NOT NULL,
            createdAt INTEGER NOT NULL
          )
        `);

        // Refined workflows table
        db.run(`
          CREATE TABLE IF NOT EXISTS refined_workflows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sessionId TEXT NOT NULL,
            refinedJson TEXT NOT NULL,
            createdAt INTEGER NOT NULL
          )
        `);

        // Mapping table
        db.run(
          `
          CREATE TABLE IF NOT EXISTS refined_workflow_map (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rawWorkflowId INTEGER NOT NULL,
            refinedWorkflowId INTEGER NOT NULL,
            FOREIGN KEY (rawWorkflowId) REFERENCES raw_workflows(id),
            FOREIGN KEY (refinedWorkflowId) REFERENCES refined_workflows(id)
          )
        `,
          (err) => {
            if (err) reject(err);
            else resolve();
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

export const insertEvent = (
  ev: Omit<RecordedEvent, "id">
): Promise<number> => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO events (sessionId, timestamp, url, eventType, screenshotPath, actionSummary, screenSummary)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        ev.sessionId,
        ev.timestamp,
        ev.url,
        ev.eventType,
        ev.screenshotPath,
        ev.actionSummary,
        ev.screenSummary,
      ],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

export const getSessionEvents = (
  sessionId: string
): Promise<RecordedEvent[]> => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM events WHERE sessionId = ? ORDER BY timestamp ASC`,
      [sessionId],
      (err, rows) => {
        if (err) reject(err);
        else resolve((rows as RecordedEvent[]) || []);
      }
    );
  });
};

export const insertRawWorkflow = (
  sessionId: string,
  workflow: RawWorkflow
): Promise<number> => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO raw_workflows (sessionId, workflowJson, createdAt)
       VALUES (?, ?, ?)`,
      [sessionId, JSON.stringify(workflow), Date.now()],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

export const insertRefinedWorkflow = (
  sessionId: string,
  workflow: RefinedWorkflow
): Promise<number> => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO refined_workflows (sessionId, refinedJson, createdAt)
       VALUES (?, ?, ?)`,
      [sessionId, JSON.stringify(workflow), Date.now()],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

export const insertWorkflowMapping = (
  rawWorkflowId: number,
  refinedWorkflowId: number
): Promise<number> => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO refined_workflow_map (rawWorkflowId, refinedWorkflowId)
       VALUES (?, ?)`,
      [rawWorkflowId, refinedWorkflowId],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

export const getAllRefinedWorkflows = (): Promise<RefinedWorkflowRow[]> => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM refined_workflows ORDER BY createdAt DESC`,
      [],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        const parsed = ((rows as any[]) || []).map((r) => ({
          id: r.id,
          sessionId: r.sessionId,
          refinedJson: JSON.parse(r.refinedJson) as RefinedWorkflow,
          createdAt: r.createdAt,
        }));
        resolve(parsed);
      }
    );
  });
};

export const getRawWorkflows = (sessionId: string): Promise<RawWorkflowRow[]> => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM raw_workflows WHERE sessionId = ? ORDER BY createdAt ASC`,
      [sessionId],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        const parsed = ((rows as any[]) || []).map((r) => ({
          id: r.id,
          sessionId: r.sessionId,
          workflowJson: JSON.parse(r.workflowJson) as RawWorkflow,
          createdAt: r.createdAt,
        }));
        resolve(parsed);
      }
    );
  });
};


