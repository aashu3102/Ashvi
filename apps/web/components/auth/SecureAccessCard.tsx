import { FormEvent } from "react";
import { IdentitySelector } from "./IdentitySelector";
import { AccessCodeInput } from "./AccessCodeInput";
import { PasswordInput } from "./PasswordInput";
import { AuthenticateButton } from "./AuthenticateButton";
import { SecurityStatus } from "./SecurityStatus";

interface Props {
  state: "checking" | "locked" | "login" | "unlocking" | "authenticated";
  username: string;
  setUsername: (val: string) => void;
  code: string;
  setCode: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  message: string;
  submitting: boolean;
  onLogin: (e: FormEvent) => void;
}

export function SecureAccessCard({
  state,
  username,
  setUsername,
  code,
  setCode,
  password,
  setPassword,
  message,
  submitting,
  onLogin,
}: Props) {
  return (
    <aside className="auth-card-section" aria-label="Secure access panel">
      <div className="auth-glass-panel">
        <div className="auth-panel-glint" aria-hidden="true" />

        {/* Card Header */}
        <div className="auth-card-header">
          <span className="auth-card-index">01 / PRIVATE ENTRANCE</span>
          <span className="auth-card-status-badge">
            <span className="auth-status-dot" aria-hidden="true" />
            <span>LOCAL</span>
          </span>
        </div>

        {/* Card Titles */}
        <div className="auth-card-titles">
          <p className="auth-card-kicker">SECURE ACCESS</p>
          <h2 className="auth-card-title">Enter Ashvi</h2>
          <p className="auth-card-subtitle">IDENTITY VERIFICATION REQUIRED</p>
        </div>

        {state === "locked" ? (
          <div className="auth-state-box is-locked" role="alert">
            <span className="auth-state-icon" aria-hidden="true">!</span>
            <strong className="auth-state-title">Access Temporarily Locked</strong>
            <span className="auth-state-desc">
              Rate limit exceeded due to multiple unsuccessful attempts. Please wait before retrying.
            </span>
          </div>
        ) : state === "unlocking" ? (
          <div className="auth-state-box is-unlocking" role="status" aria-live="polite">
            <span className="auth-state-icon" aria-hidden="true">✓</span>
            <strong className="auth-state-title">Identity Verified</strong>
            <span className="auth-state-desc">
              Initializing private channel and opening your personal workspace...
            </span>
          </div>
        ) : (
          <form className="auth-form" onSubmit={onLogin}>
            <IdentitySelector
              value={username}
              onChange={setUsername}
              disabled={submitting}
            />

            <AccessCodeInput
              value={code}
              onChange={setCode}
              disabled={submitting}
            />

            <PasswordInput
              value={password}
              onChange={setPassword}
              disabled={submitting}
            />

            {message && (
              <p className="auth-alert-message auth-alert-error" role="alert">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{message}</span>
              </p>
            )}

            <AuthenticateButton submitting={submitting} />
          </form>
        )}

        <SecurityStatus />
      </div>
    </aside>
  );
}
