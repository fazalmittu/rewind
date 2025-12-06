import express, { Express } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import {
  initDb,
  insertEvent,
  getSessionEvents,
  insertRawWorkflow,
  insertRefinedWorkflow,
  insertWorkflowMapping,
  getAllRefinedWorkflows,
} from "./db";
import { summarizeAction, summarizeScreen } from "./llm";
import { segmentWorkflows } from "./workflowSegmenter";
import { refineWorkflows } from "./workflowRefiner";

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // Serve frontend static files
  app.use("/", express.static(path.join(__dirname, "..", "frontend")));

  // Health check
  app.get("/health", (_, res) => {
    res.json({ status: "ok" });
  });

  // Ingest endpoint - receives click events + screenshots from extension
  app.post("/ingest", async (req, res) => {
    try {
      const { payload, screenshot } = req.body;

      if (!payload || !screenshot) {
        res.status(400).json({ error: "Missing payload or screenshot" });
        return;
      }

      // Save screenshot
      const screenshotsDir = path.join(__dirname, "..", "storage", "screenshots");
      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
      }

      const fileName = `${payload.timestamp}.png`;
      const screenshotPath = path.join(screenshotsDir, fileName);
      const base64Data = screenshot.replace(/^data:image\/png;base64,/, "");
      fs.writeFileSync(screenshotPath, base64Data, "base64");

      // Get LLM summaries
      const actionSummary = await summarizeAction(
        {
          eventType: payload.eventType,
          url: payload.url,
          x: payload.x,
          y: payload.y,
        },
        screenshotPath
      );
      const screenSummary = await summarizeScreen(screenshotPath);

      // Store event in DB
      await insertEvent({
        sessionId: payload.sessionId,
        timestamp: payload.timestamp,
        url: payload.url,
        eventType: payload.eventType,
        screenshotPath: `storage/screenshots/${fileName}`,
        actionSummary,
        screenSummary,
      });

      res.json({ status: "ok" });
    } catch (error) {
      console.error("Ingest error:", error);
      res.status(500).json({ error: "Failed to ingest event" });
    }
  });

  // Finalize session - segments and refines workflows
  app.post("/finalize-session", async (req, res) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        res.status(400).json({ error: "Missing sessionId" });
        return;
      }

      // Segment workflows from events
      const raw = await segmentWorkflows(sessionId);

      if (raw.length === 0) {
        res.json({ ok: true, raw: [], refined: [] });
        return;
      }

      // Refine workflows via GPT
      const refined = await refineWorkflows(raw);

      // Store raw workflows and get their IDs
      const rawIds: number[] = [];
      for (const workflow of raw) {
        const id = await insertRawWorkflow(sessionId, workflow);
        rawIds.push(id);
      }

      // Store refined workflows and create mappings
      // Note: GPT might merge workflows, so we map all raw to each refined
      const refinedIds: number[] = [];
      for (const workflow of refined) {
        const id = await insertRefinedWorkflow(sessionId, workflow);
        refinedIds.push(id);
      }

      // Create mappings (all raw workflows map to all refined for simplicity)
      // In a more sophisticated version, GPT could return mapping info
      for (const rawId of rawIds) {
        for (const refinedId of refinedIds) {
          await insertWorkflowMapping(rawId, refinedId);
        }
      }

      res.json({ ok: true, raw, refined });
    } catch (error) {
      console.error("Finalize error:", error);
      res.status(500).json({ error: "Failed to finalize session" });
    }
  });

  // Get all workflows
  app.get("/workflows", async (_, res) => {
    try {
      const workflows = await getAllRefinedWorkflows();
      res.json(workflows);
    } catch (error) {
      console.error("Get workflows error:", error);
      res.status(500).json({ error: "Failed to get workflows" });
    }
  });

  return app;
}


