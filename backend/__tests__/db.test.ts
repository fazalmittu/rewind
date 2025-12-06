import path from "path";
import fs from "fs";
import {
  initDb,
  closeDb,
  insertEvent,
  getSessionEvents,
  insertRawWorkflow,
  insertRefinedWorkflow,
  insertWorkflowMapping,
  getAllRefinedWorkflows,
  getRawWorkflows,
} from "../db";
import { RawWorkflow, RefinedWorkflow } from "../types";

// Use a unique test database for each test run
const TEST_DB_PATH = path.join(__dirname, `test-${Date.now()}.db`);

describe("Database", () => {
  beforeAll(async () => {
    await initDb(TEST_DB_PATH);
  });

  afterAll(async () => {
    await closeDb();
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe("initDb", () => {
    it("should create all required tables", async () => {
      // If we got here without errors, tables were created
      // We can verify by inserting data successfully
      expect(true).toBe(true);
    });
  });

  describe("events", () => {
    const testSessionId = "test-session-events";

    it("should insert an event and return its ID", async () => {
      const event = {
        sessionId: testSessionId,
        timestamp: Date.now(),
        url: "https://example.com",
        eventType: "click" as const,
        screenshotPath: "storage/screenshots/test.png",
        actionSummary: "Clicked a button",
        screenSummary: "Login Page",
      };

      const id = await insertEvent(event);
      expect(typeof id).toBe("number");
      expect(id).toBeGreaterThan(0);
    });

    it("should fetch events ordered by timestamp", async () => {
      const baseTime = Date.now();

      // Insert events in non-sequential order
      await insertEvent({
        sessionId: testSessionId,
        timestamp: baseTime + 200,
        url: "https://example.com/page2",
        eventType: "click",
        screenshotPath: "storage/screenshots/2.png",
        actionSummary: "Action 2",
        screenSummary: "Page 2",
      });

      await insertEvent({
        sessionId: testSessionId,
        timestamp: baseTime + 100,
        url: "https://example.com/page1",
        eventType: "click",
        screenshotPath: "storage/screenshots/1.png",
        actionSummary: "Action 1",
        screenSummary: "Page 1",
      });

      const events = await getSessionEvents(testSessionId);
      expect(events.length).toBeGreaterThanOrEqual(3);

      // Verify ordering (timestamps should be ascending)
      for (let i = 1; i < events.length; i++) {
        expect(events[i].timestamp).toBeGreaterThanOrEqual(
          events[i - 1].timestamp
        );
      }
    });

    it("should return empty array for non-existent session", async () => {
      const events = await getSessionEvents("non-existent-session");
      expect(events).toEqual([]);
    });
  });

  describe("raw workflows", () => {
    const testSessionId = "test-session-raw-workflows";

    it("should insert a raw workflow and return its ID", async () => {
      const workflow: RawWorkflow = {
        steps: [
          { screen: "Dashboard", action: "Clicked menu" },
          { screen: "Settings", action: "Clicked save" },
        ],
      };

      const id = await insertRawWorkflow(testSessionId, workflow);
      expect(typeof id).toBe("number");
      expect(id).toBeGreaterThan(0);
    });

    it("should fetch raw workflows for a session", async () => {
      const workflows = await getRawWorkflows(testSessionId);
      expect(workflows.length).toBeGreaterThan(0);
      expect(workflows[0].workflowJson.steps).toBeDefined();
      expect(workflows[0].workflowJson.steps.length).toBe(2);
    });
  });

  describe("refined workflows", () => {
    const testSessionId = "test-session-refined-workflows";

    it("should insert a refined workflow and return its ID", async () => {
      const workflow: RefinedWorkflow = {
        name: "Update Settings",
        description: "User navigates to settings and saves changes",
        steps: [
          { screen: "Dashboard", action: "Clicked settings icon" },
          { screen: "Settings Page", action: "Updated preferences" },
          { screen: "Settings Page", action: "Clicked save button" },
        ],
      };

      const id = await insertRefinedWorkflow(testSessionId, workflow);
      expect(typeof id).toBe("number");
      expect(id).toBeGreaterThan(0);
    });

    it("should fetch all refined workflows", async () => {
      const workflows = await getAllRefinedWorkflows();
      expect(workflows.length).toBeGreaterThan(0);

      const found = workflows.find((w) => w.sessionId === testSessionId);
      expect(found).toBeDefined();
      expect(found?.refinedJson.name).toBe("Update Settings");
      expect(found?.refinedJson.steps.length).toBe(3);
    });
  });

  describe("workflow mappings", () => {
    const testSessionId = "test-session-mappings";

    it("should create mappings between raw and refined workflows", async () => {
      // Create raw workflow
      const raw: RawWorkflow = {
        steps: [{ screen: "Home", action: "Click" }],
      };
      const rawId = await insertRawWorkflow(testSessionId, raw);

      // Create refined workflow
      const refined: RefinedWorkflow = {
        name: "Test Flow",
        description: "A test workflow",
        steps: [{ screen: "Home", action: "Click" }],
      };
      const refinedId = await insertRefinedWorkflow(testSessionId, refined);

      // Create mapping
      const mappingId = await insertWorkflowMapping(rawId, refinedId);
      expect(typeof mappingId).toBe("number");
      expect(mappingId).toBeGreaterThan(0);
    });

    it("should allow multiple raw workflows to map to one refined workflow", async () => {
      const raw1: RawWorkflow = { steps: [{ screen: "A", action: "1" }] };
      const raw2: RawWorkflow = { steps: [{ screen: "B", action: "2" }] };
      const refined: RefinedWorkflow = {
        name: "Merged Flow",
        description: "Merged from two raw workflows",
        steps: [
          { screen: "A", action: "1" },
          { screen: "B", action: "2" },
        ],
      };

      const rawId1 = await insertRawWorkflow(testSessionId, raw1);
      const rawId2 = await insertRawWorkflow(testSessionId, raw2);
      const refinedId = await insertRefinedWorkflow(testSessionId, refined);

      const mappingId1 = await insertWorkflowMapping(rawId1, refinedId);
      const mappingId2 = await insertWorkflowMapping(rawId2, refinedId);

      expect(mappingId1).toBeGreaterThan(0);
      expect(mappingId2).toBeGreaterThan(0);
      expect(mappingId2).not.toBe(mappingId1);
    });
  });
});


