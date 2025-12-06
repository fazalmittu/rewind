import { SessionState, CapturedEvent } from "./types";

/**
 * In-memory store for active recording sessions.
 * Stores captured events until finalization.
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
        events: [],
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
   * Add an event to a session
   */
  addEvent(sessionId: string, event: CapturedEvent): void {
    const session = this.getOrCreate(sessionId);
    session.events.push(event);
    console.log(`[SessionStore] Added ${event.eventType} event to session ${sessionId} (total: ${session.events.length})`);
  }

  /**
   * Get all events for a session
   */
  getEvents(sessionId: string): CapturedEvent[] {
    const session = this.sessions.get(sessionId);
    return session?.events || [];
  }

  /**
   * Get stats for all active sessions
   */
  getStats(): {
    activeSessions: number;
    sessions: Array<{
      sessionId: string;
      eventCount: number;
      createdAt: number;
    }>;
  } {
    const stats = {
      activeSessions: this.sessions.size,
      sessions: [] as Array<{
        sessionId: string;
        eventCount: number;
        createdAt: number;
      }>,
    };

    for (const [sessionId, session] of this.sessions) {
      stats.sessions.push({
        sessionId,
        eventCount: session.events.length,
        createdAt: session.createdAt,
      });
    }

    return stats;
  }

  /**
   * Clear all sessions (for testing/reset)
   */
  clear(): void {
    this.sessions.clear();
    console.log("[SessionStore] All sessions cleared");
  }
}

// Export singleton instance
export const sessionStore = new SessionStore();
