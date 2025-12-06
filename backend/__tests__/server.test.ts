import request from "supertest";
import path from "path";
import fs from "fs";
import { initDb, closeDb, insertRefinedWorkflow } from "../db";
import { createApp } from "../server";
import { sessionStore } from "../sessionStore";

// Mock the classifier module
jest.mock("../classifier", () => ({
  classifyInteraction: jest.fn().mockResolvedValue({
    significant: true,
    screen: {
      isNew: true,
      label: "Test Screen",
      description: "A test screen",
    },
    action: "Clicked a button",
  }),
  extractUrlPattern: jest.fn().mockReturnValue("/test"),
}));

// Mock workflow refiner
jest.mock("../workflowRefiner", () => ({
  refineWorkflows: jest.fn().mockResolvedValue([
    {
      name: "Test Workflow",
      description: "A test workflow",
      steps: [{ screenId: "scr_test", screenLabel: "Dashboard", action: "Clicked button", screenshotPath: "test.png" }],
    },
  ]),
}));

const TEST_DB_PATH = path.join(__dirname, `test-server-${Date.now()}.db`);
const TEST_SCREENSHOTS_DIR = path.join(__dirname, "..", "..", "storage", "screenshots-test");

describe("Server", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    // Create test screenshots directory
    if (!fs.existsSync(TEST_SCREENSHOTS_DIR)) {
      fs.mkdirSync(TEST_SCREENSHOTS_DIR, { recursive: true });
    }
    await initDb(TEST_DB_PATH);
    app = createApp();
  });

  afterAll(async () => {
    await closeDb();
    // Clean up
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    if (fs.existsSync(TEST_SCREENSHOTS_DIR)) {
      fs.rmSync(TEST_SCREENSHOTS_DIR, { recursive: true });
    }
  });

  beforeEach(() => {
    // Clear session store between tests
    sessionStore.clear();
  });

  describe("GET /health", () => {
    it("should return ok status", async () => {
      const response = await request(app).get("/health");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
    });
  });

  describe("POST /ingest", () => {
    // Tiny valid PNG (1x1 pixel, transparent)
    const tinyPNG =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    it("should return 400 if payload is missing", async () => {
      const response = await request(app)
        .post("/ingest")
        .send({ screenshot: tinyPNG });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Missing");
    });

    it("should return 400 if screenshot is missing", async () => {
      const response = await request(app).post("/ingest").send({
        payload: {
          sessionId: "test",
          timestamp: Date.now(),
          url: "https://example.com",
          eventType: "click",
        },
      });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Missing");
    });

    it("should store event and return ok", async () => {
      const sessionId = `ingest-test-${Date.now()}`;
      const timestamp = Date.now();

      const response = await request(app)
        .post("/ingest")
        .send({
          payload: {
            sessionId,
            timestamp,
            url: "https://example.com/page",
            eventType: "click",
            x: 100,
            y: 200,
          },
          screenshot: tinyPNG,
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");
      expect(response.body.significant).toBe(true);

      // Verify screenshot was saved
      const screenshotPath = path.join(
        __dirname,
        "..",
        "..",
        "storage",
        "screenshots",
        `${timestamp}.png`
      );
      expect(fs.existsSync(screenshotPath)).toBe(true);

      // Clean up
      if (fs.existsSync(screenshotPath)) {
        fs.unlinkSync(screenshotPath);
      }
    });
  });

  describe("POST /finalize-session", () => {
    it("should return 400 if sessionId is missing", async () => {
      const response = await request(app).post("/finalize-session").send({});
      expect(response.status).toBe(400);
      expect(response.body.error).toContain("sessionId");
    });

    it("should return empty arrays for session with no events", async () => {
      const response = await request(app)
        .post("/finalize-session")
        .send({ sessionId: "empty-session-xyz" });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.raw).toEqual([]);
      expect(response.body.refined).toEqual([]);
    });

    it("should finalize session with events", async () => {
      const sessionId = `finalize-test-${Date.now()}`;
      
      // Create a session with events directly via sessionStore
      const session = sessionStore.getOrCreate(sessionId);
      
      // Add screens
      const dashScreen = sessionStore.addScreen(sessionId, {
        label: "Dashboard",
        description: "Main dashboard",
        urlPattern: "/dashboard",
        exampleScreenshotPath: "test-dash.png",
      });
      const pageAScreen = sessionStore.addScreen(sessionId, {
        label: "Page A",
        description: "Page A",
        urlPattern: "/page-a",
        exampleScreenshotPath: "test-a.png",
      });

      // Add events - Dashboard (base) -> Page A -> Dashboard
      sessionStore.addEvent(sessionId, {
        timestamp: Date.now(),
        url: "https://example.com/dashboard",
        screenId: dashScreen.id,
        actionSummary: "Start",
        screenshotPath: "test-0.png",
      });
      sessionStore.addEvent(sessionId, {
        timestamp: Date.now() + 1,
        url: "https://example.com/dashboard",
        screenId: dashScreen.id,
        actionSummary: "Stay",
        screenshotPath: "test-1.png",
      });
      sessionStore.addEvent(sessionId, {
        timestamp: Date.now() + 2,
        url: "https://example.com/page-a",
        screenId: pageAScreen.id,
        actionSummary: "Navigate",
        screenshotPath: "test-2.png",
      });
      sessionStore.addEvent(sessionId, {
        timestamp: Date.now() + 3,
        url: "https://example.com/dashboard",
        screenId: dashScreen.id,
        actionSummary: "Return",
        screenshotPath: "test-3.png",
      });

      const response = await request(app)
        .post("/finalize-session")
        .send({ sessionId });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.refined).toHaveLength(1);
      expect(response.body.refined[0].name).toBe("Test Workflow");
    });
  });

  describe("GET /workflows", () => {
    it("should return all refined workflows", async () => {
      // Insert a test workflow directly
      const sessionId = `workflows-test-${Date.now()}`;
      await insertRefinedWorkflow(sessionId, {
        name: "Direct Insert Workflow",
        description: "Inserted directly for testing",
        steps: [{ screenId: "scr_test", screenLabel: "Test", action: "Test action", screenshotPath: "test.png" }],
      });

      const response = await request(app).get("/workflows");

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Find our inserted workflow
      const found = response.body.find(
        (w: any) => w.refinedJson.name === "Direct Insert Workflow"
      );
      expect(found).toBeDefined();
      expect(found.refinedJson.description).toBe(
        "Inserted directly for testing"
      );
    });
  });

  describe("GET /session-stats", () => {
    it("should return session statistics", async () => {
      const response = await request(app).get("/session-stats");
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("activeSessions");
      expect(response.body).toHaveProperty("sessions");
    });
  });
});
