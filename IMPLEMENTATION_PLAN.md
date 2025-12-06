# Implementation Plan - TDD Style

> **Status**: In Progress  
> **Current Phase**: 0  
> **Last Updated**: 2025-12-05

---

## Phase 0 – Repo + Tooling ✅

**Goal:** Have the skeleton + test runner ready.

### 0.1 Setup Project
- [x] `npm init -y`
- [x] Install production dependencies: `express`, `cors`, `sqlite3`, `openai`, `dotenv`
- [x] Install dev dependencies: `typescript`, `ts-node`, `jest`, `ts-jest`, `@types/jest`, `@types/node`, `@types/express`, `@types/cors`, `supertest`, `@types/supertest`, `esbuild`
- [x] `npx tsc --init` - configure TypeScript
- [x] `npx ts-jest config:init` - configure Jest
- [x] Create esbuild config for extension

### 0.2 Create Folder Structure
- [x] `extension/src/`
- [x] `extension/dist/`
- [x] `backend/`
- [x] `frontend/`
- [x] `storage/screenshots/`

### 0.3 Create Stub Files
- [x] `backend/types.ts`
- [x] `backend/db.ts`
- [x] `backend/server.ts`
- [x] `backend/workflowSegmenter.ts`
- [x] `backend/workflowRefiner.ts`
- [x] `backend/llm.ts`
- [x] `frontend/index.html`
- [x] `extension/src/contentScript.ts`
- [x] `extension/src/background.ts`
- [x] `extension/src/stabilization.ts`
- [x] `extension/src/popup.ts`
- [x] `extension/popup.html`
- [x] `extension/manifest.json`

### 0.4 Config Files
- [x] `.env.example` with `OPENAI_API_KEY=`
- [x] `.gitignore` (node_modules, dist, .env, data.db, screenshots)
- [x] `README.md`

### 0.5 Verification
- [x] `npm test` runs Jest (even with no tests)
- [x] `npx tsc` compiles without errors (empty stubs allowed)
- [x] `npm run build:extension` bundles extension to `extension/dist/`

---

## Phase 1 – Data Types + DB Layer (TDD) ✅

**Goal:** Define types and DB schema, prove basic CRUD works via tests.

### 1.1 Write Tests First
- [x] Create `backend/db.test.ts`
- [x] Test: `initDb` creates tables (`events`, `raw_workflows`, `refined_workflows`, `refined_workflow_map`)
- [x] Test: `insertEvent` inserts a row
- [x] Test: `getSessionEvents` returns events ordered by timestamp
- [x] Test: `insertRawWorkflow` inserts and returns ID
- [x] Test: `insertRefinedWorkflow` inserts and returns ID
- [x] Test: `insertWorkflowMapping` creates mapping
- [x] Test: `getAllRefinedWorkflows` returns all refined workflows with parsed JSON

### 1.2 Implement to Satisfy Tests
- [x] Implement `backend/types.ts`:
  - [x] `RecordedEvent`
  - [x] `WorkflowStep`
  - [x] `RawWorkflow`
  - [x] `RefinedWorkflow`
  - [x] `RawWorkflowRow`
  - [x] `RefinedWorkflowRow`
  - [x] `WorkflowMapping`
- [x] Implement `backend/db.ts`:
  - [x] `initDb()` - creates 4 tables
  - [x] `insertEvent()`
  - [x] `getSessionEvents()`
  - [x] `insertRawWorkflow()` - returns ID
  - [x] `insertRefinedWorkflow()` - returns ID
  - [x] `insertWorkflowMapping()`
  - [x] `getAllRefinedWorkflows()`

### 1.3 Verification
- [x] All DB tests pass: `npm test -- db.test.ts`

---

## Phase 2 – Workflow Segmentation (TDD) ✅

**Goal:** Implement segmentation from DB events → raw workflows.

### 2.1 Write Tests First
- [x] Create `backend/workflowSegmenter.test.ts`
- [x] Test: Empty events returns empty workflows
- [x] Test: Events with base screen + flows yields correct number of workflows
- [x] Test: Base screens are top 2 frequent labels
- [x] Test: Loop detection ends a workflow
- [x] Test: Returning to base screen ends a workflow

### 2.2 Implement to Satisfy Tests
- [x] Implement `backend/workflowSegmenter.ts`:
  - [x] `segmentWorkflows(sessionId)` returns `RawWorkflow[]`
  - [x] Frequency counting for base screen detection
  - [x] Left-base detection (start workflow)
  - [x] Return-to-base detection (end workflow)
  - [x] Loop detection (end workflow)

### 2.3 Verification
- [x] All segmentation tests pass: `npm test -- workflowSegmenter.test.ts`

---

## Phase 3 – LLM Wrappers (TDD with Mocks) ✅

**Goal:** Define LLM interfaces, test with mocks, no real GPT calls.

### 3.1 Write Tests First
- [x] Create `backend/llm.test.ts`
- [x] Test: `sanitizeJSON` strips ```json fences
- [x] Test: `sanitizeJSON` strips ``` fences
- [x] Test: `sanitizeJSON` handles clean JSON
- [x] Test: `summarizeAction` returns string (mocked)
- [x] Test: `summarizeScreen` returns string (mocked)

### 3.2 Write Refiner Tests
- [x] Create `backend/workflowRefiner.test.ts`
- [x] Test: `refineWorkflows` returns parsed array (mocked LLM)
- [x] Test: `refineWorkflows` handles GPT merging workflows
- [x] Test: `refineWorkflows` with empty input returns empty

### 3.3 Implement to Satisfy Tests
- [x] Implement `backend/llm.ts`:
  - [x] `callLLMText(prompt)` - implemented with lazy OpenAI init
  - [x] `callLLMWithImage(prompt, imagePath)` - implemented with GPT-4o vision
  - [x] `sanitizeJSON(gptOutput)` - strip fences, parse
  - [x] `summarizeAction(event, imagePath)`
  - [x] `summarizeScreen(imagePath)`
- [x] Implement `backend/workflowRefiner.ts`:
  - [x] `refineWorkflows(raw)` - calls `callLLMText`, uses `sanitizeJSON`

### 3.4 Verification
- [x] All LLM tests pass: `npm test -- llm.test.ts`
- [x] All refiner tests pass: `npm test -- workflowRefiner.test.ts`

---

## Phase 4 – Server Endpoints (TDD) ✅

**Goal:** Backend can ingest events, finalize sessions, list workflows.

### 4.1 Write Tests First
- [x] Create `backend/server.test.ts`
- [x] Test: `POST /ingest` stores event in DB
- [x] Test: `POST /ingest` saves screenshot to filesystem
- [x] Test: `POST /finalize-session` with events creates workflows
- [x] Test: `POST /finalize-session` with no events returns empty
- [x] Test: `GET /workflows` returns all refined workflows

### 4.2 Implement to Satisfy Tests
- [x] Implement `backend/server.ts`:
  - [x] `createApp()` - returns Express app (for testing)
  - [x] CORS middleware
  - [x] JSON body parser (50mb limit)
  - [x] Static file serving for frontend
  - [x] `POST /ingest`:
    - [x] Save screenshot to `storage/screenshots/{timestamp}.png`
    - [x] Call `summarizeAction()`
    - [x] Call `summarizeScreen()`
    - [x] Call `insertEvent()`
  - [x] `POST /finalize-session`:
    - [x] Call `segmentWorkflows(sessionId)`
    - [x] If empty: return `{ ok: true, raw: [], refined: [] }`
    - [x] Call `refineWorkflows(raw)`
    - [x] Insert raw workflows, get IDs
    - [x] Insert refined workflows, get IDs
    - [x] Create mappings
    - [x] Return results
  - [x] `GET /workflows`:
    - [x] Call `getAllRefinedWorkflows()`
    - [x] Return JSON
- [x] Create `backend/index.ts` (entry point):
  - [x] `initDb()`
  - [x] Create screenshots directory if missing
  - [x] `app.listen(3000)`

### 4.3 Verification
- [x] All server tests pass: `npm test -- server.test.ts`
- [x] Manual: `npm run dev` starts server on port 3000

---

## Phase 5 – Frontend (Manual Testing) ✅

**Goal:** Simple HTML page shows workflows from `/workflows`.

### 5.1 Implement Frontend
- [x] Implement `frontend/index.html`:
  - [x] Basic HTML structure
  - [x] Card-based layout with ID, Session, Name, Description, Steps
  - [x] Fetch script that calls `/workflows`
  - [x] Render rows dynamically
  - [x] Modern dark theme styling

### 5.2 Verification (Manual)
- [x] Start backend: `npm run dev`
- [x] Open `http://localhost:3000/` in browser
- [x] Empty state displays correctly
- [x] Workflows will display when created via extension

---

## Phase 6 – Extension Core (Manual Testing) ✅

**Goal:** Extension captures clicks, screenshots, sends to backend.

### 6.1 Implement Background Script
- [x] Implement `extension/src/background.ts`:
  - [x] `currentSessionId` variable
  - [x] `chrome.runtime.onInstalled` - generate UUID, store in `chrome.storage.local`
  - [x] `chrome.runtime.onStartup` - restore from storage
  - [x] Handle `GET_SESSION_ID` message - return sessionId
  - [x] Handle `USER_EVENT` message:
    - [x] Wait for stabilization (400ms)
    - [x] `chrome.tabs.captureVisibleTab()`
    - [x] POST to `/ingest`

### 6.2 Implement Content Script
- [x] Implement `extension/src/contentScript.ts`:
  - [x] Request sessionId from background on load
  - [x] Listen for clicks
  - [x] Send `USER_EVENT` to background with payload

### 6.3 Implement Stabilization
- [x] Implement `extension/src/stabilization.ts`:
  - [x] `waitForStabilizedState(ms)` - simple setTimeout promise

### 6.4 Implement Manifest
- [x] Implement `extension/manifest.json`:
  - [x] Manifest V3
  - [x] Permissions: `tabs`, `activeTab`, `storage`
  - [x] Host permissions for localhost
  - [x] Background service worker: `dist/background.js`
  - [x] Content scripts: `dist/contentScript.js`
  - [x] Action with popup: `popup.html`

### 6.5 Build Extension
- [x] Run `npm run build:extension`
- [x] Verify `extension/dist/` contains compiled JS

### 6.6 Verification (Manual)
- [ ] Load unpacked extension in Chrome
- [ ] Check background console: sessionId exists in storage
- [ ] Click on any webpage
- [ ] Check backend logs: `/ingest` receives request
- [ ] Check DB: event row created
- [ ] Check `storage/screenshots/`: PNG file saved

---

## Phase 7 – Extension Popup (Manual Testing) ✅

**Goal:** User can finalize session from popup.

### 7.1 Implement Popup HTML
- [x] Implement `extension/popup.html`:
  - [x] Display current sessionId
  - [x] "Stop & Finalize" button
  - [x] Status message area
  - [x] Modern dark theme styling

### 7.2 Implement Popup Script
- [x] Implement `extension/src/popup.ts`:
  - [x] On load: get sessionId from storage, display it
  - [x] On button click:
    - [x] POST `/finalize-session` with sessionId
    - [x] On success: send `RESET_SESSION` to background
    - [x] Update UI with success/error message

### 7.3 Implement Reset Handler in Background
- [x] Add `RESET_SESSION` handler to background.ts:
  - [x] Generate new UUID
  - [x] Update `chrome.storage.local`
  - [x] Update `currentSessionId` variable
  - [x] Respond with new sessionId

### 7.4 Verification (Manual)
- [ ] Backend running
- [ ] Click around on webpages (record some events)
- [ ] Open extension popup
- [ ] Verify sessionId is displayed
- [ ] Click "Stop & Finalize"
- [ ] Check backend logs: `/finalize-session` called
- [ ] Check DB: `raw_workflows`, `refined_workflows` populated
- [ ] Open `http://localhost:3000/` - workflows visible
- [ ] Popup shows new sessionId for next session

---

## Phase 8 – Real GPT Wiring

**Goal:** Connect actual OpenAI API for LLM calls.

### 8.1 Implement Real LLM Calls
- [ ] Update `backend/llm.ts`:
  - [ ] Import OpenAI SDK
  - [ ] Read `OPENAI_API_KEY` from env
  - [ ] Implement `callLLMText()` with GPT-4o
  - [ ] Implement `callLLMWithImage()` with GPT-4o vision
  - [ ] Add error handling and retries

### 8.2 Verification (Manual)
- [ ] Set `OPENAI_API_KEY` in `.env`
- [ ] Start backend
- [ ] Record a short session (3-5 clicks)
- [ ] Finalize session
- [ ] Verify:
  - [ ] Action summaries are meaningful
  - [ ] Screen summaries are meaningful
  - [ ] Refined workflows have good names/descriptions

---

## Final Checklist

- [ ] All Jest tests pass: `npm test`
- [ ] Backend starts without errors: `npm run dev`
- [ ] Extension loads in Chrome without errors
- [ ] Full flow works:
  1. [ ] Load extension
  2. [ ] Navigate to a web app
  3. [ ] Click around (5-10 interactions)
  4. [ ] Open popup, click "Stop & Finalize"
  5. [ ] Open `http://localhost:3000/`
  6. [ ] Workflows display with names, descriptions, steps
- [ ] Code is clean and documented
- [ ] `TECHNICAL_DESIGN.md` is up to date

---

## Notes

### Test Commands
```bash
# Run all tests
npm test

# Run specific test file
npm test -- db.test.ts

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

### Development Commands
```bash
# Start backend in dev mode
npm run dev

# Build extension
npm run build:extension

# Watch extension (rebuild on change)
npm run watch:extension
```

### Manual Testing Checklist for Extension
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `extension/` folder
5. Open any webpage
6. Click around
7. Check extension popup
8. Check backend logs
9. Check frontend at `http://localhost:3000/`

