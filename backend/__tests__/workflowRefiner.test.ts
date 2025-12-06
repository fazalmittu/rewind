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
            { screen: "Dashboard", action: "Clicked patients" },
            { screen: "Patient List", action: "Selected patient" },
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
    });

    it("should handle LLM response with markdown fences", async () => {
      const raw: RawWorkflow[] = [
        { steps: [{ screen: "Home", action: "Click" }] },
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
        { steps: [{ screen: "A", action: "1" }] },
        { steps: [{ screen: "B", action: "2" }] },
        { steps: [{ screen: "C", action: "3" }] },
      ];

      const mockResponse = JSON.stringify([
        { name: "Flow A", description: "First flow", steps: raw[0].steps },
        { name: "Flow B", description: "Second flow", steps: raw[1].steps },
        { name: "Flow C", description: "Third flow", steps: raw[2].steps },
      ]);

      mockCallLLMText.mockResolvedValue(mockResponse);

      const result = await refineWorkflows(raw);

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.name)).toEqual(["Flow A", "Flow B", "Flow C"]);
    });

    it("should handle GPT merging workflows", async () => {
      // GPT might merge similar workflows
      const raw: RawWorkflow[] = [
        { steps: [{ screen: "Settings", action: "Open" }] },
        { steps: [{ screen: "Settings", action: "Open settings" }] },
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
            { screen: "Login", action: "Enter credentials" },
            { screen: "Dashboard", action: "View main page" },
          ],
        },
      ];

      mockCallLLMText.mockResolvedValue(
        JSON.stringify([
          {
            name: "Login Flow",
            description: "User logs in",
            steps: raw[0].steps,
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


