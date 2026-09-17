export interface InterruptionEvent {
  sessionId: string;
  interruptedAt: number;
  reason: "user_spoke" | "explicit_cancel" | "new_turn";
}

export class BargeInService {
  private readonly activeSessions = new Map<string, {
    cancellationToken: number;
    lastInterruptedAt?: number;
    abortController?: AbortController;
  }>();

  /**
   * Registers or gets an existing session token.
   */
  registerSession(sessionId: string): { token: number; abortSignal: AbortSignal } {
    let session = this.activeSessions.get(sessionId);
    if (!session) {
      const abortController = new AbortController();
      session = {
        cancellationToken: 1,
        abortController,
      };
      this.activeSessions.set(sessionId, session);
    } else if (!session.abortController || session.abortController.signal.aborted) {
      session.abortController = new AbortController();
    }
    return {
      token: session.cancellationToken,
      abortSignal: session.abortController!.signal,
    };
  }

  /**
   * Triggers an interruption for the given session.
   * Increments the token and aborts any active fetch/synthesis controllers.
   */
  interrupt(sessionId: string, reason: InterruptionEvent["reason"] = "user_spoke"): InterruptionEvent {
    let session = this.activeSessions.get(sessionId);
    const now = Date.now();

    if (!session) {
      session = {
        cancellationToken: 1,
        lastInterruptedAt: now,
      };
      this.activeSessions.set(sessionId, session);
    } else {
      session.cancellationToken += 1;
      session.lastInterruptedAt = now;
      if (session.abortController && !session.abortController.signal.aborted) {
        session.abortController.abort(new Error(`Interrupted: ${reason}`));
      }
      session.abortController = new AbortController();
    }

    return {
      sessionId,
      interruptedAt: now,
      reason,
    };
  }

  /**
   * Checks whether the current operation has been interrupted.
   */
  isInterrupted(sessionId: string, initialToken: number): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;
    return session.cancellationToken !== initialToken;
  }

  /**
   * Cleans up idle session tokens to prevent memory leaks.
   */
  cleanup(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session?.abortController && !session.abortController.signal.aborted) {
      session.abortController.abort();
    }
    this.activeSessions.delete(sessionId);
  }
}
