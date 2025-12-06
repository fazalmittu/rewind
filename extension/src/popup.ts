/**
 * Popup Script
 *
 * Responsibilities:
 * - Display current session ID
 * - Handle "Stop & Finalize" button
 * - Show success/error messages
 */

const BACKEND_URL = "http://localhost:3000";

// Get DOM elements
const sessionIdEl = document.getElementById("sessionId")!;
const finalizeBtn = document.getElementById("finalizeBtn") as HTMLButtonElement;
const messageEl = document.getElementById("message")!;

/**
 * Load and display the current session ID
 */
async function loadSessionId() {
  const data = await chrome.storage.local.get("currentSessionId");
  if (data.currentSessionId) {
    sessionIdEl.textContent = data.currentSessionId;
  } else {
    sessionIdEl.textContent = "No session";
  }
}

/**
 * Show a message to the user
 */
function showMessage(text: string, type: "success" | "error") {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

/**
 * Handle finalize button click
 */
async function handleFinalize() {
  const sessionId = sessionIdEl.textContent;

  if (!sessionId || sessionId === "Loading..." || sessionId === "No session") {
    showMessage("No active session to finalize", "error");
    return;
  }

  // Disable button during processing
  finalizeBtn.disabled = true;
  finalizeBtn.textContent = "Processing...";

  try {
    // Call backend to finalize session
    const response = await fetch(`${BACKEND_URL}/finalize-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();

    // Reset session ID for next recording
    chrome.runtime.sendMessage({ type: "RESET_SESSION" }, (response) => {
      if (response?.sessionId) {
        sessionIdEl.textContent = response.sessionId;
      }
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
    // Re-enable button
    finalizeBtn.disabled = false;
    finalizeBtn.textContent = "Stop & Finalize Session";
  }
}

// Set up event listeners
finalizeBtn.addEventListener("click", handleFinalize);

// Load session ID on popup open
loadSessionId();

console.log("[Workflow Recorder] Popup loaded");


