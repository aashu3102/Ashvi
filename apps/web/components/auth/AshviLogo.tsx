export function AshviLogo({ className }: { className?: string }) {
  return (
    <div className={`auth-logo-emblem ${className || ""}`} aria-hidden="true">
      <svg
        className="auth-logo-svg"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="auth-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="auth-cyan-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7ee8fa" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#3ca5cc" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="auth-gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5ede0" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#d4af37" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* Outer orbital geometry */}
        <ellipse
          cx="50"
          cy="50"
          rx="44"
          ry="32"
          stroke="rgba(126, 232, 250, 0.35)"
          strokeWidth="1"
          transform="rotate(-25 50 50)"
        />

        {/* Inner tilted orbital ring */}
        <ellipse
          cx="50"
          cy="50"
          rx="38"
          ry="20"
          stroke="rgba(212, 175, 55, 0.45)"
          strokeWidth="0.9"
          strokeDasharray="3 3"
          transform="rotate(35 50 50)"
        />

        {/* Central Geometric 'A' Apex & Framework */}
        <path
          d="M50 20 L27 75 M50 20 L73 75"
          stroke="url(#auth-gold-grad)"
          strokeWidth="1.6"
          strokeLinecap="round"
          filter="url(#auth-glow)"
        />

        {/* Horizontal architectural crossbar */}
        <line
          x1="36"
          y1="56"
          x2="64"
          y2="56"
          stroke="url(#auth-cyan-grad)"
          strokeWidth="1.2"
        />

        {/* Central core rhomboid / node */}
        <polygon
          points="50,44 56,50 50,56 44,50"
          fill="rgba(126, 232, 250, 0.2)"
          stroke="#7ee8fa"
          strokeWidth="1"
        />

        {/* Tiny warm gold satellite spark */}
        <circle
          cx="76"
          cy="26"
          r="2.5"
          fill="#d4af37"
          filter="url(#auth-glow)"
        />
        <circle
          cx="76"
          cy="26"
          r="1"
          fill="#ffffff"
        />
      </svg>
    </div>
  );
}
