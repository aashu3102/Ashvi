interface Props {
  value: string;
  onChange: (val: string) => void;
  disabled: boolean;
}

export function AccessCodeInput({ value, onChange, disabled }: Props) {
  return (
    <div className="auth-field-group">
      <label htmlFor="auth-access-code-input" className="auth-field-label">
        Secret Access Code
      </label>
      <div className="auth-input-container">
        <span className="auth-field-icon" aria-hidden="true">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
        </span>
        <input
          id="auth-access-code-input"
          className="auth-text-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="••••"
        />
      </div>
    </div>
  );
}
