"use client";

export function AshviCoreOrb() {
  return (
    <div className="ashvi-living-intel-wrapper" aria-label="Ashvi Living Intelligence Visual">
      <div className="ashvi-intel-visual-container">
        {/* Ambient Ethereal Glow Halo (Translucent, non-blocking) */}
        <div className="ashvi-intel-ambient-glow" />

        {/* Multi-layered Sacred Constellation & Gyroscope SVG */}
        <svg
          className="ashvi-intel-svg"
          viewBox="0 0 240 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            {/* Gradients */}
            <linearGradient id="ashvi-gold-cyan" x1="0" y1="0" x2="240" y2="240" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f0d575" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#7ee8fa" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85" />
            </linearGradient>

            <radialGradient id="ashvi-core-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="28%" stopColor="#7ee8fa" stopOpacity="0.55" />
              <stop offset="65%" stopColor="#2563eb" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#050810" stopOpacity="0" />
            </radialGradient>

            <filter id="ashvi-soft-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Outer Astrolabe / Gyroscope Ring with cardinal ticks */}
          <g className="ashvi-ring-outer">
            <circle
              cx="120"
              cy="120"
              r="104"
              stroke="rgba(126, 232, 250, 0.24)"
              strokeWidth="1"
              strokeDasharray="4 8"
            />
            <circle
              cx="120"
              cy="120"
              r="98"
              stroke="rgba(212, 175, 55, 0.3)"
              strokeWidth="0.8"
            />
            {/* Cardinal Tick Marks */}
            <line x1="120" y1="12" x2="120" y2="22" stroke="#f0d575" strokeWidth="1.5" />
            <line x1="120" y1="218" x2="120" y2="228" stroke="#f0d575" strokeWidth="1.5" />
            <line x1="12" y1="120" x2="22" y2="120" stroke="#f0d575" strokeWidth="1.5" />
            <line x1="218" y1="120" x2="228" y2="120" stroke="#f0d575" strokeWidth="1.5" />

            {/* Satellite Nodes on Outer Ring */}
            <circle cx="120" cy="16" r="2.5" fill="#f0d575" filter="url(#ashvi-soft-glow)" />
            <circle cx="120" cy="224" r="2.5" fill="#f0d575" filter="url(#ashvi-soft-glow)" />
            <circle cx="16" cy="120" r="2.5" fill="#7ee8fa" filter="url(#ashvi-soft-glow)" />
            <circle cx="224" cy="120" r="2.5" fill="#7ee8fa" filter="url(#ashvi-soft-glow)" />
          </g>

          {/* Elliptical Precession Ring 1 (Tilted 35 deg) */}
          <g className="ashvi-ellipse-orbit-1">
            <ellipse
              cx="120"
              cy="120"
              rx="88"
              ry="42"
              stroke="rgba(126, 232, 250, 0.45)"
              strokeWidth="1.2"
              transform="rotate(35 120 120)"
            />
            <circle
              cx="195"
              cy="120"
              r="3"
              fill="#ffffff"
              filter="url(#ashvi-soft-glow)"
              transform="rotate(35 120 120)"
            />
          </g>

          {/* Elliptical Precession Ring 2 (Tilted -35 deg) */}
          <g className="ashvi-ellipse-orbit-2">
            <ellipse
              cx="120"
              cy="120"
              rx="88"
              ry="42"
              stroke="rgba(212, 175, 55, 0.4)"
              strokeWidth="1.2"
              strokeDasharray="6 6"
              transform="rotate(-35 120 120)"
            />
            <circle
              cx="45"
              cy="120"
              r="3"
              fill="#f0d575"
              filter="url(#ashvi-soft-glow)"
              transform="rotate(-35 120 120)"
            />
          </g>

          {/* Dynamic Resonant Ring */}
          <circle
            className="ashvi-resonant-ring"
            cx="120"
            cy="120"
            r="60"
            stroke="url(#ashvi-gold-cyan)"
            strokeWidth="1"
            strokeDasharray="2 12"
          />

          {/* Constellation Filament Network & Sacred Ashvi Geometry */}
          <g className="ashvi-constellation-network">
            {/* Geometric Octagram Nexus Lines */}
            <polygon
              points="120,68 156,84 172,120 156,156 120,172 84,156 68,120 84,84"
              stroke="rgba(126, 232, 250, 0.25)"
              strokeWidth="0.9"
              fill="none"
            />
            <polygon
              points="120,76 150,120 120,164 90,120"
              stroke="rgba(240, 213, 117, 0.4)"
              strokeWidth="1"
              fill="rgba(14, 28, 48, 0.12)"
            />

            {/* Central Blade Emblem Light Vector */}
            <path
              d="M120,82 L128,114 L138,120 L126,126 L128,154 L120,144 L112,154 L114,126 L102,120 L112,114 Z"
              stroke="url(#ashvi-gold-cyan)"
              strokeWidth="1.2"
              fill="rgba(56, 189, 248, 0.06)"
            />
            <line x1="120" y1="78" x2="120" y2="148" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.8" />

            {/* Constellation Synaptic Nodes */}
            <circle cx="120" cy="68" r="2" fill="#7ee8fa" />
            <circle cx="172" cy="120" r="2" fill="#7ee8fa" />
            <circle cx="120" cy="172" r="2" fill="#7ee8fa" />
            <circle cx="68" cy="120" r="2" fill="#7ee8fa" />
            <circle cx="156" cy="84" r="2" fill="#f0d575" />
            <circle cx="156" cy="156" r="2" fill="#f0d575" />
            <circle cx="84" cy="156" r="2" fill="#f0d575" />
            <circle cx="84" cy="84" r="2" fill="#f0d575" />
          </g>

          {/* Central Living Pulse Core (Translucent radiant starburst, NOT an opaque ball) */}
          <g className="ashvi-living-core-pulse">
            <circle cx="120" cy="120" r="26" fill="url(#ashvi-core-glow)" />
            <circle cx="120" cy="120" r="4" fill="#ffffff" filter="url(#ashvi-soft-glow)" />
            <circle cx="120" cy="120" r="9" stroke="rgba(126, 232, 250, 0.7)" strokeWidth="0.8" />
          </g>
        </svg>

        {/* Ambient Micro Particle Sparks */}
        <span className="ashvi-intel-spark ashvi-spark-a" />
        <span className="ashvi-intel-spark ashvi-spark-b" />
        <span className="ashvi-intel-spark ashvi-spark-c" />
        <span className="ashvi-intel-spark ashvi-spark-d" />
      </div>

      {/* Brand Title Beneath */}
      <div className="ashvi-core-label" aria-hidden="true">
        <p className="ashvi-core-label-title">A S H V I</p>
        <p className="ashvi-core-label-sub">LIVING INTELLIGENCE</p>
      </div>
    </div>
  );
}
