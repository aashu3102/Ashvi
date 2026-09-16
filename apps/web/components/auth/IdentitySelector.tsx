"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (val: string) => void;
  disabled: boolean;
}

const PRESET_IDENTITIES = [
  { name: "Aashu Singh", tag: "Primary Owner" },
  { name: "Authorized Operator", tag: "Secure Node" },
];

export function IdentitySelector({ value, onChange, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const selectIdentity = (identityName: string) => {
    onChange(identityName);
    setIsOpen(false);
  };

  return (
    <div className="auth-field-group">
      <label htmlFor="auth-identity-input" className="auth-field-label">
        Authorized Identity
      </label>
      <div className="auth-identity-wrap" ref={containerRef}>
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
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>

          <input
            id="auth-identity-input"
            className="auth-text-input"
            type="text"
            autoComplete="username"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="Aashu Singh"
          />

          <button
            type="button"
            className={`auth-dropdown-chevron ${isOpen ? "is-open" : ""}`}
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled}
            aria-label="Toggle suggested identities"
            aria-expanded={isOpen}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {isOpen && (
          <div className="auth-identity-popover" role="listbox">
            {PRESET_IDENTITIES.map((item) => (
              <button
                key={item.name}
                type="button"
                className={`auth-identity-option ${value === item.name ? "is-selected" : ""}`}
                onClick={() => selectIdentity(item.name)}
              >
                <span className="auth-identity-option-label">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>{item.name}</span>
                </span>
                <span className="auth-identity-option-tag">{item.tag}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
