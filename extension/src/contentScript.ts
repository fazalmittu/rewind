/**
 * Content Script - Runs in the context of web pages
 *
 * Responsibilities:
 * - Request recording state from background script
 * - Listen for user clicks (only when recording)
 * - Send click events to background script for processing
 */

let sessionId: string | null = null;
let isRecording: boolean = false;

// Request state from background script on load
chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
  if (response) {
    sessionId = response.sessionId;
    isRecording = response.isRecording;
    console.log("[Workflow Recorder] State:", isRecording ? "RECORDING" : "IDLE", "Session:", sessionId);
  }
});

// Listen for state updates from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "STATE_UPDATE") {
    sessionId = msg.sessionId;
    isRecording = msg.isRecording;
    console.log("[Workflow Recorder] State updated:", isRecording ? "RECORDING" : "IDLE", "Session:", sessionId);
  }
});

// Capture click events
document.addEventListener(
  "click",
  (e) => {
    // Only capture if recording is active
    if (!isRecording || !sessionId) {
      return; // Silently ignore - not recording
    }

    const target = e.target as HTMLElement;

    // Build event payload
    const payload = {
      sessionId,
      timestamp: Date.now(),
      x: e.clientX,
      y: e.clientY,
      url: window.location.href,
      eventType: "click" as const,
      targetTag: target.tagName.toLowerCase(),
      targetText: target.textContent?.slice(0, 50) || "",
    };

    // Send to background script
    chrome.runtime.sendMessage({
      type: "USER_EVENT",
      payload,
    });

    console.log("[Workflow Recorder] Click captured:", payload.url);
  },
  true // Use capture phase to get all clicks
);

console.log("[Workflow Recorder] Content script loaded");
