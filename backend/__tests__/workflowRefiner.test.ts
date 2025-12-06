import { RawWorkflow, RefinedWorkflow } from "../types";

// Mock the LLM module before importing refiner
jest.mock("../llm", () => ({
  callLLMText: jest.fn(),
  sanitizeJSON: jest.requireActual("../llm").sanitizeJSON,
}));

import { refineWorkflows } from "../workflowRefiner";
import { callLLMText } from "../llm";

const mockCallLLMText = callLLMText as jest.MockedFunction<typeof callLLMText>;

describe("workflowRefiner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("refineWorkflows", () => {
    it("should return empty array for empty input", async () => {
      const result = await refineWorkflows([]);
      expect(result).toEqual([]);
      expect(mockCallLLMText).not.toHaveBeenCalled();
    });

    it("should call LLM and return refined workflows", async () => {
      const raw: RawWorkflow[] = [
        {
          steps: [
            { screenId: "scr_dash", screenLabel: "Dashboard", action: "Clicked patients", screenshotPath: "1.png" },
            { screenId: "scr_list", screenLabel: "Patient List", action: "Selected patient", screenshotPath: "2.png" },
          ],
        },
      ];

      const mockResponse = JSON.stringify([
        {
          name: "View Patient",
          description: "Navigate to view patient details",
          steps: [
            { screen: "Dashboard", action: "Clicked patients" },
            { screen: "Patient List", action: "Selected patient" },
          ],
        },
      ]);

      mockCallLLMText.mockResolvedValue(mockResponse);

      const result = await refineWorkflows(raw);

      expect(mockCallLLMText).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("View Patient");
      expect(result[0].description).toBe("Navigate to view patient details");
      expect(result[0].steps).toHaveLength(2);
      // Should preserve screenId from raw workflow
      expect(result[0].steps[0].screenId).toBe("scr_dash");
    });

    it("should handle LLM response with markdown fences", async () => {
      const raw: RawWorkflow[] = [
        { steps: [{ screenId: "scr_home", screenLabel: "Home", action: "Click", screenshotPath: "1.png" }] },
      ];

      const mockResponse = `\`\`\`json
[
  {
    "name": "Test Flow",
    "description": "A test workflow",
    "steps": [{"screen": "Home", "action": "Click"}]
  }
]
\`\`\``;

      mockCallLLMText.mockResolvedValue(mockResponse);

      const result = await refineWorkflows(raw);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Test Flow");
    });

    it("should handle multiple workflows", async () => {
      const raw: RawWorkflow[] = [
        { steps: [{ screenId: "scr_a", screenLabel: "A", action: "1", screenshotPath: "1.png" }] },
        { steps: [{ screenId: "scr_b", screenLabel: "B", action: "2", screenshotPath: "2.png" }] },
        { steps: [{ screenId: "scr_c", screenLabel: "C", action: "3", screenshotPath: "3.png" }] },
      ];

      const mockResponse = JSON.stringify([
        { name: "Flow A", description: "First flow", steps: [{ screen: "A", action: "1" }] },
        { name: "Flow B", description: "Second flow", steps: [{ screen: "B", action: "2" }] },
        { name: "Flow C", description: "Third flow", steps: [{ screen: "C", action: "3" }] },
      ]);

      mockCallLLMText.mockResolvedValue(mockResponse);

      const result = await refineWorkflows(raw);

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.name)).toEqual(["Flow A", "Flow B", "Flow C"]);
    });

    it("should handle GPT merging workflows", async () => {
      // GPT might merge similar workflows
      const raw: RawWorkflow[] = [
        { steps: [{ screenId: "scr_settings", screenLabel: "Settings", action: "Open", screenshotPath: "1.png" }] },
        { steps: [{ screenId: "scr_settings", screenLabel: "Settings", action: "Open settings", screenshotPath: "2.png" }] },
      ];

      // GPT merges them into one
      const mockResponse = JSON.stringify([
        {
          name: "Open Settings",
          description: "User opens the settings page",
          steps: [{ screen: "Settings", action: "Open settings" }],
        },
      ]);

      mockCallLLMText.mockResolvedValue(mockResponse);

      const result = await refineWorkflows(raw);

      // Result has fewer workflows than input (merged)
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Open Settings");
    });

    it("should include raw workflows in prompt", async () => {
      const raw: RawWorkflow[] = [
        {
          steps: [
            { screenId: "scr_login", screenLabel: "Login", action: "Enter credentials", screenshotPath: "1.png" },
            { screenId: "scr_dash", screenLabel: "Dashboard", action: "View main page", screenshotPath: "2.png" },
          ],
        },
      ];

      mockCallLLMText.mockResolvedValue(
        JSON.stringify([
          {
            name: "Login Flow",
            description: "User logs in",
            steps: [
              { screen: "Login", action: "Enter credentials" },
              { screen: "Dashboard", action: "View main page" },
            ],
          },
        ])
      );

      await refineWorkflows(raw);

      // Verify the prompt includes the raw workflow data
      const promptArg = mockCallLLMText.mock.calls[0][0];
      expect(promptArg).toContain("Login");
      expect(promptArg).toContain("Enter credentials");
      expect(promptArg).toContain("Dashboard");
    });
  });
});


