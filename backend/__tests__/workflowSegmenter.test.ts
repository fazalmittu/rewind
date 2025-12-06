import path from "path";
import fs from "fs";
import { initDb, closeDb, insertEvent } from "../db";
import { segmentWorkflows } from "../workflowSegmenter";

const TEST_DB_PATH = path.join(__dirname, `test-segmenter-${Date.now()}.db`);

describe("workflowSegmenter", () => {
  beforeAll(async () => {
    await initDb(TEST_DB_PATH);
  });

  afterAll(async () => {
    await closeDb();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe("segmentWorkflows", () => {
    it("should return empty array for empty session", async () => {
      const workflows = await segmentWorkflows("empty-session");
      expect(workflows).toEqual([]);
    });

    it("should return empty array for session with only one event", async () => {
      const sessionId = "single-event-session";
      await insertEvent({
        sessionId,
        timestamp: Date.now(),
        url: "https://example.com",
        eventType: "click",
        screenshotPath: "test.png",
        actionSummary: "Click",
        screenSummary: "Dashboard",
      });

      const workflows = await segmentWorkflows(sessionId);
      expect(workflows).toEqual([]);
    });

    it("should identify base screens as top 2 most frequent labels", async () => {
      const sessionId = "base-screen-test";
      const now = Date.now();

      // Dashboard appears 5 times (base screen)
      // Home appears 3 times (base screen)
      // Settings appears 2 times (not base)
      // Profile appears 1 time (not base)
      const screens = [
        "Dashboard",
        "Dashboard",
        "Settings",
        "Dashboard",
        "Home",
        "Profile",
        "Home",
        "Dashboard",
        "Home",
        "Dashboard",
        "Settings",
      ];

      for (let i = 0; i < screens.length; i++) {
        await insertEvent({
          sessionId,
          timestamp: now + i,
          url: "https://example.com",
          eventType: "click",
          screenshotPath: `${i}.png`,
          actionSummary: `Action ${i}`,
          screenSummary: screens[i],
        });
      }

      const workflows = await segmentWorkflows(sessionId);
      // Workflows should capture transitions away from Dashboard/Home
      expect(workflows.length).toBeGreaterThan(0);
    });

    it("should segment workflows based on base screens", async () => {
      const sessionId = "segmentation-test";
      const now = Date.now();

      // Simulate a clear workflow pattern:
      // Dashboard (base) -> Patient List -> New Form -> Dashboard (base)
      // Dashboard (base) -> Settings -> Dashboard (base)
      const screens = [
        "Dashboard", // base
        "Patient List", // leave base - start workflow 1
        "New Patient Form",
        "Patient Profile",
        "Dashboard", // return to base - end workflow 1
        "Dashboard", // base (duplicate)
        "Settings", // leave base - start workflow 2
        "Dashboard", // return to base - end workflow 2
      ];

      for (let i = 0; i < screens.length; i++) {
        await insertEvent({
          sessionId,
          timestamp: now + i,
          url: "https://example.com",
          eventType: "click",
          screenshotPath: `${i}.png`,
          actionSummary: `Action ${i}`,
          screenSummary: screens[i],
        });
      }

      const workflows = await segmentWorkflows(sessionId);

      // Should detect 2 workflows
      expect(workflows.length).toBe(2);

      // First workflow: Patient List -> New Patient Form -> Patient Profile
      expect(workflows[0].steps.length).toBe(3);
      expect(workflows[0].steps[0].screen).toBe("Patient List");

      // Second workflow: Settings
      expect(workflows[1].steps.length).toBe(1);
      expect(workflows[1].steps[0].screen).toBe("Settings");
    });

    it("should end workflow when loop is detected", async () => {
      const sessionId = "loop-detection-test";
      const now = Date.now();

      // Dashboard (base, appears 5x) -> A -> B -> C -> B (loop!) should end workflow
      // Use different screens that only appear once each, except the looping one
      const screens = [
        "Dashboard",
        "Dashboard",
        "Dashboard",
        "Step One", // leave base - start workflow
        "Step Two",
        "Step Three",
        "Step Two", // loop detected (Step Two repeated) - should end workflow
        "Dashboard",
        "Dashboard",
      ];

      for (let i = 0; i < screens.length; i++) {
        await insertEvent({
          sessionId,
          timestamp: now + i,
          url: "https://example.com",
          eventType: "click",
          screenshotPath: `${i}.png`,
          actionSummary: `Action ${i}`,
          screenSummary: screens[i],
        });
      }

      const workflows = await segmentWorkflows(sessionId);

      // First workflow should end at the loop, including the repeated screen
      expect(workflows.length).toBeGreaterThanOrEqual(1);
      // The workflow captures: Step One, Step Two, Step Three, Step Two (loop trigger)
      expect(workflows[0].steps.length).toBe(4);
      expect(workflows[0].steps.map(s => s.screen)).toEqual([
        "Step One",
        "Step Two", 
        "Step Three",
        "Step Two", // Loop trigger included
      ]);
    });

    it("should handle complex multi-workflow sessions", async () => {
      const sessionId = "complex-session";
      const now = Date.now();

      // More realistic workflow:
      // Dashboard -> Patient List -> View Patient -> Edit -> Dashboard
      // Dashboard -> Reports -> Export -> Dashboard
      // Dashboard -> Settings -> Preferences -> Dashboard
      const screens = [
        "Dashboard", // base
        "Patient List", // workflow 1 starts
        "Patient Details",
        "Edit Patient",
        "Dashboard", // workflow 1 ends
        "Reports", // workflow 2 starts
        "Export Dialog",
        "Dashboard", // workflow 2 ends
        "Dashboard", // base (stays)
        "Settings", // workflow 3 starts
        "Preferences",
        "Dashboard", // workflow 3 ends
      ];

      for (let i = 0; i < screens.length; i++) {
        await insertEvent({
          sessionId,
          timestamp: now + i,
          url: "https://example.com",
          eventType: "click",
          screenshotPath: `${i}.png`,
          actionSummary: `Action ${i}`,
          screenSummary: screens[i],
        });
      }

      const workflows = await segmentWorkflows(sessionId);

      expect(workflows.length).toBe(3);

      // Workflow 1: Patient List -> Patient Details -> Edit Patient
      expect(workflows[0].steps.map((s) => s.screen)).toEqual([
        "Patient List",
        "Patient Details",
        "Edit Patient",
      ]);

      // Workflow 2: Reports -> Export Dialog
      expect(workflows[1].steps.map((s) => s.screen)).toEqual([
        "Reports",
        "Export Dialog",
      ]);

      // Workflow 3: Settings -> Preferences
      expect(workflows[2].steps.map((s) => s.screen)).toEqual([
        "Settings",
        "Preferences",
      ]);
    });

    it("should save incomplete workflow if session ends mid-workflow", async () => {
      const sessionId = "incomplete-workflow-test";
      const now = Date.now();

      // Dashboard -> Settings -> (session ends without returning)
      const screens = ["Dashboard", "Settings", "Advanced Settings"];

      for (let i = 0; i < screens.length; i++) {
        await insertEvent({
          sessionId,
          timestamp: now + i,
          url: "https://example.com",
          eventType: "click",
          screenshotPath: `${i}.png`,
          actionSummary: `Action ${i}`,
          screenSummary: screens[i],
        });
      }

      const workflows = await segmentWorkflows(sessionId);

      // Should still capture the incomplete workflow
      expect(workflows.length).toBe(1);
      expect(workflows[0].steps.length).toBe(2);
    });
  });
});

