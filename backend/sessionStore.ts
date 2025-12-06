import { SessionState, KnownScreen, SessionEvent } from "./types";
import crypto from "crypto";

/**
 * In-memory store for active recording sessions.
 * Data persisted to DB only on finalization.
 */
class SessionStore {
  private sessions: Map<string, SessionState> = new Map();

  /**
   * Get or create a session state
   */
  getOrCreate(sessionId: string): SessionState {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        knownScreens: [],
        events: [],
        lastScreenshotPath: null,
        lastScreenId: null,
        lastUrl: null,
        createdAt: Date.now(),
      };
      this.sessions.set(sessionId, session);
      console.log(`[SessionStore] Created new session: ${sessionId}`);
    }
    return session;
  }

  /**
   * Get a session (returns undefined if not found)
   */
  get(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Delete a session (after finalization)
   */
  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
    console.log(`[SessionStore] Deleted session: ${sessionId}`);
  }

  /**
   * Add a new screen to a session
   */
  addScreen(
    sessionId: string,
    screen: Omit<KnownScreen, "id" | "seenCount">
  ): KnownScreen {
    const session = this.getOrCreate(sessionId);
    const newScreen: KnownScreen = {
      id: `scr_${crypto.randomUUID().slice(0, 8)}`,
      label: screen.label,
      description: screen.description,
      urlPattern: screen.urlPattern,
      exampleScreenshotPath: screen.exampleScreenshotPath,
      seenCount: 1,
    };
    session.knownScreens.push(newScreen);
    console.log(`[SessionStore] Added screen: ${newScreen.label} (${newScreen.id})`);
    return newScreen;
  }

  /**
   * Get a screen by ID from a session
   */
  getScreenById(sessionId: string, screenId: string): KnownScreen | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    return session.knownScreens.find((s) => s.id === screenId);
  }

  /**
   * Increment seen count for a screen
   */
  incrementScreenCount(sessionId: string, screenId: string): void {
    const screen = this.getScreenById(sessionId, screenId);
    if (screen) {
      screen.seenCount++;
    }
  }

  /**
   * Add an event to a session
   */
  addEvent(sessionId: string, event: SessionEvent): void {
    const session = this.getOrCreate(sessionId);
    session.events.push(event);
    session.lastScreenId = event.screenId;
  }

  /**
   * Update the last screenshot path (for comparison in next classification)
   */
  updateLastScreenshot(
    sessionId: string,
    screenshotPath: string,
    url: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastScreenshotPath = screenshotPath;
      session.lastUrl = url;
    }
  }

  /**
   * Get stats for all active sessions
   */
  getStats(): {
    activeSessions: number;
    sessions: Array<{
      sessionId: string;
      screenCount: number;
      eventCount: number;
      createdAt: number;
    }>;
  } {
    const stats = {
      activeSessions: this.sessions.size,
      sessions: [] as Array<{
        sessionId: string;
        screenCount: number;
        eventCount: number;
        createdAt: number;
      }>,
    };

    for (const [sessionId, session] of this.sessions) {
      stats.sessions.push({
        sessionId,
        screenCount: session.knownScreens.length,
        eventCount: session.events.length,
        createdAt: session.createdAt,
      });
    }

    return stats;
  }

  /**
   * Clear all sessions (for testing)
   */
  clear(): void {
    this.sessions.clear();
  }
}

// Export singleton instance
export const sessionStore = new SessionStore();

