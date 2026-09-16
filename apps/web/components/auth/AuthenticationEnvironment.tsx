export function AuthenticationEnvironment() {
  return (
    <>
      {/* LAYER 1: Fullscreen physical workspace photograph */}
      <div className="auth-photo-layer" aria-hidden="true" />

      {/* LAYER 2: Cinematic atmospheric overlays (navy/charcoal wash, warm lamp glow, cool window blue, edge vignette) */}
      <div className="auth-overlay-layer" aria-hidden="true">
        <div className="auth-overlay-vignette" />
        <div className="auth-overlay-warm" />
        <div className="auth-overlay-cool" />
        <div className="auth-overlay-depth" />
      </div>
    </>
  );
}
