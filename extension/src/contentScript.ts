/**
 * Content Script - Runs in the context of web pages
 *
 * Responsibilities:
 * - Request session ID from background script
 * - Listen for user clicks
 * - Send click events to background script for processing
 */

let sessionId: string | null = null;

// Request session ID from background script on load
chrome.runtime.sendMessage({ type: "GET_SESSION_ID" }, (response) => {
  if (response?.sessionId) {
    sessionId = response.sessionId;
    console.log("[Workflow Recorder] Session ID:", sessionId);
  }
});

// Listen for session ID updates (e.g., after finalization)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SESSION_ID_UPDATED") {
    sessionId = msg.sessionId;
    console.log("[Workflow Recorder] Session ID updated:", sessionId);
  }
});

// Capture click events
document.addEventListener(
  "click",
  (e) => {
    if (!sessionId) {
      console.warn("[Workflow Recorder] No session ID, skipping event");
      return;
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
      // Include some context about what was clicked (for debugging)
      targetTag: target.tagName.toLowerCase(),
      targetText: target.textContent?.slice(0, 50) || "",
    };

    // Send to background script
    chrome.runtime.sendMessage({
      type: "USER_EVENT",
      payload,
    });

    console.log("[Workflow Recorder] Click captured:", payload);
  },
  true // Use capture phase to get all clicks
);

console.log("[Workflow Recorder] Content script loaded");


