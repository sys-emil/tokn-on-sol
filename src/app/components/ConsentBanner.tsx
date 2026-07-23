'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getConsent, setConsent, track, OPEN_CONSENT_EVENT } from '@/lib/track';

/**
 * Consent banner for the first-party statistics cookie. Renders nothing once
 * a decision exists; /datenschutz can reopen it via openConsentSettings().
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getConsent() === null);
    const reopen = () => setVisible(true);
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  if (!visible) return null;

  const decide = (state: 'granted' | 'denied') => {
    setConsent(state);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie-Einstellungen"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 560,
          width: '100%',
          padding: '16px 20px',
          pointerEvents: 'auto',
          boxShadow: '0 12px 40px oklch(0.2 0.02 285 / 0.18)',
        }}
      >
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>Kurz gefragt: anonyme Statistik okay?</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.55, marginTop: 4 }}>
          Wir würden gern mit einem eigenen, anonymen Statistik-Cookie verstehen, wie Passly genutzt wird,
          keine Werbung, keine Weitergabe an Dritte. Mehr dazu in der{' '}
          <Link href="/datenschutz" style={{ color: 'var(--accent)', fontWeight: 500 }}>Datenschutzerklärung</Link>.
        </div>
        <div className="row gap-2" style={{ marginTop: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn ghost sm" onClick={() => decide('denied')}>Nur notwendige</button>
          <button className="btn primary sm" onClick={() => decide('granted')}>Alle akzeptieren</button>
        </div>
      </div>
    </div>
  );
}

/** Reopens the consent banner; used on /datenschutz for consent withdrawal. */
export function ConsentSettingsButton() {
  return (
    <button
      className="btn ghost sm"
      onClick={() => {
        setConsent('denied');
        window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
      }}
    >
      Cookie-Einstellungen ändern
    </button>
  );
}

/** Fires a consent-gated page_view on every route change. */
export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Skip the doorman scanner; venue staff, not visitors.
    if (pathname.startsWith('/doorman')) return;
    track('page_view');
  }, [pathname]);

  return null;
}
