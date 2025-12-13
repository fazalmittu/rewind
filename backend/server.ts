import express, { Express } from "express";
import cors from "cors";
import path from "path";
import {
  clearAllData,
  getTemplatesWithInstances,
  getAllCanonicalScreens,
} from "./db";
import { sessionStore } from "./sessionStore";
import { runFinalizationPipeline } from "./pipeline";
import { IngestRequest, CapturedEvent } from "./types";

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // Serve frontend static files
  app.use("/", express.static(path.join(import.meta.dir, "..", "frontend")));

  // Serve assets (logo, etc.)
  app.use(
    "/assets",
    express.static(path.join(import.meta.dir, "..", "assets"))
  );

  // Serve screenshots
  app.use(
    "/screenshots",
    express.static(path.join(import.meta.dir, "..", "storage", "screenshots"))
  );

  // Health check
  app.get("/health", (_, res) => {
    res.json({ status: "ok" });
  });

  // Session stats
  app.get("/session-stats", (_, res) => {
    res.json(sessionStore.getStats());
  });

  // Get current session state (for debugging)
  app.get("/session/:sessionId", (req, res) => {
    const session = sessionStore.get(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({
      sessionId: session.sessionId,
      eventCount: session.events.length,
      events: session.events.map((e) => ({
        type: e.eventType,
        url: e.url,
        action: e.actionSummary || e.targetText?.slice(0, 50),
      })),
      createdAt: session.createdAt,
    });
  });

  // Ingest endpoint - receives events + screenshots from extension
  app.post("/ingest", async (req, res) => {
    console.log("[Ingest] Received event request");
    try {
      const { payload, screenshot } = req.body as IngestRequest;

      if (!payload || !screenshot) {
        console.log("[Ingest] Missing payload or screenshot");
        res.status(400).json({ error: "Missing payload or screenshot" });
        return;
      }

      console.log(
        `[Ingest] Event: ${payload.eventType} from session ${payload.sessionId}`
      );

      // Save screenshot using Bun native API
      const screenshotsDir = path.join(
        import.meta.dir,
        "..",
        "storage",
        "screenshots"
      );
      const fileName = `${payload.timestamp}.png`;
      const screenshotPath = path.join(screenshotsDir, fileName);
      const relativeScreenshotPath = `storage/screenshots/${fileName}`;

      // Ensure directory exists
      await Bun.write(path.join(screenshotsDir, ".keep"), "");

      // Write screenshot (base64 decode)
      const base64Data = screenshot.replace(/^data:image\/png;base64,/, "");
      await Bun.write(screenshotPath, Buffer.from(base64Data, "base64"));

      // Create captured event
      const event: CapturedEvent = {
        timestamp: payload.timestamp,
        eventType: payload.eventType,
        url: payload.url,
        screenshotPath: relativeScreenshotPath,
        targetTag: payload.targetTag,
        targetText: payload.targetText,
        clickX: payload.clickX,
        clickY: payload.clickY,
        inputValue: payload.inputValue,
        inputName: payload.inputName,
        inputLabel: payload.inputLabel,
        inputType: payload.inputType,
      };

      // Add to session store (classification happens at finalization)
      sessionStore.addEvent(payload.sessionId, event);

      res.json({
        status: "ok",
        eventType: payload.eventType,
        eventCount: sessionStore.getEvents(payload.sessionId).length,
      });
    } catch (error) {
      console.error("Ingest error:", error);
      res.status(500).json({ error: "Failed to ingest event" });
    }
  });

  // Finalize session - runs the full pipeline
  app.post("/finalize-session", async (req, res) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        res.status(400).json({ error: "Missing sessionId" });
        return;
      }

      // Get session state
      const session = sessionStore.get(sessionId);
      if (!session || session.events.length === 0) {
        sessionStore.delete(sessionId);
        res.json({
          ok: true,
          message: "No events to process",
          screens: [],
          templates: [],
          instances: [],
        });
        return;
      }

      console.log(
        `[Finalize] Processing session ${sessionId} with ${session.events.length} events`
      );

      // Run the finalization pipeline
      const result = await runFinalizationPipeline(sessionId, session.events);

      // Clean up session from memory
      sessionStore.delete(sessionId);

      res.json({
        ok: true,
        screens: result.screens.length,
        templates: result.templates.length,
        instances: result.instances.length,
        data: result,
      });
    } catch (error) {
      console.error("Finalize error:", error);
      res.status(500).json({ error: "Failed to finalize session" });
    }
  });

  // Get all templates with their instances
  app.get("/templates", (_, res) => {
    try {
      const templates = getTemplatesWithInstances();
      res.json(templates);
    } catch (error) {
      console.error("Get templates error:", error);
      res.status(500).json({ error: "Failed to get templates" });
    }
  });

  // Get all canonical screens
  app.get("/screens", (_, res) => {
    try {
      const screens = getAllCanonicalScreens();
      res.json(screens);
    } catch (error) {
      console.error("Get screens error:", error);
      res.status(500).json({ error: "Failed to get screens" });
    }
  });

  // Reset database - clears all data
  app.post("/reset", (_, res) => {
    try {
      clearAllData();
      sessionStore.clear();
      res.json({ ok: true, message: "All data cleared" });
    } catch (error) {
      console.error("Reset error:", error);
      res.status(500).json({ error: "Failed to reset database" });
    }
  });

  return app;
}
