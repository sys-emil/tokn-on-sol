'use client';

import { useState } from 'react';

/**
 * Treue-Code einlösen: Eingabefeld, Knopf, Rückmeldung.
 *
 * Steht an zwei Stellen — im Pro-Tab „Treueprogramm" neben der Liste der
 * letzten Einlösungen, und als eigene Karte direkt auf `/dashboard`. Der Grund
 * für die zweite Stelle ist die Situation: eingelöst wird am Einlass, während
 * jemand mit seinem Code vor einem steht. Drei Klicks tief in einer Auswertung
 * ist das der falsche Ort.
 *
 * Der Code ist sechsstellig, deshalb schaltet der Knopf erst bei sechs Zeichen
 * frei; ein zu kurzer Code wäre ein garantierter Fehlversuch.
 */
export function LoyaltyRedeem({
  walletAddress,
  getToken,
  onRedeemed,
}: {
  walletAddress: string;
  getToken: () => Promise<string | null>;
  /** Aufrufer lädt seine Zahlen neu; auf dem Dashboard nicht nötig. */
  onRedeemed?: () => void;
}) {
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function redeem(): Promise<void> {
    if (!code.trim() || redeeming) return;
    setResult(null);
    setRedeeming(true);
    try {
      const t = await getToken();
      if (!t) return;
      const res = await fetch('/api/organizer/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ walletAddress, code }),
      });
      const body = (await res.json()) as { success: boolean; benefitTitle?: string; error?: string };
      if (body.success) {
        setResult({ ok: true, text: `Vorteil eingelöst: ${body.benefitTitle ?? 'Vorteil'}` });
        setCode('');
        onRedeemed?.();
      } else if (body.error === 'already_redeemed') {
        setResult({ ok: false, text: 'Dieser Code wurde bereits eingelöst.' });
      } else if (body.error === 'unknown_code') {
        setResult({ ok: false, text: 'Unbekannter Code.' });
      } else {
        setResult({ ok: false, text: body.error ?? 'Einlösen fehlgeschlagen.' });
      }
    } catch {
      setResult({ ok: false, text: 'Keine Verbindung. Bitte noch einmal versuchen.' });
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          className="input mono"
          placeholder="CODE, Z. B. A3K7QP"
          value={code}
          maxLength={6}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') void redeem(); }}
          aria-label="Treue-Code des Gasts"
          style={{ letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 14, padding: '12px 14px' }}
        />
        <button
          className="btn primary"
          style={{ flex: 'none' }}
          onClick={() => void redeem()}
          disabled={redeeming || code.trim().length < 6}
        >
          {redeeming ? 'Prüfe …' : 'Einlösen'}
        </button>
      </div>
      {result && <div className={`redeem-msg ${result.ok ? 'ok' : 'bad'}`} role="status">{result.text}</div>}
    </>
  );
}
