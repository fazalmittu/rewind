<p align="center">
  <img src="assets/logo.png" alt="Workflow Recorder" width="128" height="128">
</p>

<h1 align="center">Workflow Recorder</h1>

<p align="center">
  A vision-only workflow recorder for browser-based applications.<br>
  Records user interactions, captures screenshots, and uses AI to identify and document workflows.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/OpenAI-GPT--4o-412991?logo=openai&logoColor=white" alt="OpenAI">
</p>

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

Required environment variables in `.env`:
```bash
OPENAI_API_KEY=sk-your-key-here    # Required: Your OpenAI API key
OPENAI_MODEL=gpt-4o                # Optional: Model to use (default: gpt-4o)
API_URL=http://localhost:3000      # Optional: Backend URL (default: localhost:3000)
```

Supported models: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-5.1`, etc.

### 3. Start Backend
```bash
npm run dev
```

### 4. Load Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` folder

### 5. Record Workflows
1. Navigate to any web application
2. Click around to record interactions
3. Open the extension popup and click "Stop & Finalize"
4. View workflows at `http://localhost:3000/`

## Development

### Scripts
```bash
npm run dev              # Start backend in dev mode
npm run build            # Build backend
npm run build:extension  # Build extension
npm run watch:extension  # Watch extension for changes
npm test                 # Run tests
npm test -- --watch      # Run tests in watch mode
npm test -- --coverage   # Run tests with coverage
```

### Project Structure
```
├── backend/             # Express server + SQLite
├── extension/           # Chrome extension
│   ├── src/            # TypeScript source
│   └── dist/           # Compiled JS
├── frontend/           # Simple workflow viewer
└── storage/screenshots/ # Captured screenshots
```

## Documentation
- [Technical Design](./TECHNICAL_DESIGN.md)
- [Implementation Plan](./IMPLEMENTATION_PLAN.md)


