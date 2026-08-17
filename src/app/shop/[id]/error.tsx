'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { PasslyLogo } from '@/app/components/PasslyLogo';

/**
 * Fehlerzustand der Kaufseite.
 *
 * Ohne diese Datei landete ein fehlgeschlagenes Server-Component hier auf der
 * allgemeinen Fehlerseite unter `src/app/error.tsx` — ausgerechnet auf der
 * einen Seite, auf der Geld verdient wird, und ohne jeden Hinweis darauf, dass
 * es um Tickets geht.
 *
 * Der häufigste Auslöser ist eine vorübergehend nicht erreichbare Datenbank.
 * Deshalb steht `reset()` an erster Stelle: ein zweiter Versuch ist hier fast
 * immer die richtige Handlung, und niemand soll glauben, das Event sei weg.
 */
export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Shop page error:', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(1000px 500px at 50% -10%, var(--accent-wash), transparent 60%), var(--surface-2)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 24, padding: '32px 20px',
      }}
    >
      <PasslyLogo height={24} />

      <div
        className="card"
        style={{ maxWidth: 460, width: '100%', padding: '32px 28px', textAlign: 'center' }}
      >
        <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em' }}>
          Tickets konnten nicht geladen werden
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.6 }}>
          Das Event ist nicht weg — wir kommen gerade nur nicht an die Daten heran.
          Versuch es gleich noch einmal.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
          <button type="button" className="btn primary" onClick={() => reset()}>
            Erneut versuchen
          </button>
          <Link href="/events" className="btn ghost">Alle Events</Link>
        </div>
      </div>
    </div>
  );
}
