/**
 * Popup Script
 *
 * Responsibilities:
 * - Display current recording state
 * - Handle "Start Recording" button
 * - Handle "Stop & Finalize" button
 * - Show success/error messages
 */

// API URL injected at build time from environment variable
const BACKEND_URL = process.env.API_URL || "http://localhost:3000";

// Get DOM elements
const statusContainer = document.getElementById("statusContainer")!;
const statusDot = document.getElementById("statusDot")!;
const statusText = document.getElementById("statusText")!;
const sessionInfo = document.getElementById("sessionInfo")!;
const sessionIdEl = document.getElementById("sessionId")!;
const startBtn = document.getElementById("startBtn") as HTMLButtonElement;
const finalizeBtn = document.getElementById("finalizeBtn") as HTMLButtonElement;
const messageEl = document.getElementById("message")!;

let currentState: { sessionId: string | null; isRecording: boolean } = {
  sessionId: null,
  isRecording: false,
};

/**
 * Update UI based on current state
 */
function updateUI() {
  if (currentState.isRecording && currentState.sessionId) {
    // Recording active
    statusContainer.className = "status recording";
    statusDot.className = "status-dot recording";
    statusText.textContent = "Recording active";
    sessionInfo.style.display = "block";
    sessionIdEl.textContent = currentState.sessionId;
    startBtn.style.display = "none";
    finalizeBtn.style.display = "block";
  } else {
    // Not recording
    statusContainer.className = "status idle";
    statusDot.className = "status-dot idle";
    statusText.textContent = "Not recording";
    sessionInfo.style.display = "none";
    startBtn.style.display = "block";
    finalizeBtn.style.display = "none";
  }
}

/**
 * Load current state from background
 */
async function loadState() {
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
    if (response) {
      currentState = response;
      updateUI();
    }
  });
}

/**
 * Show a message to the user
 */
function showMessage(text: string, type: "success" | "error") {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.style.display = "block";
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    messageEl.style.display = "none";
  }, 5000);
}

/**
 * Handle start button click
 */
async function handleStart() {
  startBtn.disabled = true;
  startBtn.textContent = "Starting...";

  try {
    chrome.runtime.sendMessage({ type: "START_RECORDING" }, (response) => {
      if (response?.sessionId) {
        currentState = { sessionId: response.sessionId, isRecording: true };
        updateUI();
        showMessage("Recording started! Click around to capture workflows.", "success");
      }
    });
  } catch (error) {
    showMessage("Failed to start recording", "error");
  } finally {
    startBtn.disabled = false;
    startBtn.textContent = "Start Recording";
  }
}

/**
 * Handle finalize button click
 */
async function handleFinalize() {
  if (!currentState.sessionId) {
    showMessage("No active session to finalize", "error");
    return;
  }

  finalizeBtn.disabled = true;
  finalizeBtn.textContent = "Processing...";

  try {
    // First stop recording
    chrome.runtime.sendMessage({ type: "STOP_RECORDING" });

    // Then finalize with backend
    const response = await fetch(`${BACKEND_URL}/finalize-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: currentState.sessionId }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();

    // Clear session
    chrome.runtime.sendMessage({ type: "CLEAR_SESSION" }, () => {
      currentState = { sessionId: null, isRecording: false };
      updateUI();
    });

    // Show success message
    const workflowCount = result.refined?.length || 0;
    showMessage(
      `Session finalized! ${workflowCount} workflow${workflowCount !== 1 ? "s" : ""} created.`,
      "success"
    );
  } catch (error) {
    console.error("Finalize error:", error);
    showMessage(
      error instanceof Error ? error.message : "Failed to finalize session",
      "error"
    );
  } finally {
    finalizeBtn.disabled = false;
    finalizeBtn.textContent = "Stop & Finalize";
  }
}

// Set up event listeners
startBtn.addEventListener("click", handleStart);
finalizeBtn.addEventListener("click", handleFinalize);

// Set the workflows link dynamically
const viewWorkflowsLink = document.getElementById("viewWorkflowsLink") as HTMLAnchorElement;
if (viewWorkflowsLink) {
  viewWorkflowsLink.href = BACKEND_URL;
}

// Load state on popup open
loadState();

console.log("[Workflow Recorder] Popup loaded");
