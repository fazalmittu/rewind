/**
 * Background Service Worker
 *
 * Responsibilities:
 * - Own and manage the session ID
 * - Track recording state (on/off)
 * - Receive events from content scripts (clicks, inputs, changes, submits)
 * - Capture screenshots
 * - Send events + screenshots to backend
 * - Handle keyboard shortcuts
 */

import { waitForStabilizedState } from "./stabilization";

// API URL injected at build time from environment variable
const API_URL = process.env.API_URL || "http://localhost:3000";

let currentSessionId: string | null = null;
let isRecording: boolean = false;

const Commands = {
  TOGGLE_RECORDING: "toggle-recording",
  FINALIZE_SESSION: "finalize-session",
} as const;

/**
 * Update the extension badge to reflect recording state
 */
function updateBadge(): void {
  if (isRecording) {
    chrome.action.setBadgeText({ text: "REC" });
    chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

// Restore state on worker activation (service workers can restart)
chrome.storage.local.get(["currentSessionId", "isRecording"]).then((data) => {
  currentSessionId = data.currentSessionId || null;
  isRecording = data.isRecording || false;
  updateBadge();
  console.log("[Workflow Recorder] Background ready, recording:", isRecording, "session:", currentSessionId);
});

/**
 * Start a new recording session
 */
function startRecording(): { sessionId: string } {
  currentSessionId = crypto.randomUUID();
  isRecording = true;
  chrome.storage.local.set({ currentSessionId, isRecording });
  updateBadge();
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
  updateBadge();
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
  updateBadge();
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
    console.log("[Workflow Recorder] USER_EVENT received, isRecording:", isRecording, "sessionId:", currentSessionId);
    // Only process if recording is active
    if (isRecording && currentSessionId) {
      handleUserEvent(msg.payload);
    } else {
      console.log("[Workflow Recorder] Skipping event - not recording");
    }
    return true;
  }

  return false;
});

/**
 * Handle a user event:
 * 1. Wait for stabilization (for clicks that cause navigation)
 * 2. Capture screenshot
 * 3. Send to backend
 */
async function handleUserEvent(payload: {
  sessionId: string;
  timestamp: number;
  url: string;
  eventType: "click" | "input" | "change" | "submit";
  targetTag: string;
  targetText?: string;
  clickX?: number;
  clickY?: number;
  inputValue?: string;
  inputName?: string;
  inputLabel?: string;
  inputType?: string;
}) {
  // Double-check recording state
  if (!isRecording || !currentSessionId) {
    console.log("[Workflow Recorder] Not recording, skipping event");
    return;
  }

  try {
    // For click events, wait for UI to stabilize (might trigger navigation)
    // For input/change events, capture immediately
    if (payload.eventType === "click") {
      await waitForStabilizedState(400);
    } else {
      await waitForStabilizedState(100); // Short delay for input events
    }

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

    const result = await response.json();
    console.log(`[Workflow Recorder] ${payload.eventType} event sent:`, result.significant ? "significant" : "not significant");
  } catch (error) {
    console.error("[Workflow Recorder] Error handling event:", error);
  }
}

/**
 * Finalize the current session by sending to backend
 */
async function finalizeSession(): Promise<boolean> {
  if (!currentSessionId) {
    console.log("[Workflow Recorder] No session to finalize");
    return false;
  }

  const sessionIdToFinalize = currentSessionId;
  
  try {
    stopRecording();
    
    const response = await fetch(`${API_URL}/finalize-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionIdToFinalize }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();
    console.log("[Workflow Recorder] Session finalized:", result);
    
    clearSession();
    return true;
  } catch (error) {
    console.error("[Workflow Recorder] Finalize error:", error);
    return false;
  }
}

/**
 * Handle keyboard shortcut commands.
 */
chrome.commands.onCommand.addListener(async (command) => {
  if (command === Commands.TOGGLE_RECORDING) {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  if (command === Commands.FINALIZE_SESSION && currentSessionId) {
    await finalizeSession();
  }
});

console.log("[Workflow Recorder] Background service worker loaded");
