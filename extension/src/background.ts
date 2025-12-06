/**
 * Background Service Worker
 *
 * Responsibilities:
 * - Own and manage the session ID
 * - Track recording state (on/off)
 * - Receive click events from content scripts
 * - Wait for UI stabilization
 * - Capture screenshots
 * - Send events + screenshots to backend
 */

import { waitForStabilizedState } from "./stabilization";

// API URL injected at build time from environment variable
const API_URL = process.env.API_URL || "http://localhost:3000";

let currentSessionId: string | null = null;
let isRecording: boolean = false;

// Restore state on worker activation (service workers can restart)
chrome.storage.local.get(["currentSessionId", "isRecording"]).then((data) => {
  currentSessionId = data.currentSessionId || null;
  isRecording = data.isRecording || false;
  console.log("[Workflow Recorder] Background ready, recording:", isRecording, "session:", currentSessionId);
});

/**
 * Start a new recording session
 */
function startRecording(): { sessionId: string } {
  currentSessionId = crypto.randomUUID();
  isRecording = true;
  chrome.storage.local.set({ currentSessionId, isRecording });
  console.log("[Workflow Recorder] Recording STARTED, session ID:", currentSessionId);

  // Notify all content scripts
  notifyContentScripts();

  return { sessionId: currentSessionId };
}

/**
 * Stop recording (but don't finalize yet)
 */
function stopRecording(): void {
  isRecording = false;
  chrome.storage.local.set({ isRecording });
  console.log("[Workflow Recorder] Recording STOPPED");

  // Notify all content scripts
  notifyContentScripts();
}

/**
 * Clear session after finalization
 */
function clearSession(): void {
  currentSessionId = null;
  isRecording = false;
  chrome.storage.local.set({ currentSessionId: null, isRecording: false });
  console.log("[Workflow Recorder] Session cleared");

  // Notify all content scripts
  notifyContentScripts();
}

/**
 * Notify all content scripts of current state
 */
function notifyContentScripts(): void {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: "STATE_UPDATE",
          sessionId: currentSessionId,
          isRecording,
        }).catch(() => {
          // Tab might not have content script loaded, ignore
        });
      }
    });
  });
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_STATE") {
    sendResponse({ 
      sessionId: currentSessionId, 
      isRecording 
    });
    return true;
  }

  if (msg.type === "START_RECORDING") {
    const result = startRecording();
    sendResponse(result);
    return true;
  }

  if (msg.type === "STOP_RECORDING") {
    stopRecording();
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "CLEAR_SESSION") {
    clearSession();
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "USER_EVENT") {
    // Only process if recording is active
    if (isRecording && currentSessionId) {
      handleUserEvent(msg.payload);
    }
    return true;
  }

  return false;
});

/**
 * Handle a user event:
 * 1. Wait for stabilization
 * 2. Capture screenshot
 * 3. Send to backend
 */
async function handleUserEvent(payload: {
  sessionId: string;
  timestamp: number;
  x: number;
  y: number;
  url: string;
  eventType: "click";
}) {
  // Double-check recording state
  if (!isRecording || !currentSessionId) {
    console.log("[Workflow Recorder] Not recording, skipping event");
    return;
  }

  try {
    // Wait for UI to stabilize
    await waitForStabilizedState(400);

    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      console.error("[Workflow Recorder] No active tab");
      return;
    }

    // Capture screenshot
    const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
      format: "png",
    });

    // Send to backend
    const response = await fetch(`${API_URL}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: {
          ...payload,
          sessionId: currentSessionId, // Use current session ID
        },
        screenshot: dataUrl,
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    console.log("[Workflow Recorder] Event sent to backend successfully");
  } catch (error) {
    console.error("[Workflow Recorder] Error handling event:", error);
  }
}

console.log("[Workflow Recorder] Background service worker loaded");
