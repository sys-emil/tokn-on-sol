import Link from 'next/link';
import { PasslyLogo } from '@/app/components/PasslyLogo';

/*
 * Shared shell for legal pages (/impressum, /datenschutz, /agb).
 * Server component: plain content pages, no Privy.
 *
 * Legal copy convention: unresolved facts are marked as [PLATZHALTER: …].
 * Grep for "PLATZHALTER" before go-live; none may remain.
 */

const SHELL_CSS = `
  .legal-wrap { max-width: 760px; margin: 0 auto; }
  .legal-head { padding: 48px 0 8px; }
  .legal-head h1 {
    font-size: clamp(28px, 4vw, 38px);
    letter-spacing: -0.03em;
    font-weight: 600;
    line-height: 1.1;
  }
  .legal-head .stand {
    margin-top: 10px;
    font-size: 12.5px; color: var(--ink-3);
    font-family: var(--mono);
  }
  .legal-body { padding: 24px 0 0; }
  .legal-body h2 {
    font-size: 18px; font-weight: 600; letter-spacing: -0.02em;
    margin: 36px 0 10px;
  }
  .legal-body h3 {
    font-size: 14.5px; font-weight: 600; letter-spacing: -0.01em;
    margin: 22px 0 6px;
  }
  .legal-body p, .legal-body li {
    font-size: 14px; line-height: 1.7; color: var(--ink-2);
    max-width: 72ch;
  }
  .legal-body p + p { margin-top: 10px; }
  .legal-body ul, .legal-body ol { margin: 10px 0 10px 20px; display: flex; flex-direction: column; gap: 6px; }
  .legal-body a { color: var(--accent); font-weight: 500; }
  .legal-body a:hover { color: var(--accent-2); }
  .legal-body strong { color: var(--ink); font-weight: 600; }
  .legal-address {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    padding: 18px 20px;
    font-size: 14px; line-height: 1.8; color: var(--ink-2);
    margin: 12px 0;
  }
  .legal-note {
    background: var(--warn-wash);
    border: 1px solid oklch(0.86 0.09 70);
    border-radius: var(--radius);
    padding: 14px 16px;
    font-size: 13px; line-height: 1.6; color: var(--ink-2);
    margin: 14px 0;
  }
  .legal-note strong { color: var(--ink); }
  .footer {
    border-top: 1px solid var(--line);
    margin-top: 64px;
    padding: 28px 0 8px;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    font-size: 12.5px; color: var(--ink-3);
    flex-wrap: wrap;
  }
  .footer .links { display: flex; gap: 18px; flex-wrap: wrap; }
  .footer a:hover { color: var(--ink); }
`;

export function LegalPageShell({
  title,
  stand,
  children,
}: {
  title: string;
  stand: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{SHELL_CSS}</style>
      <div className="app">
        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <div className="nav">
              <Link href="/events">Events</Link>
              <Link href="/my-tickets">Meine Tickets</Link>
            </div>
            <div className="topbar-right">
              <Link href="/fuer-veranstalter" className="btn subtle sm">Für Veranstalter</Link>
            </div>
          </div>
        </div>

        <div className="main">
          <div className="container">
            <div className="legal-wrap">
              <div className="legal-head">
                <h1>{title}</h1>
                <div className="stand">Stand: {stand}</div>
              </div>
              <div className="legal-body">{children}</div>

              <footer className="footer">
                <div>© 2026 Passly · Digitale Tickets</div>
                <div className="links">
                  <Link href="/hilfe">Hilfe</Link>
                  <Link href="/impressum">Impressum</Link>
                  <Link href="/datenschutz">Datenschutz</Link>
                  <Link href="/agb">AGB</Link>
                </div>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
