import { sanitizeJSON } from "../llm";

// We'll mock the actual LLM calls in server tests
// Here we just test the utility functions

describe("LLM utilities", () => {
  describe("sanitizeJSON", () => {
    it("should parse clean JSON", () => {
      const input = '[{"name": "Test", "value": 123}]';
      const result = sanitizeJSON(input);
      expect(result).toEqual([{ name: "Test", value: 123 }]);
    });

    it("should strip ```json fences", () => {
      const input = '```json\n[{"name": "Test"}]\n```';
      const result = sanitizeJSON(input);
      expect(result).toEqual([{ name: "Test" }]);
    });

    it("should strip ``` fences without language tag", () => {
      const input = '```\n{"key": "value"}\n```';
      const result = sanitizeJSON(input);
      expect(result).toEqual({ key: "value" });
    });

    it("should handle whitespace around JSON", () => {
      const input = '  \n\n  {"trimmed": true}  \n  ';
      const result = sanitizeJSON(input);
      expect(result).toEqual({ trimmed: true });
    });

    it("should handle uppercase JSON fence", () => {
      const input = '```JSON\n{"upper": true}\n```';
      const result = sanitizeJSON(input);
      expect(result).toEqual({ upper: true });
    });

    it("should parse workflow refinement response", () => {
      const gptResponse = `\`\`\`json
[
  {
    "name": "Create Patient",
    "description": "Steps to create a new patient",
    "steps": [
      {"screen": "Dashboard", "action": "Clicked new patient"},
      {"screen": "Form", "action": "Filled details"}
    ]
  }
]
\`\`\``;
      const result = sanitizeJSON<Array<{ name: string; steps: unknown[] }>>(gptResponse);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Create Patient");
      expect(result[0].steps).toHaveLength(2);
    });

    it("should throw on invalid JSON", () => {
      const input = "this is not json";
      expect(() => sanitizeJSON(input)).toThrow();
    });

    it("should handle nested objects", () => {
      const input = '{"outer": {"inner": {"deep": true}}}';
      const result = sanitizeJSON<{ outer: { inner: { deep: boolean } } }>(input);
      expect(result.outer.inner.deep).toBe(true);
    });
  });
});

