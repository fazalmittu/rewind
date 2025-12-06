import express, { Express } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import livereload from "livereload";
import connectLivereload from "connect-livereload";
import {
  insertEvent,
  insertRawWorkflow,
  insertRefinedWorkflow,
  insertWorkflowMapping,
  getAllRefinedWorkflows,
  insertScreens,
  insertSessionEvents,
  clearAllData,
} from "./db";
import { sessionStore } from "./sessionStore";
import { classifyInteraction, extractUrlPattern } from "./classifier";
import { segmentWorkflows } from "./workflowSegmenter";
import { refineWorkflows } from "./workflowRefiner";
import { IngestRequest, SessionEvent } from "./types";

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // Live reload in development
  if (process.env.NODE_ENV !== "production") {
    const liveReloadServer = livereload.createServer();
    liveReloadServer.watch(path.join(__dirname, "..", "frontend"));
    liveReloadServer.server.once("connection", () => {
      setTimeout(() => {
        liveReloadServer.refresh("/");
      }, 100);
    });
    app.use(connectLivereload());
    console.log("[LiveReload] Watching frontend/ for changes");
  }

  // Serve frontend static files
  app.use("/", express.static(path.join(__dirname, "..", "frontend")));

  // Serve screenshots
  app.use("/screenshots", express.static(path.join(__dirname, "..", "storage", "screenshots")));

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
      screenCount: session.knownScreens.length,
      eventCount: session.events.length,
      screens: session.knownScreens,
      createdAt: session.createdAt,
    });
  });

  // Ingest endpoint - receives click events + screenshots from extension
  app.post("/ingest", async (req, res) => {
    try {
      const { payload, screenshot } = req.body as IngestRequest;

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
      const relativeScreenshotPath = `storage/screenshots/${fileName}`;
      const base64Data = screenshot.replace(/^data:image\/png;base64,/, "");
      fs.writeFileSync(screenshotPath, base64Data, "base64");

      // Get or create session state
      const session = sessionStore.getOrCreate(payload.sessionId);

      // Get previous state for comparison
      const previousScreenId = session.lastScreenId;
      const previousScreenLabel = previousScreenId
        ? sessionStore.getScreenById(payload.sessionId, previousScreenId)?.label || null
        : null;

      // Classify this interaction
      const classification = await classifyInteraction({
        previousScreenshotPath: session.lastScreenshotPath,
        currentScreenshotPath: screenshotPath,
        previousUrl: session.lastUrl,
        currentUrl: payload.url,
        previousScreenId,
        previousScreenLabel,
        knownScreens: session.knownScreens,
        clickX: payload.x,
        clickY: payload.y,
      });

      console.log(`[Ingest] Classification result:`, JSON.stringify(classification, null, 2));

      // Always update last screenshot (even for non-significant clicks)
      sessionStore.updateLastScreenshot(payload.sessionId, screenshotPath, payload.url);

      if (!classification.significant) {
        // Non-significant click - don't record as event
        console.log(`[Ingest] Non-significant click: ${classification.reason}`);
        res.json({ 
          status: "ok", 
          significant: false, 
          reason: classification.reason 
        });
        return;
      }

      // Significant click - determine screen
      let screenId: string;
      let screenLabel: string;

      if (classification.screen!.isNew) {
        // New screen - add to session
        const newScreen = sessionStore.addScreen(payload.sessionId, {
          label: classification.screen!.label!,
          description: classification.screen!.description!,
          urlPattern: extractUrlPattern(payload.url),
          exampleScreenshotPath: relativeScreenshotPath,
        });
        screenId = newScreen.id;
        screenLabel = newScreen.label;
      } else {
        // Existing screen - increment count
        screenId = classification.screen!.matchedScreenId!;
        sessionStore.incrementScreenCount(payload.sessionId, screenId);
        screenLabel = sessionStore.getScreenById(payload.sessionId, screenId)?.label || "Unknown";
      }

      // Create and store event
      const event: SessionEvent = {
        timestamp: payload.timestamp,
        url: payload.url,
        screenId,
        actionSummary: classification.action!,
        screenshotPath: relativeScreenshotPath,
        clickX: payload.x,
        clickY: payload.y,
      };

      sessionStore.addEvent(payload.sessionId, event);

      res.json({ 
        status: "ok", 
        significant: true,
        screenId,
        screenLabel,
        action: classification.action,
        isNewScreen: classification.screen!.isNew,
      });
    } catch (error) {
      console.error("Ingest error:", error);
      res.status(500).json({ error: "Failed to ingest event" });
    }
  });

  // Finalize session - persists to DB, segments and refines workflows
  app.post("/finalize-session", async (req, res) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        res.status(400).json({ error: "Missing sessionId" });
        return;
      }

      // Get session state
      const session = sessionStore.get(sessionId);
      if (!session) {
        res.json({ ok: true, raw: [], refined: [], message: "No active session found" });
        return;
      }

      if (session.events.length === 0) {
        sessionStore.delete(sessionId);
        res.json({ ok: true, raw: [], refined: [], message: "Session had no events" });
        return;
      }

      console.log(`[Finalize] Session ${sessionId}: ${session.events.length} events, ${session.knownScreens.length} screens`);

      // Persist screens to database
      await insertScreens(session.knownScreens, sessionId);

      // Persist events to database
      await insertSessionEvents(session.events, sessionId);

      // Segment workflows using the session data
      const raw = await segmentWorkflows(sessionId, session);

      if (raw.length === 0) {
        sessionStore.delete(sessionId);
        res.json({ ok: true, raw: [], refined: [], message: "No workflows detected" });
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
      const refinedIds: number[] = [];
      for (const workflow of refined) {
        const id = await insertRefinedWorkflow(sessionId, workflow);
        refinedIds.push(id);
      }

      // Create mappings
      for (const rawId of rawIds) {
        for (const refinedId of refinedIds) {
          await insertWorkflowMapping(rawId, refinedId);
        }
      }

      // Clean up session from memory
      sessionStore.delete(sessionId);

      res.json({ 
        ok: true, 
        raw, 
        refined,
        screensCount: session.knownScreens.length,
        eventsCount: session.events.length,
      });
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

  // Reset database - clears all data
  app.post("/reset", async (_, res) => {
    try {
      await clearAllData();
      // Also clear any active sessions from memory
      sessionStore.clear();
      res.json({ ok: true, message: "All data cleared" });
    } catch (error) {
      console.error("Reset error:", error);
      res.status(500).json({ error: "Failed to reset database" });
    }
  });

  return app;
}
