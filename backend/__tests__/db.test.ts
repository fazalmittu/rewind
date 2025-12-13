import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import {
  initDb,
  closeDb,
  clearAllData,
  insertCanonicalScreen,
  insertCanonicalScreens,
  getAllCanonicalScreens,
  insertWorkflowTemplate,
  insertWorkflowTemplates,
  getAllWorkflowTemplates,
  getWorkflowTemplateById,
  insertWorkflowInstance,
  insertWorkflowInstances,
  getAllWorkflowInstances,
  getInstancesByTemplateId,
  getTemplatesWithInstances,
} from "../db";
import { CanonicalScreen, WorkflowTemplate, WorkflowInstance } from "../types";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(import.meta.dir, "test.db");

beforeAll(() => {
  initDb(TEST_DB_PATH);
});

afterAll(() => {
  closeDb();
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

beforeEach(() => {
  clearAllData();
});

describe("Canonical Screens", () => {
  const testScreen: CanonicalScreen = {
    id: "scr_test123",
    label: "Product Detail Page",
    description: "Page showing product details",
    urlPatterns: ["/dp/*", "/product/*"],
    exampleScreenshotPath: "storage/screenshots/123.png",
  };

  it("should insert and retrieve a canonical screen", () => {
    insertCanonicalScreen(testScreen);
    const screens = getAllCanonicalScreens();

    expect(screens).toHaveLength(1);
    expect(screens[0].id).toBe(testScreen.id);
    expect(screens[0].label).toBe(testScreen.label);
    expect(screens[0].urlPatterns).toEqual(testScreen.urlPatterns);
  });

  it("should insert multiple screens", () => {
    const screens: CanonicalScreen[] = [
      testScreen,
      {
        id: "scr_test456",
        label: "Shopping Cart",
        description: "Cart page",
        urlPatterns: ["/cart"],
        exampleScreenshotPath: "storage/screenshots/456.png",
      },
    ];

    insertCanonicalScreens(screens);
    const result = getAllCanonicalScreens();

    expect(result).toHaveLength(2);
  });

  it("should upsert screen on duplicate id", () => {
    insertCanonicalScreen(testScreen);
    insertCanonicalScreen({
      ...testScreen,
      label: "Updated Label",
    });

    const screens = getAllCanonicalScreens();
    expect(screens).toHaveLength(1);
    expect(screens[0].label).toBe("Updated Label");
  });
});

describe("Workflow Templates", () => {
  const testTemplate: WorkflowTemplate = {
    id: "tmpl_test123",
    name: "Search and Add to Cart",
    description: "Search for a product and add it to cart",
    inputs: {
      search_query: {
        type: "string",
        description: "The search term",
        required: true,
        observedValues: ["iPad", "iPhone"],
      },
      quantity: {
        type: "number",
        description: "Number of items",
        required: false,
        default: 1,
        observedValues: [1, 2, 3],
      },
    },
    outputs: {
      product_name: {
        type: "string",
        description: "Name of product added",
        required: false,
        observedValues: ["iPad Pro"],
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
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it("should insert and retrieve a template", () => {
    insertWorkflowTemplate(testTemplate);
    const templates = getAllWorkflowTemplates();

    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe(testTemplate.name);
    expect(templates[0].inputs.search_query.type).toBe("string");
    expect(templates[0].steps).toHaveLength(2);
  });

  it("should get template by id", () => {
    insertWorkflowTemplate(testTemplate);
    const template = getWorkflowTemplateById(testTemplate.id);

    expect(template).not.toBeNull();
    expect(template?.name).toBe(testTemplate.name);
  });

  it("should return null for non-existent template", () => {
    const template = getWorkflowTemplateById("non_existent");
    expect(template).toBeNull();
  });
});

describe("Workflow Instances", () => {
  const templateId = "tmpl_parent";
  const testInstance: WorkflowInstance = {
    id: "inst_test123",
    templateId,
    sessionId: "session_abc",
    parameterValues: {
      search_query: "iPad",
      quantity: 2,
    },
    extractedValues: {
      product_name: "iPad Pro 11-inch",
    },
    stepSnapshots: [
      {
        stepNumber: 1,
        screenshotPath: "storage/screenshots/1.png",
        action: "Entered iPad in search",
        screenLabel: "Search Results",
      },
      {
        stepNumber: 2,
        screenshotPath: "storage/screenshots/2.png",
        action: "Clicked Add to Cart",
        screenLabel: "Product Detail Page",
      },
    ],
    createdAt: Date.now(),
  };

  beforeEach(() => {
    // Insert parent template first
    insertWorkflowTemplate({
      id: templateId,
      name: "Test Template",
      description: "Test",
      inputs: {},
      outputs: {},
      steps: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  it("should insert and retrieve an instance", () => {
    insertWorkflowInstance(testInstance);
    const instances = getAllWorkflowInstances();

    expect(instances).toHaveLength(1);
    expect(instances[0].parameterValues.search_query).toBe("iPad");
    expect(instances[0].stepSnapshots).toHaveLength(2);
  });

  it("should get instances by template id", () => {
    insertWorkflowInstance(testInstance);
    insertWorkflowInstance({
      ...testInstance,
      id: "inst_test456",
      parameterValues: { search_query: "iPhone" },
    });

    const instances = getInstancesByTemplateId(templateId);
    expect(instances).toHaveLength(2);
  });

  it("should return empty array for template with no instances", () => {
    const instances = getInstancesByTemplateId("non_existent");
    expect(instances).toHaveLength(0);
  });
});

describe("Aggregated Queries", () => {
  it("should get templates with their instances", () => {
    const template: WorkflowTemplate = {
      id: "tmpl_agg",
      name: "Aggregated Template",
      description: "Test",
      inputs: {},
      outputs: {},
      steps: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    insertWorkflowTemplate(template);
    insertWorkflowInstance({
      id: "inst_1",
      templateId: template.id,
      sessionId: "sess_1",
      parameterValues: { query: "test1" },
      extractedValues: {},
      stepSnapshots: [],
      createdAt: Date.now(),
    });
    insertWorkflowInstance({
      id: "inst_2",
      templateId: template.id,
      sessionId: "sess_2",
      parameterValues: { query: "test2" },
      extractedValues: {},
      stepSnapshots: [],
      createdAt: Date.now(),
    });

    const result = getTemplatesWithInstances();

    expect(result).toHaveLength(1);
    expect(result[0].instances).toHaveLength(2);
    expect(result[0].name).toBe("Aggregated Template");
  });
});

describe("Clear All Data", () => {
  it("should clear all tables", () => {
    insertCanonicalScreen({
      id: "scr_1",
      label: "Test",
      description: "Test",
      urlPatterns: [],
      exampleScreenshotPath: "",
    });
    insertWorkflowTemplate({
      id: "tmpl_1",
      name: "Test",
      description: "Test",
      inputs: {},
      outputs: {},
      steps: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    clearAllData();

    const screens = getAllCanonicalScreens();
    const templates = getAllWorkflowTemplates();
    const instances = getAllWorkflowInstances();

    expect(screens).toHaveLength(0);
    expect(templates).toHaveLength(0);
    expect(instances).toHaveLength(0);
  });
});
