import Link from 'next/link';
import { PasslyLogo } from '@/app/components/PasslyLogo';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 24, padding: '32px 20px',
        background: 'radial-gradient(1000px 500px at 50% -10%, var(--accent-wash), transparent 60%), var(--surface-2)',
      }}
    >
      <PasslyLogo height={26} />
      <div
        className="card"
        style={{ maxWidth: 420, width: '100%', padding: '32px 28px', textAlign: 'center' }}
      >
        <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--ink-3)' }}>404</div>
        <h1 style={{ fontSize: 19, fontWeight: 600, marginTop: 8 }}>Seite nicht gefunden</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.6 }}>
          Der Link ist entweder falsch oder das Event bzw. Ticket existiert nicht mehr.
        </p>
        <Link href="/" className="btn primary" style={{ marginTop: 20, justifyContent: 'center' }}>
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
