/**
 * Background Service Worker
 *
 * Responsibilities:
 * - Own and manage the session ID
 * - Receive click events from content scripts
 * - Wait for UI stabilization
 * - Capture screenshots
 * - Send events + screenshots to backend
 */

import { waitForStabilizedState } from "./stabilization";

let currentSessionId: string = "";

// Initialize session ID on install
chrome.runtime.onInstalled.addListener(() => {
  currentSessionId = crypto.randomUUID();
  chrome.storage.local.set({ currentSessionId });
  console.log("[Workflow Recorder] Installed, session ID:", currentSessionId);
});

// Restore session ID on startup
chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.local.get("currentSessionId");
  if (data.currentSessionId) {
    currentSessionId = data.currentSessionId;
    console.log("[Workflow Recorder] Restored session ID:", currentSessionId);
  } else {
    currentSessionId = crypto.randomUUID();
    chrome.storage.local.set({ currentSessionId });
    console.log("[Workflow Recorder] Created new session ID:", currentSessionId);
  }
});

// Also check storage on worker activation (service workers can restart)
chrome.storage.local.get("currentSessionId").then((data) => {
  if (data.currentSessionId) {
    currentSessionId = data.currentSessionId;
  } else {
    currentSessionId = crypto.randomUUID();
    chrome.storage.local.set({ currentSessionId });
  }
  console.log("[Workflow Recorder] Background ready, session ID:", currentSessionId);
});

/**
 * Reset session ID and return the new one
 */
function resetSessionId(): string {
  currentSessionId = crypto.randomUUID();
  chrome.storage.local.set({ currentSessionId });
  console.log("[Workflow Recorder] Session reset, new ID:", currentSessionId);

  // Notify all content scripts of the new session ID
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: "SESSION_ID_UPDATED",
          sessionId: currentSessionId,
        }).catch(() => {
          // Tab might not have content script loaded, ignore
        });
      }
    });
  });

  return currentSessionId;
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_SESSION_ID") {
    sendResponse({ sessionId: currentSessionId });
    return true;
  }

  if (msg.type === "RESET_SESSION") {
    const newId = resetSessionId();
    sendResponse({ sessionId: newId });
    return true;
  }

  if (msg.type === "USER_EVENT") {
    handleUserEvent(msg.payload);
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
    const response = await fetch("http://localhost:3000/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload,
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


