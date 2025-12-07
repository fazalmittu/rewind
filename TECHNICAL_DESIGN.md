# Rewind - Technical Design Document

> **Version**: 2.0  
> **Last Updated**: 2025-12-07  
> **Status**: Implemented

---

## 1. Overview

Rewind is a vision-based workflow recorder that captures browser interactions and uses AI to extract reusable workflow templates with parameters.

### Core Concept

```
User clicks around in a web app
        ↓
Extension captures events + screenshots
        ↓
AI analyzes and groups similar screens
        ↓
AI segments into distinct workflow instances
        ↓
AI synthesizes reusable templates with {parameters}
        ↓
Templates + instances stored for viewing/export
```

### Key Innovation

Instead of just recording steps, Rewind identifies:
- **What varies** (parameters like `search_query`, `patient_name`)
- **What's fixed** (the workflow structure)
- **Canonical screens** (grouping "iPad Detail Page" and "iPhone Detail Page" as "Product Detail Page")

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Extension                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Content     │  │ Background  │  │ Popup                   │  │
│  │ Script      │→ │ Script      │→ │ Start/Stop Recording    │  │
│  │ (events)    │  │ (capture)   │  │ Finalize Session        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ POST /ingest
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Backend Server                            │
│  ┌─────────────┐  ┌──────────────────────────────────────────┐  │
│  │ Session     │  │ Finalization Pipeline                    │  │
│  │ Store       │  │  1. Screen Canonicalization (GPT)        │  │
│  │ (in-memory) │  │  2. Instance Segmentation (GPT)          │  │
│  │             │→ │  3. Template Synthesis (GPT)             │  │
│  └─────────────┘  └──────────────────────────────────────────┘  │
│                                      │                           │
│                                      ↓                           │
│                        ┌─────────────────────────┐               │
│                        │ SQLite Database         │               │
│                        │ - canonical_screens     │               │
│                        │ - workflow_templates    │               │
│                        │ - workflow_instances    │               │
│                        └─────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Dashboard                        │
│  - View templates with inputs/outputs                           │
│  - Expand to see instances with actual values                   │
│  - Navigate screenshots with arrow keys                         │
│  - Export as JSON                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Event Capture

### Event Types

| Type | Trigger | Captured Data |
|------|---------|---------------|
| `click` | User clicks any element | x, y, targetTag, targetText |
| `input` | User types in text field (debounced 800ms) | inputValue, inputName, inputLabel |
| `change` | Dropdown/checkbox selection | inputValue, inputName, inputType |
| `submit` | Form submission | form fields list |

### Contenteditable Support

Modern apps (Linear, Notion) use `contenteditable` divs instead of `<input>`. We detect:
- `[contenteditable="true"]`
- `.ProseMirror`, `.ql-editor`, `.DraftEditor-root`, `.tiptap`
- `[data-slate-editor]`, `[role="textbox"]`

### Screenshot Capture

After each event:
1. Wait for UI stabilization (400ms for clicks, 100ms for inputs)
2. Capture visible tab via `chrome.tabs.captureVisibleTab`
3. Send base64 PNG to backend

---

## 4. In-Memory Session Store

During recording, events are stored in memory (not DB):

```typescript
interface SessionState {
  sessionId: string;
  events: CapturedEvent[];
  createdAt: number;
}
```

This allows fast event accumulation without DB overhead. Data is only persisted upon finalization.

---

## 5. Finalization Pipeline

When user clicks "Stop & Finalize":

### Stage 1: Screen Canonicalization

**Goal:** Group similar screens into canonical types.

```
Input:  URLs like /dp/B09V3KXJPB, /dp/B08N5WRWNW
Output: Canonical screen "Product Detail Page" with pattern /dp/*
```

**Process:**
1. Extract URL patterns (replace dynamic segments with `*`)
2. Group events by pattern
3. Send to GPT to assign canonical labels
4. Map each event to its canonical screenId

### Stage 2: Instance Segmentation

**Goal:** Identify distinct workflow attempts.

```
Input:  Sequence of 15 events
Output: 2 instances: "Search for iPad" (events 0-7), "Search for tree" (events 8-14)
```

**Process:**
1. Send event sequence with screen labels to GPT
2. GPT identifies goal-based groupings
3. Returns start/end indices for each instance

### Stage 3: Template Synthesis

**Goal:** Create reusable template with parameters from each instance.

```
Input:  Instance events with typed text "iPad", "3", clicked "Add to Cart"
Output: Template "Search and Add to Cart" with inputs {search_query, quantity}
```

**Process:**
1. Send instance events to GPT
2. GPT identifies:
   - Input parameters (values that would vary)
   - Output parameters (extracted values)
   - Step templates with `{placeholders}`
3. Returns template + instance values

---

## 6. Database Schema

### `canonical_screens`
```sql
CREATE TABLE canonical_screens (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,              -- "Product Detail Page"
  description TEXT NOT NULL,
  urlPatternsJson TEXT NOT NULL,    -- ["/dp/*", "/product/*"]
  exampleScreenshotPath TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);
```

### `workflow_templates`
```sql
CREATE TABLE workflow_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,               -- "Search and Add to Cart"
  description TEXT NOT NULL,
  inputsJson TEXT NOT NULL,         -- {search_query: {type, desc, required}}
  outputsJson TEXT NOT NULL,        -- {product_name: {type, desc}}
  stepsJson TEXT NOT NULL,          -- [{stepNumber, screenPattern, actionTemplate, usesInputs, extracts}]
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

### `workflow_instances`
```sql
CREATE TABLE workflow_instances (
  id TEXT PRIMARY KEY,
  templateId TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  parameterValuesJson TEXT NOT NULL,   -- {search_query: "iPad", quantity: 3}
  extractedValuesJson TEXT NOT NULL,   -- {product_name: "iPad Pro"}
  stepSnapshotsJson TEXT NOT NULL,     -- [{stepNumber, screenshotPath, action, screenLabel}]
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (templateId) REFERENCES workflow_templates(id)
);
```

---

## 7. Type Definitions

```typescript
// Captured from browser
interface CapturedEvent {
  timestamp: number;
  eventType: "click" | "input" | "change" | "submit";
  url: string;
  screenshotPath: string;
  targetTag: string;
  targetText?: string;
  clickX?: number;
  clickY?: number;
  inputValue?: string;
  inputName?: string;
  inputLabel?: string;
  inputType?: string;
  screenId?: string;        // Added during canonicalization
}

// Canonical screen type
interface CanonicalScreen {
  id: string;
  label: string;            // Generic: "Product Detail Page"
  description: string;
  urlPatterns: string[];
  exampleScreenshotPath: string;
}

// Reusable workflow template
interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  inputs: Record<string, ParameterDef>;
  outputs: Record<string, ParameterDef>;
  steps: TemplateStep[];
  createdAt: number;
  updatedAt: number;
}

interface ParameterDef {
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
  default?: any;
  observedValues: any[];
}

interface TemplateStep {
  stepNumber: number;
  screenPattern: string;        // Canonical screen label
  actionTemplate: string;       // "Enter {search_query} in search"
  usesInputs: string[];
  extracts: Record<string, ExtractionDef>;
}

// Specific execution of a template
interface WorkflowInstance {
  id: string;
  templateId: string;
  sessionId: string;
  parameterValues: Record<string, any>;
  extractedValues: Record<string, any>;
  stepSnapshots: StepSnapshot[];
  createdAt: number;
}
```

---

## 8. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ingest` | Receive event + screenshot from extension |
| POST | `/finalize-session` | Run pipeline, persist to DB |
| GET | `/templates` | List all templates with their instances |
| GET | `/screens` | List all canonical screens |
| POST | `/reset` | Clear all data |
| GET | `/health` | Health check |

---

## 9. File Structure

```
rewind/
├── backend/
│   ├── pipeline/
│   │   ├── index.ts                 # Pipeline orchestrator
│   │   ├── screenCanonicalizer.ts   # Stage 1
│   │   ├── instanceSegmenter.ts     # Stage 2
│   │   └── templateSynthesizer.ts   # Stage 3
│   ├── __tests__/
│   │   ├── db.test.ts
│   │   ├── server.test.ts
│   │   └── pipeline.test.ts
│   ├── server.ts
│   ├── db.ts
│   ├── llm.ts
│   ├── sessionStore.ts
│   ├── types.ts
│   └── index.ts
│
├── extension/
│   ├── src/
│   │   ├── contentScript.ts         # Event capture
│   │   ├── background.ts            # Screenshot + API calls
│   │   ├── stabilization.ts
│   │   └── popup.ts
│   ├── dist/                        # Compiled JS
│   ├── icons/
│   ├── popup.html
│   └── manifest.json
│
├── frontend/
│   └── index.html                   # Dashboard
│
├── storage/
│   └── screenshots/                 # Captured PNGs
│
├── simulations/                     # Test environments
│   ├── README.md
│   └── ehr/                         # EHR simulation app
│
└── .env                             # OPENAI_API_KEY, etc.
```

---

## 10. Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
OPENAI_MODEL=gpt-4o          # Optional, default: gpt-4o
API_URL=http://localhost:3000 # Optional, for extension
PORT=3000                     # Optional, default: 3000
```

---

## 11. Testing

| Component | Method |
|-----------|--------|
| DB operations | Jest unit tests |
| Pipeline stages | Jest with mocked GPT |
| Server endpoints | Jest + supertest |
| Frontend | Manual browser testing |
| Extension | Manual browser testing |
| Full flow | Simulations (e.g., EHR app) |

```bash
npm test                  # Run all tests
npm test -- --coverage    # With coverage
```

---

## 12. Simulations

Standalone test apps in `simulations/` directory:

| Name | Port | Description |
|------|------|-------------|
| `ehr` | 3001 | Electronic Health Records - patients, insurance, providers, drug referrals |

```bash
cd simulations/ehr
npm install
npm run dev
# Open http://localhost:3001
```

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-05 | v1.0 - Initial design with segmenter/refiner |
| 2025-12-07 | v2.0 - Complete rewrite: template/instance model, pipeline architecture |
