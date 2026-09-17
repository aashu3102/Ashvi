export type VoiceSessionState =
  | "IDLE"
  | "LISTENING"
  | "TRANSCRIBING"
  | "THINKING"
  | "SPEAKING"
  | "INTERRUPTED"
  | "ERROR";

export interface VoiceSessionInfo {
  sessionId: string;
  userId?: string;
  state: VoiceSessionState;
  previousState?: VoiceSessionState;
  updatedAt: number;
  error?: string;
}

export class VoiceSessionService {
  private readonly sessions = new Map<string, VoiceSessionInfo>();

  private readonly validTransitions: Record<VoiceSessionState, VoiceSessionState[]> = {
    IDLE: ["LISTENING", "TRANSCRIBING", "THINKING", "INTERRUPTED", "ERROR"],
    LISTENING: ["TRANSCRIBING", "THINKING", "INTERRUPTED", "IDLE", "ERROR"],
    TRANSCRIBING: ["THINKING", "INTERRUPTED", "IDLE", "ERROR"],
    THINKING: ["SPEAKING", "INTERRUPTED", "IDLE", "ERROR"],
    SPEAKING: ["IDLE", "INTERRUPTED", "LISTENING", "ERROR"],
    INTERRUPTED: ["IDLE", "LISTENING", "THINKING", "ERROR"],
    ERROR: ["IDLE", "LISTENING"],
  };

  getOrCreateSession(sessionId: string, userId?: string): VoiceSessionInfo {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        userId,
        state: "IDLE",
        updatedAt: Date.now(),
      };
      this.sessions.set(sessionId, session);
    }
    return session;
  }

  getSession(sessionId: string): VoiceSessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  transition(sessionId: string, nextState: VoiceSessionState, errorMessage?: string): VoiceSessionInfo {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = this.getOrCreateSession(sessionId);
    }

    const currentState = session.state;
    const allowed = this.validTransitions[currentState];

    if (!allowed.includes(nextState)) {
      // Force safe fallback transition to IDLE or ERROR if unexpected
      if (nextState !== "IDLE" && nextState !== "ERROR") {
        throw new Error(`Invalid state transition from ${currentState} to ${nextState}`);
      }
    }

    session.previousState = currentState;
    session.state = nextState;
    session.updatedAt = Date.now();
    session.error = nextState === "ERROR" ? errorMessage : undefined;

    return session;
  }

  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
