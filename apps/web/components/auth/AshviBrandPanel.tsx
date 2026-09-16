import { AshviLogo } from "./AshviLogo";

export function AshviBrandPanel() {
  return (
    <section className="auth-brand-section" aria-label="Ashvi identity">
      <div className="auth-kicker-top" aria-hidden="true">
        <span>LOCAL</span>
        <i />
        <span>PRIVATE</span>
        <i />
        <span>YOURS</span>
      </div>

      <AshviLogo />

      <h1 className="auth-brand-name">ASHVI</h1>
      <p className="auth-brand-descriptor">PRIVATE INTELLIGENCE SYSTEM</p>

      <div className="auth-brand-divider" aria-hidden="true" />

      <div className="auth-node-specs" aria-hidden="true">
        <span>PRIVATE NODE</span>
        <span>LOCAL CORE</span>
        <span>SECURE CHANNEL</span>
      </div>

      <p className="auth-editorial-thought">
        &ldquo;A quiet place for your thoughts,<br />
        kept close to home.&rdquo;
      </p>

      <div className="auth-editorial-pillar">
        <p className="auth-editorial-pillar-quote">
          A more intelligent<br />
          you,<br />
          every day.
        </p>
        <div className="auth-editorial-tenets" aria-hidden="true">
          <span>FOCUS</span>
          <span>DISCIPLINE</span>
          <span>CREATE</span>
          <span>EVOLVE</span>
        </div>
      </div>

      <div className="auth-brand-footer" aria-hidden="true">
        <span>VERSION 0.1</span>
        <span className="auth-brand-footer-line" />
        <span>BUILT WITH PURPOSE</span>
      </div>
    </section>
  );
}
