<p align="center">
  <img src="assets/logo.png" alt="Rewind" width="128" height="128">
</p>

<h1 align="center">Rewind</h1>

<p align="center">
  A vision-based workflow recorder for browser apps.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite&logoColor=white" alt="SQLite">
</p>

---

## Why I Built This

Automating browser tasks is something a lot of companies are working on right now. Most of people's work lives inside a browser, and there's a whole industry trying to train models to execute these tasks in a human-like way.

From my own experience, I've had to sit down and shadow people's work for hours before building software that could handle it. The process of recollecting info from these multi-hour sessions, having to go back and watch recordings, and testing against expectations was super tedious.

I built this to make the data collection part easier. Frankly I didn't put much thought into what should be done with the data afterward—it could be used as training data for agents, tracking work done across an organization, whatever. The point is just to capture structured workflow data from real browser usage.

---

## What It Does

You turn on the recorder, do your work, and when you're done it gives you:

- **Canonical screens** — The distinct pages/states you visited
- **Workflow templates** — Patterns it identified, with inputs and steps
- **Workflow instances** — Specific examples of each pattern being executed

---

## How It Works

### Recording

1. Chrome extension captures clicks, inputs, form submissions
2. Each event includes a screenshot
3. Events stream to the backend and accumulate in memory
4. When you stop, the backend processes everything

### Processing Pipeline

When you finalize a session, it runs 3 stages:

**1. Screen Canonicalization**

Groups similar URLs into screen types. So `https://app.com/patients/123` and `https://app.com/patients/456` both become "Patient Detail Page".

**2. Instance Segmentation**

Chunks the event sequence into distinct tasks. A 20-minute session in an EHR might have 3 "patient creation" instances and 1 "update patient record" instance.

**3. Template Synthesis**

Merges similar instances into reusable templates with:
- Inputs (what you'd provide to run this workflow)
- Steps (the action sequence)
- Outputs (data extracted during execution)

### Data Model

```
Canonical Screens  →  Workflow Templates  →  Workflow Instances
(UI states)           (reusable patterns)    (concrete executions)
```

---

## Setup

### 1. Install
```bash
npm install
```

### 2. Configure
```bash
cp .env.example .env
# Add your OpenAI API key
```

```bash
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4.1              # optional
API_URL=http://localhost:3000     # optional
```

### 3. Run
```bash
npm run build:extension
npm run dev
```

### 4. Load Extension
1. Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. "Load unpacked" → select `extension/` folder

### 5. Use It
1. Click Rewind icon
2. Start Recording
3. Do stuff in a web app
4. Stop & Finalize
5. Check `http://localhost:3000`

---

## Project Structure

```
rewind/
├── backend/
│   ├── pipeline/           # The 3 processing stages
│   ├── db.ts               # SQLite stuff
│   ├── llm.ts              # OpenAI calls
│   ├── sessionStore.ts     # In-memory session state
│   └── server.ts           # Express routes
├── extension/
│   ├── src/
│   │   ├── background.ts   # Service worker
│   │   ├── contentScript.ts
│   │   └── popup.ts
│   └── dist/               # Built JS
├── frontend/
│   └── index.html          # Viewer dashboard
├── simulations/            # Test apps
└── storage/screenshots/
```

## Scripts

```bash
npm run dev              # Backend with hot reload
npm run build:extension  # Build extension
npm run watch:extension  # Watch mode
npm test                 # Tests
```

---

## Testing It Out

To test this, I spun up a dummy EHR environment. Cool thing about software these days is it allows for very quick testing. I spent some time looking for demo environments to test with and then realized I could just make my own. It took a single prompt to create a fully interactive EHR with a database, patient records, the whole thing.

It lives in `simulations`. There's a README in there with instructions for how anyone can create a new demo environment to test with. You can use it to try out the recorder in different settings. 

```bash
cd simulations/ehr
npm install
npm run seed    # Populate with fake data
npm run dev     # Runs on localhost:3001
```

---

## Limitations

- Vision-only, doesn't deeply parse DOM
- Single user at a time
- Captures workflows but doesn't replay them
- AI extraction quality varies
