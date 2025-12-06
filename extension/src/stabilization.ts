/**
 * Wait for the UI to stabilize after an interaction.
 * This is a simple timeout-based approach for v1.
 *
 * Future improvements could:
 * - Use MutationObserver to detect DOM stability
 * - Check for pending network requests
 * - Monitor animation completion
 */
export function waitForStabilizedState(ms: number = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


