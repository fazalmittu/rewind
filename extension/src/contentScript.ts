/**
 * Content Script - Runs in the context of web pages
 *
 * Captures:
 * - Click events
 * - Input events (text typed into fields)
 * - Change events (dropdowns, checkboxes)
 * - Submit events (form submissions)
 * - Contenteditable changes (rich text editors like Linear, Notion, etc.)
 */

let sessionId: string | null = null;
let isRecording: boolean = false;

// Debounce timer for input events
let inputDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const INPUT_DEBOUNCE_MS = 800; // Increased for better text capture

// Track last input values to avoid duplicates
const lastInputValues: Map<string, string> = new Map();

// Track contenteditable elements we're observing
const observedEditables: WeakSet<Element> = new WeakSet();

// Request state from background script on load
chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
  if (response) {
    sessionId = response.sessionId;
    isRecording = response.isRecording;
    console.log("[Workflow Recorder] State:", isRecording ? "RECORDING" : "IDLE");
  }
});

// Listen for state updates from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "STATE_UPDATE") {
    sessionId = msg.sessionId;
    isRecording = msg.isRecording;
    console.log("[Workflow Recorder] State updated:", isRecording ? "RECORDING" : "IDLE");
  }
});

/**
 * Get a stable identifier for an element
 */
function getElementIdentifier(el: HTMLElement): string {
  if (el.id) return `#${el.id}`;
  if (el.name) return `[name="${el.name}"]`;
  if (el.className && typeof el.className === 'string') {
    return `.${el.className.split(' ').join('.')}`;
  }
  return el.tagName.toLowerCase();
}

/**
 * Get the label for an input element
 */
function getInputLabel(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  // Check for associated label
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return label.textContent?.trim() || '';
  }
  
  // Check for parent label
  const parentLabel = el.closest('label');
  if (parentLabel) {
    return parentLabel.textContent?.trim() || '';
  }
  
  // Check for placeholder
  if ('placeholder' in el && el.placeholder) {
    return el.placeholder;
  }
  
  // Check for aria-label
  if (el.getAttribute('aria-label')) {
    return el.getAttribute('aria-label') || '';
  }
  
  // Fallback to name or id
  return el.name || el.id || '';
}

/**
 * Send event to background script
 */
function sendEvent(payload: {
  eventType: "click" | "input" | "change" | "submit";
  url: string;
  timestamp: number;
  targetTag: string;
  targetText?: string;
  clickX?: number;
  clickY?: number;
  inputValue?: string;
  inputName?: string;
  inputLabel?: string;
  inputType?: string;
}) {
  if (!isRecording || !sessionId) return;

  chrome.runtime.sendMessage({
    type: "USER_EVENT",
    payload: {
      sessionId,
      ...payload,
    },
  });

  console.log(`[Workflow Recorder] ${payload.eventType} captured:`, payload.inputName || payload.targetText?.slice(0, 30));
}

// ============================================
// CLICK EVENTS
// ============================================
document.addEventListener(
  "click",
  (e) => {
    if (!isRecording || !sessionId) return;

    const target = e.target as HTMLElement;

    sendEvent({
      eventType: "click",
      url: window.location.href,
      timestamp: Date.now(),
      targetTag: target.tagName.toLowerCase(),
      targetText: target.textContent?.slice(0, 100) || "",
      clickX: e.clientX,
      clickY: e.clientY,
    });
  },
  true
);

// ============================================
// INPUT EVENTS (text fields)
// ============================================
document.addEventListener(
  "input",
  (e) => {
    if (!isRecording || !sessionId) return;

    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (!target || !('value' in target)) return;

    // Only capture text-like inputs
    const validTypes = ['text', 'search', 'email', 'url', 'tel', 'password', 'number'];
    if (target.tagName === 'INPUT' && !validTypes.includes((target as HTMLInputElement).type)) {
      return;
    }

    const elementId = getElementIdentifier(target);
    const currentValue = target.value;

    // Debounce: wait for user to stop typing
    if (inputDebounceTimer) {
      clearTimeout(inputDebounceTimer);
    }

    inputDebounceTimer = setTimeout(() => {
      // Skip if value hasn't meaningfully changed
      const lastValue = lastInputValues.get(elementId);
      if (lastValue === currentValue) return;
      
      // Skip empty values
      if (!currentValue.trim()) return;

      lastInputValues.set(elementId, currentValue);

      sendEvent({
        eventType: "input",
        url: window.location.href,
        timestamp: Date.now(),
        targetTag: target.tagName.toLowerCase(),
        inputValue: currentValue,
        inputName: target.name || target.id || '',
        inputLabel: getInputLabel(target),
        inputType: (target as HTMLInputElement).type || 'text',
      });
    }, INPUT_DEBOUNCE_MS);
  },
  true
);

// ============================================
// CHANGE EVENTS (dropdowns, checkboxes, radio)
// ============================================
document.addEventListener(
  "change",
  (e) => {
    if (!isRecording || !sessionId) return;

    const target = e.target as HTMLInputElement | HTMLSelectElement;
    if (!target) return;

    let value: string;
    let inputType: string;

    if (target.tagName === 'SELECT') {
      const select = target as HTMLSelectElement;
      value = select.options[select.selectedIndex]?.text || select.value;
      inputType = 'select';
    } else if (target.tagName === 'INPUT') {
      const input = target as HTMLInputElement;
      if (input.type === 'checkbox') {
        value = input.checked ? 'checked' : 'unchecked';
        inputType = 'checkbox';
      } else if (input.type === 'radio') {
        value = input.value;
        inputType = 'radio';
      } else {
        return; // Other input types handled by 'input' event
      }
    } else {
      return;
    }

    sendEvent({
      eventType: "change",
      url: window.location.href,
      timestamp: Date.now(),
      targetTag: target.tagName.toLowerCase(),
      inputValue: value,
      inputName: target.name || target.id || '',
      inputLabel: getInputLabel(target),
      inputType,
    });
  },
  true
);

// ============================================
// SUBMIT EVENTS (forms)
// ============================================
document.addEventListener(
  "submit",
  (e) => {
    if (!isRecording || !sessionId) return;

    const form = e.target as HTMLFormElement;
    if (!form) return;

    // Collect form data summary
    const formData = new FormData(form);
    const fields: string[] = [];
    formData.forEach((value, key) => {
      if (typeof value === 'string' && value.trim()) {
        fields.push(key);
      }
    });

    sendEvent({
      eventType: "submit",
      url: window.location.href,
      timestamp: Date.now(),
      targetTag: 'form',
      targetText: `Form with fields: ${fields.join(', ')}`,
      inputName: form.name || form.id || '',
    });
  },
  true
);

// ============================================
// CONTENTEDITABLE ELEMENTS (rich text editors)
// ============================================

// Debounce timer for contenteditable
let contenteditableDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Get the label for a contenteditable element
 */
function getContenteditableLabel(el: HTMLElement): string {
  // Check for aria-label
  if (el.getAttribute('aria-label')) {
    return el.getAttribute('aria-label') || '';
  }
  
  // Check for placeholder
  if (el.getAttribute('placeholder') || el.getAttribute('data-placeholder')) {
    return el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || '';
  }
  
  // Check for nearby label
  const parent = el.parentElement;
  if (parent) {
    const label = parent.querySelector('label');
    if (label) return label.textContent?.trim() || '';
  }
  
  // Check role
  if (el.getAttribute('role')) {
    return el.getAttribute('role') || '';
  }
  
  return 'text editor';
}

/**
 * Capture contenteditable content when user stops typing
 */
function captureContenteditable(el: HTMLElement) {
  if (!isRecording || !sessionId) return;
  
  const elementId = getElementIdentifier(el);
  const content = el.textContent?.trim() || el.innerText?.trim() || '';
  
  // Skip empty or very short content
  if (!content || content.length < 2) return;
  
  // Skip if content hasn't changed
  const lastValue = lastInputValues.get(elementId);
  if (lastValue === content) return;
  
  lastInputValues.set(elementId, content);
  
  sendEvent({
    eventType: "input",
    url: window.location.href,
    timestamp: Date.now(),
    targetTag: 'contenteditable',
    inputValue: content,
    inputName: el.id || el.getAttribute('name') || '',
    inputLabel: getContenteditableLabel(el),
    inputType: 'richtext',
  });
  
  console.log(`[Workflow Recorder] Contenteditable captured:`, content.slice(0, 50));
}

/**
 * Set up observer for a contenteditable element
 */
function observeContenteditable(el: HTMLElement) {
  if (observedEditables.has(el)) return;
  observedEditables.add(el);
  
  // Listen for input events on contenteditable
  el.addEventListener('input', () => {
    if (contenteditableDebounceTimer) {
      clearTimeout(contenteditableDebounceTimer);
    }
    contenteditableDebounceTimer = setTimeout(() => {
      captureContenteditable(el);
    }, INPUT_DEBOUNCE_MS);
  });
  
  // Also capture on blur (when user clicks away)
  el.addEventListener('blur', () => {
    if (contenteditableDebounceTimer) {
      clearTimeout(contenteditableDebounceTimer);
    }
    captureContenteditable(el);
  });
}

// Find and observe all contenteditable elements
function findAndObserveContenteditables() {
  const editables = document.querySelectorAll('[contenteditable="true"], [contenteditable=""]');
  editables.forEach((el) => {
    observeContenteditable(el as HTMLElement);
  });
  
  // Also check for common rich text editor classes
  const editorSelectors = [
    '.ProseMirror',           // Linear, Notion
    '.ql-editor',             // Quill
    '.DraftEditor-root',      // Draft.js
    '.tiptap',                // TipTap
    '[data-slate-editor]',    // Slate
    '.ce-block',              // Editor.js
    '[role="textbox"]',       // Generic
  ];
  
  editorSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach((el) => {
      if (el instanceof HTMLElement) {
        observeContenteditable(el);
      }
    });
  });
}

// Initial scan
findAndObserveContenteditables();

// Observe DOM for new contenteditable elements
const contentEditableObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          if (node.getAttribute('contenteditable') === 'true' || 
              node.getAttribute('contenteditable') === '') {
            observeContenteditable(node);
          }
          // Also check descendants
          node.querySelectorAll('[contenteditable="true"], [contenteditable=""]').forEach((el) => {
            observeContenteditable(el as HTMLElement);
          });
        }
      });
    } else if (mutation.type === 'attributes' && 
               mutation.attributeName === 'contenteditable') {
      const el = mutation.target as HTMLElement;
      if (el.getAttribute('contenteditable') === 'true' || 
          el.getAttribute('contenteditable') === '') {
        observeContenteditable(el);
      }
    }
  }
});

contentEditableObserver.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['contenteditable'],
});

console.log("[Workflow Recorder] Content script loaded with input + contenteditable capture");
