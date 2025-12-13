import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test";
import { CapturedEvent, CanonicalScreen } from "../types";
import * as llm from "../llm";

describe("Screen Canonicalizer", () => {
  beforeEach(() => {
    mock.restore();
  });

  it("should return empty for no events", async () => {
    const { canonicalizeScreens } = await import("../pipeline/screenCanonicalizer");
    const result = await canonicalizeScreens([]);
    expect(result.screens).toHaveLength(0);
    expect(result.eventScreenMappings.size).toBe(0);
  });

  it("should canonicalize screens from events", async () => {
    spyOn(llm, "callLLMText").mockResolvedValue(
      JSON.stringify({
        screenTypes: [
          {
            groupIds: [0],
            canonicalLabel: "Product Detail Page",
            description: "Page showing product details",
          },
          {
            groupIds: [1],
            canonicalLabel: "Shopping Cart",
            description: "Shopping cart page",
          },
        ],
      })
    );

    const { canonicalizeScreens } = await import("../pipeline/screenCanonicalizer");

    const events: CapturedEvent[] = [
      {
        timestamp: 1000,
        eventType: "click",
        url: "https://amazon.com/dp/B12345",
        screenshotPath: "s1.png",
        targetTag: "button",
      },
      {
        timestamp: 2000,
        eventType: "click",
        url: "https://amazon.com/cart",
        screenshotPath: "s2.png",
        targetTag: "button",
      },
    ];

    const result = await canonicalizeScreens(events);

    expect(result.screens).toHaveLength(2);
    expect(result.screens.map((s) => s.label)).toContain("Product Detail Page");
    expect(result.screens.map((s) => s.label)).toContain("Shopping Cart");
  });

  it("should group same URL patterns together", async () => {
    spyOn(llm, "callLLMText").mockResolvedValue(
      JSON.stringify({
        screenTypes: [
          {
            groupIds: [0],
            canonicalLabel: "Product Detail Page",
            description: "Page showing product details",
          },
        ],
      })
    );

    const { canonicalizeScreens } = await import("../pipeline/screenCanonicalizer");

    // Use long product IDs (8+ chars) so they get replaced with "*" in patterns
    const events: CapturedEvent[] = [
      {
        timestamp: 1000,
        eventType: "click",
        url: "https://amazon.com/dp/B09V3KXJPB",
        screenshotPath: "s1.png",
        targetTag: "button",
      },
      {
        timestamp: 2000,
        eventType: "click",
        url: "https://amazon.com/dp/B08N5WRWNW",
        screenshotPath: "s2.png",
        targetTag: "button",
      },
    ];

    const result = await canonicalizeScreens(events);

    // Both events have same URL pattern (/dp/*), so only one screen created
    expect(result.screens).toHaveLength(1);
    expect(result.screens[0].label).toBe("Product Detail Page");
    // Both events should have screenId set on them
    expect(events[0].screenId).toBe(events[1].screenId);
  });
});

describe("Instance Segmenter", () => {
  beforeEach(() => {
    mock.restore();
  });

  it("should return empty for no events", async () => {
    const { segmentInstances } = await import("../pipeline/instanceSegmenter");
    const result = await segmentInstances([], []);
    expect(result.instances).toHaveLength(0);
  });

  it("should treat single event as single instance", async () => {
    const { segmentInstances } = await import("../pipeline/instanceSegmenter");

    const events: CapturedEvent[] = [
      {
        timestamp: 1000,
        eventType: "click",
        url: "https://example.com",
        screenshotPath: "s1.png",
        targetTag: "button",
        screenId: "scr_1",
      },
    ];

    const result = await segmentInstances(events, []);

    expect(result.instances).toHaveLength(1);
    expect(result.instances[0].events).toHaveLength(1);
  });

  it("should segment multiple workflow instances", async () => {
    spyOn(llm, "callLLMText").mockResolvedValue(
      JSON.stringify({
        instances: [
          {
            goal: "Search for iPad",
            startEventIndex: 0,
            endEventIndex: 2,
            succeeded: true,
          },
          {
            goal: "Search for iPhone",
            startEventIndex: 3,
            endEventIndex: 5,
            succeeded: true,
          },
        ],
      })
    );

    const { segmentInstances } = await import("../pipeline/instanceSegmenter");

    const events: CapturedEvent[] = Array(6)
      .fill(null)
      .map((_, i) => ({
        timestamp: i * 1000,
        eventType: "click" as const,
        url: "https://example.com",
        screenshotPath: `s${i}.png`,
        targetTag: "button",
        screenId: "scr_1",
      }));

    const result = await segmentInstances(events, []);

    expect(result.instances).toHaveLength(2);
    expect(result.instances[0].goal).toBe("Search for iPad");
    expect(result.instances[0].events).toHaveLength(3);
    expect(result.instances[1].goal).toBe("Search for iPhone");
    expect(result.instances[1].events).toHaveLength(3);
  });
});

describe("Template Synthesizer", () => {
  beforeEach(() => {
    mock.restore();
  });

  it("should synthesize a template from an instance", async () => {
    spyOn(llm, "callLLMText").mockResolvedValue(
      JSON.stringify({
        template: {
          name: "Search and Add to Cart",
          description: "Search for a product and add it to cart",
          inputs: {
            search_query: {
              type: "string",
              description: "The search term",
              required: true,
            },
          },
          outputs: {
            product_name: {
              type: "string",
              description: "Name of product added",
            },
          },
          steps: [
            {
              stepNumber: 1,
              screenPattern: "Search Results",
              actionTemplate: "Enter {search_query} in search box",
              usesInputs: ["search_query"],
              extracts: {},
            },
            {
              stepNumber: 2,
              screenPattern: "Product Detail Page",
              actionTemplate: "Click Add to Cart",
              usesInputs: [],
              extracts: {
                product_name: { from: "page_content" },
              },
            },
          ],
        },
        instanceValues: {
          inputs: {
            search_query: "iPad",
          },
          outputs: {
            product_name: "iPad Pro",
          },
        },
      })
    );

    const { synthesizeTemplate } = await import("../pipeline/templateSynthesizer");

    const screens: CanonicalScreen[] = [
      {
        id: "scr_search",
        label: "Search Results",
        description: "Search results page",
        urlPatterns: ["/search"],
        exampleScreenshotPath: "s1.png",
      },
      {
        id: "scr_product",
        label: "Product Detail Page",
        description: "Product page",
        urlPatterns: ["/dp/*"],
        exampleScreenshotPath: "s2.png",
      },
    ];

    const detectedInstance = {
      goal: "Search for iPad and add to cart",
      startEventIndex: 0,
      endEventIndex: 1,
      succeeded: true,
      events: [
        {
          timestamp: 1000,
          eventType: "input" as const,
          url: "https://amazon.com/search",
          screenshotPath: "s1.png",
          targetTag: "input",
          inputValue: "iPad",
          screenId: "scr_search",
        },
        {
          timestamp: 2000,
          eventType: "click" as const,
          url: "https://amazon.com/dp/B12345",
          screenshotPath: "s2.png",
          targetTag: "button",
          targetText: "Add to Cart",
          screenId: "scr_product",
        },
      ],
    };

    const result = await synthesizeTemplate(detectedInstance, screens, "session-123");

    expect(result.template.name).toBe("Search and Add to Cart");
    expect(result.template.inputs.search_query).toBeDefined();
    expect(result.template.inputs.search_query.type).toBe("string");
    expect(result.template.steps).toHaveLength(2);
    expect(result.template.steps[0].usesInputs).toContain("search_query");

    expect(result.instance.parameterValues.search_query).toBe("iPad");
    expect(result.instance.extractedValues.product_name).toBe("iPad Pro");
    expect(result.instance.stepSnapshots).toHaveLength(2);
  });
});
