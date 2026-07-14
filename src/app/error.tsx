'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { PasslyLogo } from '@/app/components/PasslyLogo';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled page error:', error);
  }, [error]);

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
        <h1 style={{ fontSize: 19, fontWeight: 600 }}>Etwas ist schiefgelaufen</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.6 }}>
          Diese Seite konnte nicht geladen werden. Versuch es noch einmal — falls es weiter
          nicht klappt, melde dich gerne bei uns.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
          <button type="button" className="btn primary" onClick={() => reset()}>
            Erneut versuchen
          </button>
          <Link href="/" className="btn ghost">Zur Startseite</Link>
        </div>
      </div>
    </div>
  );
}
