import request from "supertest";
import { createApp } from "../server";
import { initDb, closeDb, clearAllData, insertWorkflowTemplate, insertWorkflowInstance } from "../db";
import { sessionStore } from "../sessionStore";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(__dirname, "server-test.db");
const TEST_SCREENSHOTS_DIR = path.join(__dirname, "..", "..", "storage", "screenshots");

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  await initDb(TEST_DB_PATH);
  app = createApp();
  
  // Ensure screenshots directory exists
  if (!fs.existsSync(TEST_SCREENSHOTS_DIR)) {
    fs.mkdirSync(TEST_SCREENSHOTS_DIR, { recursive: true });
  }
});

afterAll(async () => {
  await closeDb();
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

beforeEach(async () => {
  await clearAllData();
  sessionStore.clear();
});

describe("GET /health", () => {
  it("should return ok status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("GET /session-stats", () => {
  it("should return empty stats initially", async () => {
    const res = await request(app).get("/session-stats");
    expect(res.status).toBe(200);
    expect(res.body.activeSessions).toBe(0);
    expect(res.body.sessions).toHaveLength(0);
  });
});

describe("POST /ingest", () => {
  it("should ingest an event", async () => {
    // Create a minimal valid base64 PNG (1x1 transparent pixel)
    const minimalPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const res = await request(app)
      .post("/ingest")
      .send({
        payload: {
          sessionId: "test-session-123",
          timestamp: Date.now(),
          url: "https://example.com/test",
          eventType: "click",
          targetTag: "button",
          targetText: "Add to Cart",
          clickX: 100,
          clickY: 200,
        },
        screenshot: minimalPng,
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.eventType).toBe("click");
    expect(res.body.eventCount).toBe(1);
  });

  it("should ingest input events", async () => {
    const minimalPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const res = await request(app)
      .post("/ingest")
      .send({
        payload: {
          sessionId: "test-session-456",
          timestamp: Date.now(),
          url: "https://example.com/search",
          eventType: "input",
          targetTag: "input",
          inputValue: "iPad Pro",
          inputName: "search",
          inputLabel: "Search",
          inputType: "text",
        },
        screenshot: minimalPng,
      });

    expect(res.status).toBe(200);
    expect(res.body.eventType).toBe("input");
  });

  it("should reject missing payload", async () => {
    const res = await request(app)
      .post("/ingest")
      .send({ screenshot: "data:image/png;base64,abc" });

    expect(res.status).toBe(400);
  });

  it("should reject missing screenshot", async () => {
    const res = await request(app)
      .post("/ingest")
      .send({ payload: { sessionId: "test" } });

    expect(res.status).toBe(400);
  });
});

describe("GET /session/:sessionId", () => {
  it("should return 404 for non-existent session", async () => {
    const res = await request(app).get("/session/non-existent");
    expect(res.status).toBe(404);
  });

  it("should return session info for existing session", async () => {
    // First ingest an event to create a session
    const minimalPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    await request(app)
      .post("/ingest")
      .send({
        payload: {
          sessionId: "session-to-get",
          timestamp: Date.now(),
          url: "https://example.com",
          eventType: "click",
          targetTag: "button",
        },
        screenshot: minimalPng,
      });

    const res = await request(app).get("/session/session-to-get");
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe("session-to-get");
    expect(res.body.eventCount).toBe(1);
  });
});

describe("GET /templates", () => {
  it("should return empty array when no templates", async () => {
    const res = await request(app).get("/templates");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("should return templates with instances", async () => {
    const template = {
      id: "tmpl_test",
      name: "Test Template",
      description: "A test template",
      inputs: {},
      outputs: {},
      steps: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await insertWorkflowTemplate(template);

    await insertWorkflowInstance({
      id: "inst_test",
      templateId: template.id,
      sessionId: "sess_test",
      parameterValues: { query: "test" },
      extractedValues: {},
      stepSnapshots: [],
      createdAt: Date.now(),
    });

    const res = await request(app).get("/templates");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Test Template");
    expect(res.body[0].instances).toHaveLength(1);
  });
});

describe("POST /finalize-session", () => {
  it("should return ok for empty session", async () => {
    const res = await request(app)
      .post("/finalize-session")
      .send({ sessionId: "empty-session" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.message).toBe("No events to process");
  });

  it("should reject missing sessionId", async () => {
    const res = await request(app)
      .post("/finalize-session")
      .send({});

    expect(res.status).toBe(400);
  });
});

describe("POST /reset", () => {
  it("should clear all data", async () => {
    // Insert some data first
    await insertWorkflowTemplate({
      id: "tmpl_to_delete",
      name: "To Delete",
      description: "Will be deleted",
      inputs: {},
      outputs: {},
      steps: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const beforeReset = await request(app).get("/templates");
    expect(beforeReset.body).toHaveLength(1);

    const res = await request(app).post("/reset");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const afterReset = await request(app).get("/templates");
    expect(afterReset.body).toHaveLength(0);
  });
});

describe("GET /screens", () => {
  it("should return empty array when no screens", async () => {
    const res = await request(app).get("/screens");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

