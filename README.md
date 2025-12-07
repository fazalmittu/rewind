<p align="center">
  <img src="assets/logo.png" alt="Rewind" width="128" height="128">
</p>

<h1 align="center">Rewind</h1>

<p align="center">
  Record, understand, and replay browser workflows using AI.<br>
  Captures user interactions as reusable workflow templates with extracted parameters.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/OpenAI-GPT--4o-412991?logo=openai&logoColor=white" alt="OpenAI">
</p>

## What is Rewind?

Rewind watches you work and learns your workflows. It captures screenshots and interactions, then uses AI to:

- **Identify workflow patterns** - Segments video into repeatable workflows with clear inputs + steps
- **Extract parameters** - Learns which parts vary (search queries, names, values) vs. which are fixed
- **Generate reusable templates** - Creates step-by-step workflows that can be replayed with different inputs

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

Required environment variables:
```bash
OPENAI_API_KEY=sk-your-key-here    # Required
OPENAI_MODEL=gpt-4o                # Optional (default: gpt-4o)
API_URL=http://localhost:3000      # Optional (default: localhost:3000)
```

### 3. Start Backend
```bash
npm run dev
```

### 4. Load Extension
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` folder

### 5. Record Workflows
1. Click the Rewind extension icon
2. Click "Start Recording"
3. Perform your workflows in any web app
4. Click "Stop & Finalize"
5. View extracted templates at `http://localhost:3000`

## Development

### Scripts
```bash
npm run dev              # Start backend with hot reload
npm run build:extension  # Build extension
npm run watch:extension  # Watch extension for changes
npm test                 # Run tests
```

### Project Structure
```
├── backend/             # Express server + SQLite
│   └── pipeline/        # AI processing pipeline
├── extension/           # Chrome extension
│   ├── src/             # TypeScript source
│   └── dist/            # Compiled JS
├── frontend/            # Workflow viewer dashboard
└── storage/screenshots/ # Captured screenshots
```

## How It Works

1. **Capture** - Extension records clicks, inputs, and screenshots
2. **Canonicalize** - Groups similar screens into types (e.g., "Product Detail Page")
3. **Segment** - Identifies distinct workflow instances in the recording
4. **Synthesize** - Generates reusable templates with `{parameters}`

## License

MIT
