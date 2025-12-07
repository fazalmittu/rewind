# Rewind - Implementation Plan

> **Status**: Core Complete  
> **Last Updated**: 2025-12-07

---

## Completed Features ✅

### Core Recording
- [x] Click event capture
- [x] Input event capture (text fields, debounced)
- [x] Change event capture (dropdowns, checkboxes)
- [x] Submit event capture (forms)
- [x] Contenteditable support (ProseMirror, Quill, Draft.js, etc.)
- [x] Screenshot capture after UI stabilization
- [x] Session management (start/stop/finalize)

### Processing Pipeline
- [x] Screen canonicalization (GPT groups similar screens)
- [x] Instance segmentation (GPT identifies workflow boundaries)
- [x] Template synthesis (GPT creates reusable templates with parameters)
- [x] In-memory session store until finalization
- [x] Batch GPT processing at finalization

### Data Model
- [x] `canonical_screens` table
- [x] `workflow_templates` table with inputs/outputs
- [x] `workflow_instances` table with parameter values
- [x] JSON export functionality

### Frontend
- [x] Clean white design (Inter + JetBrains Mono fonts)
- [x] Template cards with inputs/outputs/steps
- [x] Expandable instances with parameter values
- [x] Screenshot thumbnails with modal viewer
- [x] Arrow key navigation in modal
- [x] Download JSON button
- [x] Clear All Data button

### Extension
- [x] Manifest V3 Chrome extension
- [x] Background service worker
- [x] Content script with event listeners
- [x] Popup with Start/Stop Recording buttons
- [x] Configurable API URL via build-time env

### Testing
- [x] DB tests (11 tests)
- [x] Server tests (14 tests)
- [x] Pipeline tests (7 tests)
- [x] Total: 32 tests passing

### Simulations
- [x] EHR simulation app (port 3001)
- [x] Simulation framework documented

---

## Backlog 📋

### High Priority

#### Template Matching Across Sessions
Currently each session creates new templates. Future:
- [ ] Compare new instances to existing templates
- [ ] Match similar workflows to existing templates
- [ ] Merge/update templates when patterns overlap

#### Parameter Schema Evolution
- [ ] Track parameter variations across instances
- [ ] Suggest new parameters when discovered
- [ ] Handle optional vs required parameters dynamically

#### Better Input Capture
- [ ] Capture input field values at form submit (not just field names)
- [ ] Handle React/Vue controlled inputs better
- [ ] Capture autocomplete selections

### Medium Priority

#### Replay Engine
- [ ] Generate Playwright/Puppeteer scripts from templates
- [ ] Parameter substitution in generated code
- [ ] Export to various automation formats

#### Template Editor
- [ ] Edit template names/descriptions in UI
- [ ] Merge templates manually
- [ ] Delete templates/instances
- [ ] Reorder steps

#### Better Segmentation
- [ ] Use screenshot similarity (not just URL patterns)
- [ ] Detect failed workflows (errors, back navigation)
- [ ] Handle multi-tab workflows

### Low Priority

#### Performance
- [ ] Compress screenshots before storage
- [ ] Paginate templates in frontend
- [ ] Cache GPT responses for similar screens

#### Export/Import
- [ ] Import templates from JSON
- [ ] Export to various formats (YAML, etc.)
- [ ] Share templates between users

#### Analytics
- [ ] Track workflow frequency
- [ ] Identify most common parameters
- [ ] Detect workflow variations

---

## Development Commands

```bash
# Backend
npm run dev              # Start with hot reload
npm test                 # Run tests
npm test -- --watch      # Watch mode

# Extension
npm run build:extension  # Build once
npm run watch:extension  # Watch mode

# Simulations
cd simulations/ehr
npm run dev              # Start EHR on port 3001
```

---

## Testing Checklist

### Extension Flow
1. [ ] Load extension in Chrome
2. [ ] Click extension icon → Start Recording
3. [ ] Perform actions in web app
4. [ ] Click extension icon → Stop & Finalize
5. [ ] View templates at http://localhost:3000

### Pipeline Verification
- [ ] Multiple workflows in one session are separated
- [ ] Similar screens get canonical labels
- [ ] Input parameters are extracted from typed text
- [ ] Template names are generic (not instance-specific)

### Frontend Verification
- [ ] Templates display with inputs/outputs
- [ ] Instances show actual parameter values
- [ ] Screenshots load and display
- [ ] Arrow key navigation works in modal
- [ ] JSON download works
- [ ] Clear All works

---

## Notes

### GPT Model Configuration
Set in `.env`:
```bash
OPENAI_MODEL=gpt-4o          # Default
OPENAI_MODEL=gpt-4o-mini     # Cheaper, faster
OPENAI_MODEL=gpt-4-turbo     # Alternative
```

### Extension API URL
Set at build time:
```bash
API_URL=https://api.example.com npm run build:extension
```

### Database Reset
To fully reset and recreate tables:
```bash
rm backend/data.db
npm run dev  # Recreates on startup
```

Or use the "Clear All" button in the frontend.
