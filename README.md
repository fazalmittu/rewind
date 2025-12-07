<p align="center">
  <img src="assets/logo.png" alt="Rewind" width="128" height="128">
</p>

<h1 align="center">Rewind</h1>

<p align="center">
  A vision-based workflow recorder that captures how people actually work in browsers.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite&logoColor=white" alt="SQLite">
</p>

---

## Why This Exists

Browser automation is having a moment. Companies are racing to build agents that can navigate web apps, fill out forms, and complete tasks the way humans do. But there's a problem: **you can't automate what you don't understand**.

I've spent countless hours shadowing people at work—watching them click through dashboards, fill out forms, navigate between apps. Then I'd go back and watch recordings, try to remember what they did, figure out which steps were essential vs. incidental, and test whether my automation actually matched their workflow.

It was tedious. The gap between "watching someone work" and "having structured data about their workflow" was huge.

**Rewind closes that gap.**

Instead of taking notes while you shadow someone, just turn on Rewind. It captures screenshots, tracks interactions, and uses AI to make sense of what happened. At the end, you get:

- **Canonical screens** — The distinct UI states the user encountered
- **Workflow templates** — Reusable patterns with identified inputs/outputs
- **Concrete instances** — Specific examples of each workflow being executed

## What You Can Do With This Data

Honestly? I built this to make data collection easier. What you do with it is up to you:

- **Train browser agents** — Use the captured workflows as training data for models that automate tasks
- **Document processes** — Generate step-by-step guides from real user behavior
- **Track work patterns** — Understand how people actually use your tools (vs. how you designed them)
- **Build RPA pipelines** — Extract the exact sequences needed to automate repetitive work
- **Onboard new employees** — Show them exactly how experienced users complete tasks

---

## How It Works

### The Recording Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Chrome Ext.    │───▶│  Backend API    │───▶│  SQLite DB      │
│  captures       │    │  stores events  │    │  persists       │
│  clicks/inputs  │    │  + screenshots  │    │  workflows      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

1. **You start recording** via the browser extension
2. **Extension captures** every click, input, and form submission along with a screenshot
3. **Events stream** to the backend and accumulate in memory for the session
4. **You stop recording** and trigger finalization

### The Processing Pipeline

When you finalize a session, the backend runs a 3-stage AI pipeline:

#### Stage 1: Screen Canonicalization

Raw screenshots get grouped into **canonical screen types**. The AI looks at URLs and visual similarity to determine things like:

- `https://app.com/patients/123` and `https://app.com/patients/456` → both are "Patient Detail Page"
- `https://app.com/dashboard` → "Dashboard"
- `https://app.com/search?q=aspirin` → "Search Results Page"

This creates a vocabulary of screens that the workflow can reference.

#### Stage 2: Instance Segmentation

The sequence of events gets chunked into **distinct workflow instances**. The AI identifies:

- Where one task ends and another begins
- What the user was trying to accomplish in each chunk
- Which screens and actions belong together

Example: A 20-minute session might contain 3 instances of "Search and add item to cart" and 1 instance of "Update patient record".

#### Stage 3: Template Synthesis

Similar instances get merged into **reusable templates**. The AI extracts:

- **Inputs** — Parameters you'd provide to run this workflow (e.g., `search_query`, `patient_name`)
- **Steps** — The sequence of actions, with variable parts marked as `{parameters}`
- **Outputs** — Data extracted during execution (e.g., `order_id`, `confirmation_number`)

### Data Model

```
┌────────────────────┐
│ Canonical Screens  │  Distinct UI states (e.g., "Login Page", "Product Detail")
└────────────────────┘
         │
         ▼
┌────────────────────┐
│ Workflow Templates │  Reusable patterns with inputs/outputs/steps
└────────────────────┘
         │
         ▼
┌────────────────────┐
│ Workflow Instances │  Concrete executions with actual parameter values
└────────────────────┘
```

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

```bash
OPENAI_API_KEY=sk-your-key-here    # Required
OPENAI_MODEL=gpt-5.1               # Optional (default: gpt-5.1)
API_URL=http://localhost:3000      # Optional
```

### 3. Build & Start
```bash
npm run build:extension  # Compile the Chrome extension
npm run dev              # Start backend with hot reload
```

### 4. Load Extension
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` folder

### 5. Record
1. Click the Rewind icon in Chrome
2. Click **Start Recording**
3. Do your work in any web app
4. Click **Stop & Finalize**
5. View results at `http://localhost:3000`

---

## Project Structure

```
rewind/
├── backend/                 # Express server
│   ├── pipeline/            # AI processing stages
│   │   ├── screenCanonicalizer.ts
│   │   ├── instanceSegmenter.ts
│   │   └── templateSynthesizer.ts
│   ├── db.ts                # SQLite operations
│   ├── llm.ts               # OpenAI API wrapper
│   ├── sessionStore.ts      # In-memory session state
│   ├── server.ts            # Express routes
│   └── types.ts             # TypeScript interfaces
├── extension/               # Chrome extension
│   ├── src/
│   │   ├── background.ts    # Service worker
│   │   ├── contentScript.ts # Injected into pages
│   │   └── popup.ts         # Extension popup UI
│   ├── manifest.json
│   └── dist/                # Compiled JS
├── frontend/                # Workflow viewer
│   └── index.html           # Single-page dashboard
├── simulations/             # Test environments
│   └── ehr/                 # Sample EHR app for testing
└── storage/
    └── screenshots/         # Captured images
```

## Development

```bash
npm run dev              # Start backend (hot reload)
npm run build:extension  # Build extension once
npm run watch:extension  # Rebuild extension on changes
npm test                 # Run test suite
```

---

## Limitations & Future Work

- **Vision-only** — Currently relies on screenshots + basic DOM info. Doesn't deeply parse page structure.
- **Single session** — Records one user at a time. No multi-user or collaborative features yet.
- **No replay** — Captures workflows but doesn't execute them. That's a separate (harder) problem.
- **AI quality varies** — Template extraction is only as good as the underlying model's understanding.

---

Built because I got tired of watching recordings at 2x speed and taking notes.
