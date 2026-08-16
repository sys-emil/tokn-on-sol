import { PasslyLogo } from '@/app/components/PasslyLogo';
import { TICKET_SHELL_CSS } from './ticketShell';

/**
 * Ladezustand der Ticketseite.
 *
 * Die Seite selbst wartet auf zwei Netzaufrufe (Helius für das Asset,
 * Supabase für den Kauf), und beide laufen bewusst ungecacht. Ohne diese
 * Datei blieb `/my-tickets` in der Zwischenzeit einfach stehen, und das las
 * sich wie ein toter Tipp — schlecht genau dort, wo jemand am Einlass steht.
 *
 * Gezeichnet wird deshalb dieselbe Karte in derselben Größe: gleiche Bühne,
 * gleiche 380px-Karte, gleiches Codefeld mit 240er-Quadrat. Beim Umschalten
 * auf die echte Seite bleibt die Form stehen und es füllt sich nur der
 * Inhalt, statt dass das Layout springt.
 */
export default function Loading() {
  return (
    <>
      <style>{TICKET_SHELL_CSS + SKELETON_CSS}</style>
      <div className="ticket-canvas">
        <div className="ticket-screen" aria-busy="true" aria-label="Ticket wird geladen">
          <div style={{ padding: '18px 22px 0' }}>
            <PasslyLogo height={20} />
          </div>

          <div style={{ padding: '16px 22px 14px', display: 'grid', gap: 8 }}>
            <div className="sk sk-line" style={{ width: 96, height: 9 }} />
            <div className="sk sk-line" style={{ width: '78%', height: 17 }} />
            <div className="sk sk-line" style={{ width: 132, height: 11 }} />
          </div>

          <div className="ticket-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div className="sk sk-line" style={{ width: 74, height: 20, borderRadius: 6 }} />
              <div className="sk sk-line" style={{ width: 46, height: 11 }} />
            </div>
            {/* Gleiche Maße wie das echte Codefeld, damit nichts nachrückt. */}
            <div style={{ background: 'white', padding: 12, borderRadius: 12, boxShadow: '0 1px 2px rgba(17,20,45,0.06)', display: 'grid', placeItems: 'center' }}>
              <div style={{ width: 240 }}>
                <div className="sk sk-qr" style={{ width: 240, height: 240 }} />
              </div>
            </div>
            <div style={{ display: 'grid', placeItems: 'center', marginTop: 14 }}>
              <div className="sk sk-line" style={{ width: 186, height: 11 }} />
            </div>
            <div className="perf" style={{ left: -9 }} />
            <div className="perf" style={{ right: -9 }} />
          </div>

          <div style={{ padding: '16px 22px 20px', display: 'grid', gap: 12 }}>
            {[68, 54, 76].map((w, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <div className="sk sk-line" style={{ width: w, height: 10 }} />
                <div className="sk sk-line" style={{ width: 108, height: 10 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

const SKELETON_CSS = `
  .sk {
    background: var(--line);
    background-image: linear-gradient(100deg, transparent 20%, var(--surface) 50%, transparent 80%);
    background-size: 220% 100%;
    animation: skShimmer 1.25s ease-in-out infinite;
  }
  .sk-line { border-radius: 5px; }
  .sk-qr { border-radius: 8px; }
  @keyframes skShimmer {
    from { background-position: 120% 0; }
    to   { background-position: -120% 0; }
  }
  /* Ein pulsierendes Rechteck ist für manche Menschen unangenehm; ohne
     Animation bleibt die Fläche als ruhiger Platzhalter stehen. */
  @media (prefers-reduced-motion: reduce) {
    .sk { animation: none; background-image: none; }
  }
`;
