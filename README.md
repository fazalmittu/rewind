# Workflow Recorder

A vision-only workflow recorder for browser-based applications. Records user interactions, captures screenshots, and uses GPT-4o to identify and document workflows.

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


