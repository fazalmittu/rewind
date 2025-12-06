import { segmentWorkflows } from "../workflowSegmenter";
import { SessionState, SessionEvent, KnownScreen } from "../types";

/**
 * Helper to create a session state for testing.
 */
function createTestSession(
  sessionId: string,
  screens: Array<{ id: string; label: string }>,
  eventScreenIds: string[]
): SessionState {
  const knownScreens: KnownScreen[] = screens.map((s) => ({
    id: s.id,
    label: s.label,
    description: `${s.label} screen`,
    urlPattern: `/${s.label.toLowerCase().replace(/\s+/g, "-")}`,
    exampleScreenshotPath: `screenshots/${s.id}.png`,
    seenCount: eventScreenIds.filter((id) => id === s.id).length,
  }));

  const events: SessionEvent[] = eventScreenIds.map((screenId, i) => ({
    timestamp: Date.now() + i,
    url: `https://example.com/${screenId}`,
    screenId,
    actionSummary: `Action ${i}`,
    screenshotPath: `screenshots/${i}.png`,
  }));

  return {
    sessionId,
    knownScreens,
    events,
    lastScreenshotPath: events.length > 0 ? events[events.length - 1].screenshotPath : null,
    lastScreenId: events.length > 0 ? events[events.length - 1].screenId : null,
    lastUrl: events.length > 0 ? events[events.length - 1].url : null,
    createdAt: Date.now(),
  };
}

describe("workflowSegmenter", () => {
  describe("segmentWorkflows", () => {
    it("should return empty array for empty session", async () => {
      const session = createTestSession("empty-session", [], []);
      const workflows = await segmentWorkflows("empty-session", session);
      expect(workflows).toEqual([]);
    });

    it("should return empty array for session with only one event", async () => {
      const session = createTestSession(
        "single-event",
        [{ id: "scr_dash", label: "Dashboard" }],
        ["scr_dash"]
      );
      const workflows = await segmentWorkflows("single-event", session);
      expect(workflows).toEqual([]);
    });

    it("should identify base screens as top 2 most frequent screen IDs", async () => {
      // Dashboard appears 5 times (base screen)
      // Home appears 3 times (potential base screen)
      // Settings appears 2 times (not base)
      const screens = [
        { id: "scr_dash", label: "Dashboard" },
        { id: "scr_home", label: "Home" },
        { id: "scr_settings", label: "Settings" },
        { id: "scr_profile", label: "Profile" },
      ];
      const eventScreenIds = [
        "scr_dash",
        "scr_dash",
        "scr_settings",
        "scr_dash",
        "scr_home",
        "scr_profile",
        "scr_home",
        "scr_dash",
        "scr_home",
        "scr_dash",
        "scr_settings",
      ];

      const session = createTestSession("base-screen-test", screens, eventScreenIds);
      const workflows = await segmentWorkflows("base-screen-test", session);
      
      // Workflows should capture transitions away from Dashboard/Home
      expect(workflows.length).toBeGreaterThan(0);
    });

    it("should segment workflows based on base screens", async () => {
      // Dashboard (base) -> Patient List -> New Form -> Patient Profile -> Dashboard
      // Dashboard -> Settings -> Dashboard
      const screens = [
        { id: "scr_dash", label: "Dashboard" },
        { id: "scr_patients", label: "Patient List" },
        { id: "scr_newform", label: "New Patient Form" },
        { id: "scr_profile", label: "Patient Profile" },
        { id: "scr_settings", label: "Settings" },
      ];
      const eventScreenIds = [
        "scr_dash",      // base
        "scr_patients",  // leave base - start workflow 1
        "scr_newform",
        "scr_profile",
        "scr_dash",      // return to base - end workflow 1
        "scr_dash",      // base (duplicate)
        "scr_settings",  // leave base - start workflow 2
        "scr_dash",      // return to base - end workflow 2
      ];

      const session = createTestSession("segmentation-test", screens, eventScreenIds);
      const workflows = await segmentWorkflows("segmentation-test", session);

      // Should detect 2 workflows
      expect(workflows.length).toBe(2);

      // First workflow: Patient List -> New Patient Form -> Patient Profile
      expect(workflows[0].steps.length).toBe(3);
      expect(workflows[0].steps[0].screenLabel).toBe("Patient List");

      // Second workflow: Settings
      expect(workflows[1].steps.length).toBe(1);
      expect(workflows[1].steps[0].screenLabel).toBe("Settings");
    });

    it("should end workflow when loop is detected", async () => {
      // Dashboard (base, appears 5x) -> Step One -> Step Two -> Step Three -> Step Two (loop!)
      const screens = [
        { id: "scr_dash", label: "Dashboard" },
        { id: "scr_one", label: "Step One" },
        { id: "scr_two", label: "Step Two" },
        { id: "scr_three", label: "Step Three" },
      ];
      const eventScreenIds = [
        "scr_dash",
        "scr_dash",
        "scr_dash",
        "scr_one",    // leave base - start workflow
        "scr_two",
        "scr_three",
        "scr_two",    // loop detected - should end workflow
        "scr_dash",
        "scr_dash",
      ];

      const session = createTestSession("loop-detection-test", screens, eventScreenIds);
      const workflows = await segmentWorkflows("loop-detection-test", session);

      // First workflow should end at the loop, including the repeated screen
      expect(workflows.length).toBeGreaterThanOrEqual(1);
      expect(workflows[0].steps.length).toBe(4);
      expect(workflows[0].steps.map((s) => s.screenLabel)).toEqual([
        "Step One",
        "Step Two",
        "Step Three",
        "Step Two", // Loop trigger included
      ]);
    });

    it("should handle complex multi-workflow sessions", async () => {
      // Dashboard -> Patient List -> Patient Details -> Edit Patient -> Dashboard
      // Dashboard -> Reports -> Export Dialog -> Dashboard
      // Dashboard -> Settings -> Preferences -> Dashboard
      const screens = [
        { id: "scr_dash", label: "Dashboard" },
        { id: "scr_patients", label: "Patient List" },
        { id: "scr_details", label: "Patient Details" },
        { id: "scr_edit", label: "Edit Patient" },
        { id: "scr_reports", label: "Reports" },
        { id: "scr_export", label: "Export Dialog" },
        { id: "scr_settings", label: "Settings" },
        { id: "scr_prefs", label: "Preferences" },
      ];
      const eventScreenIds = [
        "scr_dash",     // base
        "scr_patients", // workflow 1 starts
        "scr_details",
        "scr_edit",
        "scr_dash",     // workflow 1 ends
        "scr_reports",  // workflow 2 starts
        "scr_export",
        "scr_dash",     // workflow 2 ends
        "scr_dash",     // base (stays)
        "scr_settings", // workflow 3 starts
        "scr_prefs",
        "scr_dash",     // workflow 3 ends
      ];

      const session = createTestSession("complex-session", screens, eventScreenIds);
      const workflows = await segmentWorkflows("complex-session", session);

      expect(workflows.length).toBe(3);

      // Workflow 1: Patient List -> Patient Details -> Edit Patient
      expect(workflows[0].steps.map((s) => s.screenLabel)).toEqual([
        "Patient List",
        "Patient Details",
        "Edit Patient",
      ]);

      // Workflow 2: Reports -> Export Dialog
      expect(workflows[1].steps.map((s) => s.screenLabel)).toEqual([
        "Reports",
        "Export Dialog",
      ]);

      // Workflow 3: Settings -> Preferences
      expect(workflows[2].steps.map((s) => s.screenLabel)).toEqual([
        "Settings",
        "Preferences",
      ]);
    });

    it("should save incomplete workflow if session ends mid-workflow", async () => {
      // Dashboard -> Settings -> Advanced Settings (session ends without returning)
      const screens = [
        { id: "scr_dash", label: "Dashboard" },
        { id: "scr_settings", label: "Settings" },
        { id: "scr_advanced", label: "Advanced Settings" },
      ];
      const eventScreenIds = [
        "scr_dash",
        "scr_settings",
        "scr_advanced",
      ];

      const session = createTestSession("incomplete-workflow-test", screens, eventScreenIds);
      const workflows = await segmentWorkflows("incomplete-workflow-test", session);

      // Should still capture the incomplete workflow
      expect(workflows.length).toBe(1);
      expect(workflows[0].steps.length).toBe(2);
    });
  });
});
