'use client';

import { getAccessToken, useAuth } from '@/lib/auth';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/track';

export default function TicketClient({ assetId }: { assetId: string }) {
  const { ready, authenticated } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'refreshing'>('loading');
  // Bumped on every fresh signature, restarts the drain bar below the QR so
  // door staff and guests can see the code is alive and current.
  const [cycle, setCycle] = useState(0);
  const hadQr = useRef(false);

  useEffect(() => {
    track('ticket_viewed');
  }, [assetId]);

  useEffect(() => {
    if (!ready || !authenticated) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function refresh(): Promise<void> {
      if (cancelled) return;

      // Kein Code fuer ein Ticket, das gerade niemand ansieht.
      //
      // Seit die Signatur serverseitig entsteht, kostet eine Erneuerung kein
      // Kontingent mehr — aber eine Anfrage pro Minute aus jedem Hintergrund-
      // Tab bleibt Verschwendung, und zwar ausgerechnet dann am meisten, wenn
      // viele gleichzeitig auf ihr Ticket schauen: am Einlass.
      //
      // Die Schleife wird trotzdem NICHT angehalten, sondern nur uebersprungen.
      // Wuerde sie sich allein auf das visibilitychange-Event verlassen und das
      // Event in irgendeinem Browser ausbleiben, stuende der Gast mit einem
      // veralteten Code vor der Tuer. Ein Tick alle 55 s kostet nichts, das
      // Ticket bleibt aber unter allen Umstaenden selbstheilend.
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        timer = setTimeout(() => { void refresh(); }, 55_000);
        return;
      }

      setStatus(hadQr.current ? 'refreshing' : 'loading');

      try {
        const token = await getAccessToken();
        if (!token) throw new Error('not signed in');

        // Der Server signiert die Challenge mit dem abgeleiteten Schluessel des
        // Kontos. Die Nutzlast ist dieselbe wie zuvor, nur der Unterzeichner hat
        // sich bewegt — /api/tickets/verify merkt davon nichts.
        const res = await fetch(`/api/tickets/${assetId}/qr`, {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(String(res.status));

        // Die vier Felder ausdruecklich in fester Reihenfolge zusammensetzen,
        // statt den Antwortkoerper roh in den Code zu schreiben: sonst landet
        // jedes spaeter ergaenzte Feld ungewollt im QR.
        const d = (await res.json()) as { a: string; t: number; w: string; s: string };
        const payload = JSON.stringify({ a: d.a, t: d.t, w: d.w, s: d.s });

        if (!cancelled && canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, payload, {
            // Doppelte Aufloesung der groessten Darstellung (240 px): die
            // Karte zeigt den Code je nach Geraet zwischen ~180 und 240 px
            // breit, und ein herunterskaliertes Bild ist nur so scharf wie
            // seine Vorlage. Unscharfe Module sind an der Tuer ein Scan, der
            // nicht faellt.
            width: 480,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: { dark: '#23263c', light: '#ffffff' },
          });
          hadQr.current = true;
          setStatus('ready');
          setCycle((c) => c + 1);
        }
      } catch {
        if (!cancelled) setStatus('loading');
      }

      if (!cancelled) {
        timer = setTimeout(() => { void refresh(); }, 55_000);
      }
    }

    // Beim Zurueckkehren sofort erneuern, statt bis zu 55 s auf den naechsten
    // Tick zu warten: der angezeigte Code ist dann fast immer abgelaufen, und
    // genau in diesem Moment haelt jemand sein Handy an den Scanner.
    function onVisibilityChange(): void {
      if (cancelled || document.visibilityState !== 'visible') return;
      clearTimeout(timer);
      void refresh();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    void refresh();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [ready, authenticated, assetId]);

  return (
    // Die Darstellung schrumpft mit der Karte statt fest bei 240 px zu
    // stehen: auf einem 360-px-Geraet bleiben innerhalb der Ticketkarte nur
    // gut 220 px, und ein starres Quadrat waere dort seitlich aus dem
    // Bildschirm gelaufen. Gezeichnet wird trotzdem in voller Aufloesung.
    <div className="qr-wrap">
      <style>{`
        @keyframes qrDrain { from { transform: scaleX(1); } to { transform: scaleX(0); } }
        .qr-drain { transform-origin: left; animation: qrDrain 55s linear forwards; }
        @media (prefers-reduced-motion: reduce) { .qr-drain { animation: none; } }
        .qr-wrap { width: 240px; max-width: 100%; }
        .qr-stage { position: relative; width: 100%; aspect-ratio: 1 / 1; }
        /* !important, weil qrcode.toCanvas dem Element nach dem Zeichnen
           style.width/height in Pixeln direkt ins Attribut schreibt — eine
           gewoehnliche Regel verliert dagegen. */
        .qr-stage canvas { display: block; width: 100% !important; height: 100% !important; }
      `}</style>
      <div className="qr-stage">
        <canvas
          ref={canvasRef}
          width={480}
          height={480}
          role="img"
          aria-label="Dein persönlicher Einlass-Code, beim Einlass einscannen lassen"
          style={{ opacity: status === 'loading' ? 0 : 1 }}
        />
        {status !== 'ready' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontFamily: 'inherit',
            color: '#23263c',
            letterSpacing: '0.08em',
          }}>
            {status === 'refreshing' ? 'wird aktualisiert …' : 'wird erstellt …'}
          </div>
        )}
      </div>
      {cycle > 0 && (
        <div
          aria-hidden="true"
          style={{ height: 3, borderRadius: 2, background: '#eceef6', marginTop: 10, overflow: 'hidden' }}
        >
          <div key={cycle} className="qr-drain" style={{ height: '100%', borderRadius: 2, background: '#23263c' }} />
        </div>
      )}
    </div>
  );
}
