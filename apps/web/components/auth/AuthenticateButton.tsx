interface Props {
  submitting: boolean;
}

export function AuthenticateButton({ submitting }: Props) {
  return (
    <button className="auth-submit-btn" type="submit" disabled={submitting}>
      <span className="auth-submit-text">
        {submitting ? "VERIFYING IDENTITY…" : "AUTHENTICATE"}
      </span>
      <span className="auth-submit-arrow" aria-hidden="true">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </span>
    </button>
  );
}
