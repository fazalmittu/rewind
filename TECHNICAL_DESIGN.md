# Workflow Recorder - Technical Design Document

> **Version**: 1.0  
> **Last Updated**: 2025-12-05  
> **Status**: Implementation In Progress

---

## 1. Project Summary

A vision-only workflow recorder for browser-based applications. Records user interactions (clicks), captures screenshots after UI stabilization, summarizes actions/screens via GPT-4o, stores events in SQLite, and automatically segments + refines workflows.

### Core Components

1. **Chrome Extension** - Detects clicks, waits for stabilization, captures screenshots, sends to backend
2. **Backend Server** - Ingests events, calls LLM for summaries, stores in SQLite, segments workflows
3. **Workflow Segmenter** - Identifies distinct workflows from screen transitions
4. **Workflow Refiner** - GPT post-processing to name, describe, and deduplicate workflows
5. **Frontend** - Simple viewer for workflows

---

## 2. Architecture Decisions

| Decision | Resolution |
|----------|------------|
| Session ID ownership | Background script owns sessionId, stored in `chrome.storage.local` |
| Session finalization | Extension popup with "Stop & Finalize" button |
| Workflow storage | 3 tables: `raw_workflows`, `refined_workflows`, `refined_workflow_map` (handles GPT merging) |
| LLM functions | Split into `callLLMText` and `callLLMWithImage` |
| GPT JSON parsing | `sanitizeJSON()` helper strips markdown fences + retry logic |
| Frontend serving | Static files at `/` via `express.static("frontend")` |
| Database location | `backend/data.db` |
| Zero workflows | Skip GPT call, return empty arrays |
| Extension build | TypeScript → JS via esbuild to `extension/dist/` |
| Multi-tab behavior | Single session across all tabs until finalized |
| LLM Provider | GPT-4o via OpenAI API |

---

## 3. File Structure

```
workflow-recorder/
│
├── extension/
│   ├── src/
│   │   ├── contentScript.ts
│   │   ├── background.ts
│   │   ├── stabilization.ts
│   │   └── popup.ts
│   ├── dist/                    # Compiled JS (gitignored)
│   ├── popup.html
│   └── manifest.json
│
├── backend/
│   ├── server.ts
│   ├── db.ts
│   ├── llm.ts
│   ├── workflowSegmenter.ts
│   ├── workflowRefiner.ts
│   ├── types.ts
│   ├── db.test.ts
│   ├── workflowSegmenter.test.ts
│   ├── llm.test.ts
│   ├── server.test.ts
│   └── data.db                  # SQLite database (gitignored)
│
├── frontend/
│   └── index.html
│
├── storage/
│   └── screenshots/             # Screenshot PNGs (gitignored)
│
├── .env                         # API keys (gitignored)
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── jest.config.js
├── esbuild.config.js
├── TECHNICAL_DESIGN.md
└── README.md
```

---

## 4. Database Schema

### Table: `events`
Stores each recorded user interaction.

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  url TEXT NOT NULL,
  eventType TEXT NOT NULL,
  screenshotPath TEXT NOT NULL,
  actionSummary TEXT NOT NULL,
  screenSummary TEXT NOT NULL
);
```

### Table: `raw_workflows`
Stores workflows as segmented (before GPT refinement).

```sql
CREATE TABLE raw_workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId TEXT NOT NULL,
  workflowJson TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);
```

### Table: `refined_workflows`
Stores GPT-refined workflows with names and descriptions.

```sql
CREATE TABLE refined_workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId TEXT NOT NULL,
  refinedJson TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);
```

### Table: `refined_workflow_map`
Many-to-many mapping between raw and refined workflows (handles merging/splitting).

```sql
CREATE TABLE refined_workflow_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rawWorkflowId INTEGER NOT NULL,
  refinedWorkflowId INTEGER NOT NULL,
  FOREIGN KEY (rawWorkflowId) REFERENCES raw_workflows(id),
  FOREIGN KEY (refinedWorkflowId) REFERENCES refined_workflows(id)
);
```

---

## 5. Type Definitions

```typescript
// backend/types.ts

export interface RecordedEvent {
  id?: number;
  sessionId: string;
  timestamp: number;
  url: string;
  eventType: "click";
  screenshotPath: string;
  actionSummary: string;
  screenSummary: string;
}

export interface WorkflowStep {
  screen: string;
  action: string;
}

export interface RawWorkflow {
  steps: WorkflowStep[];
}

export interface RefinedWorkflow {
  name: string;
  description: string;
  steps: WorkflowStep[];
}

export interface RawWorkflowRow {
  id?: number;
  sessionId: string;
  workflowJson: RawWorkflow;
  createdAt: number;
}

export interface RefinedWorkflowRow {
  id?: number;
  sessionId: string;
  refinedJson: RefinedWorkflow;
  createdAt: number;
}

export interface WorkflowMapping {
  id?: number;
  rawWorkflowId: number;
  refinedWorkflowId: number;
}
```

---

## 6. API Endpoints

### `POST /ingest`
Receives click events + screenshots from extension.

**Request:**
```json
{
  "payload": {
    "sessionId": "uuid",
    "timestamp": 1234567890,
    "url": "https://example.com",
    "eventType": "click",
    "x": 100,
    "y": 200
  },
  "screenshot": "data:image/png;base64,..."
}
```

**Response:**
```json
{ "status": "ok" }
```

**Behavior:**
1. Save screenshot to `storage/screenshots/{timestamp}.png`
2. Call `summarizeAction()` → actionSummary
3. Call `summarizeScreen()` → screenSummary
4. Insert event into `events` table

---

### `POST /finalize-session`
Segments and refines workflows for a session.

**Request:**
```json
{ "sessionId": "uuid" }
```

**Response:**
```json
{
  "ok": true,
  "raw": [{ "steps": [...] }, ...],
  "refined": [{ "name": "...", "description": "...", "steps": [...] }, ...]
}
```

**Behavior:**
1. `segmentWorkflows(sessionId)` → raw workflows
2. If empty: return `{ ok: true, raw: [], refined: [] }`
3. Else: `refineWorkflows(raw)` → refined workflows
4. Insert into `raw_workflows`, `refined_workflows`, `refined_workflow_map`
5. Return results

---

### `GET /workflows`
Returns all refined workflows.

**Response:**
```json
[
  {
    "id": 1,
    "sessionId": "uuid",
    "refinedJson": {
      "name": "Create Patient",
      "description": "Steps to create a new patient record",
      "steps": [...]
    },
    "createdAt": 1234567890
  }
]
```

---

## 7. Workflow Segmentation Algorithm

### Base Screen Detection
- Count frequency of each `screenSummary` label
- Top 1-2 most frequent = "base screens"

### Segmentation Rules
- **Start workflow**: Leaving a base screen (prev is base, current is not)
- **End workflow**: Returning to base screen OR loop detected (screen label repeats in current workflow)

### Pseudocode
```
baseScreens = top 2 frequent labels
active = false
steps = []

for each event (starting from index 1):
  leftBase = prev is base AND current is not base
  returnedToBase = prev is not base AND current is base
  loopDetected = current.screen already in steps

  if leftBase:
    steps = []
    active = true

  if active:
    steps.push({ screen, action })

  if active AND (returnedToBase OR loopDetected):
    workflows.push({ steps })
    steps = []
    active = false
```

---

## 8. LLM Integration

### Functions

```typescript
// Text-only prompt (for workflow refinement)
callLLMText(prompt: string): Promise<string>

// Vision prompt (for action/screen summaries)
callLLMWithImage(prompt: string, imagePath: string): Promise<string>
```

### Prompts

**Action Summary:**
```
Describe the user's action in one short sentence.
Event: { eventType, url, x, y }
Screenshot: [attached]
```

**Screen Summary:**
```
Name this screen in under 10 words. Use a clear, simple label.
Screenshot: [attached]
```

**Workflow Refinement:**
```
You are analyzing user workflows extracted from a system.
Your job:
- Assign each workflow a clear name (2–5 words).
- Assign each workflow a 1–2 sentence description.
- Merge duplicate workflows if they represent the same task.
- Maintain the same order of steps within each workflow.
- Do not delete steps.
- Do not add steps.

Workflows (JSON):
[...]

Return JSON ONLY in this format:
[
  {
    "name": "...",
    "description": "...",
    "steps": [{ "screen": "...", "action": "..." }, ...]
  }
]
```

### JSON Sanitization
```typescript
function sanitizeJSON(gptOutput: string): any {
  let cleaned = gptOutput
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  return JSON.parse(cleaned);
}
```

---

## 9. Chrome Extension Architecture

### Session Management
- Background script generates and owns `currentSessionId`
- Stored in `chrome.storage.local` for persistence
- Content scripts request sessionId via messaging
- All tabs share same session until finalized

### Message Types
```typescript
// Content → Background
{ type: "GET_SESSION_ID" }
{ type: "USER_EVENT", payload: {...} }

// Popup → Background
{ type: "RESET_SESSION" }

// Background → Content/Popup
{ sessionId: "uuid" }
```

### Flow
1. Content script loads → requests sessionId from background
2. User clicks → content script sends USER_EVENT to background
3. Background waits 400ms (stabilization)
4. Background captures screenshot via `chrome.tabs.captureVisibleTab`
5. Background POSTs to `/ingest`

### Popup
- Shows current sessionId
- "Stop & Finalize" button
- On click: POST `/finalize-session`, then reset sessionId

---

## 10. Implementation Phases

### Phase 0: Repo + Tooling ✅
- [x] Initialize npm project
- [x] Install dependencies
- [x] Configure TypeScript
- [x] Configure Jest
- [x] Configure esbuild for extension
- [x] Create folder structure
- [x] Create .env.example and .gitignore

### Phase 1: Data Types + DB Layer ✅
- [x] Write db.test.ts
- [x] Implement types.ts
- [x] Implement db.ts with all CRUD functions
- [x] Tests pass (10 tests)

### Phase 2: Workflow Segmentation ✅
- [x] Write workflowSegmenter.test.ts
- [x] Implement workflowSegmenter.ts
- [x] Tests pass (7 tests)

### Phase 3: LLM Wrappers ✅
- [x] Write llm.test.ts with mocks
- [x] Implement llm.ts (callLLMText, callLLMWithImage)
- [x] Implement workflowRefiner.ts
- [x] Implement sanitizeJSON
- [x] Tests pass (14 tests)

### Phase 4: Server Endpoints ✅
- [x] Write server.test.ts
- [x] Implement createApp() with routes
- [x] Implement /ingest endpoint
- [x] Implement /finalize-session endpoint
- [x] Implement /workflows endpoint
- [x] Tests pass (8 tests)

### Phase 5: Frontend ✅
- [x] Implement index.html with workflow cards
- [x] Add static file serving
- [x] Manual test: empty state displays correctly

### Phase 6: Extension Core ✅
- [x] Implement background.ts (sessionId management, screenshot capture)
- [x] Implement contentScript.ts (click detection, messaging)
- [x] Implement stabilization.ts
- [x] Build with esbuild
- [ ] Manual test: events reach backend (requires loading extension)

### Phase 7: Extension Popup ✅
- [x] Implement popup.html
- [x] Implement popup.ts
- [x] Add RESET_SESSION handler to background
- [ ] Manual test: full flow works (requires loading extension)

### Phase 8: Real GPT Wiring ⬜
- [x] Implement actual OpenAI API calls (code ready)
- [ ] Add OPENAI_API_KEY to .env
- [ ] Test with real screenshots
- [ ] End-to-end verification

---

## 11. Environment Variables

```bash
# .env
OPENAI_API_KEY=sk-...
```

---

## 12. Dependencies

### Production
- express
- cors
- sqlite3
- openai
- dotenv

### Development
- typescript
- @types/node
- @types/express
- @types/cors
- jest
- ts-jest
- @types/jest
- supertest
- @types/supertest
- esbuild

---

## 13. Testing Strategy

| Component | Testing Method |
|-----------|----------------|
| DB functions | Jest unit tests |
| Workflow segmentation | Jest unit tests |
| LLM helpers | Jest with mocks |
| Server endpoints | Jest + supertest |
| Frontend | Manual browser testing |
| Extension | Manual browser testing |
| Real GPT | Manual verification |

### Test Isolation
- Use in-memory SQLite (`:memory:`) or temp files per test suite
- Mock all LLM calls in automated tests
- Never hit real GPT in CI

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-05 | Initial document created |

