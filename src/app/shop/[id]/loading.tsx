import { PasslyLogo } from '@/app/components/PasslyLogo';

/**
 * Ladezustand der Kaufseite.
 *
 * Die Seite wartet auf mehrere Supabase-Abfragen (Event, Kategorien,
 * Veranstalter, Weiterverkäufe, Saisonpässe). Ohne diese Datei blieb der
 * Besucher nach dem Klick auf den Eventlink auf der vorherigen Seite stehen —
 * ausgerechnet auf dem Weg zum Kauf, wo jedes Zögern als kaputter Link gelesen
 * wird.
 *
 * Gezeichnet wird dieselbe Bühne und dieselbe 460px-Karte wie in page.tsx, mit
 * denselben Abständen. Beim Umschalten auf die echte Seite bleibt die Form
 * stehen und es füllt sich nur der Inhalt.
 */
const LOADING_CSS = `
  .shop-skeleton-page {
    min-height: 100vh;
    min-height: 100dvh;
    background: radial-gradient(1000px 500px at 50% -10%, var(--accent-wash), transparent 60%), var(--surface-2);
    display: flex; flex-direction: column; align-items: center;
    padding: 32px 20px 56px;
  }
  .shop-skeleton-card {
    width: 100%; max-width: 460px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    margin-top: 28px;
  }
  .shop-skeleton-art { aspect-ratio: 2 / 1; background: var(--surface-3); border-bottom: 1px solid var(--line); }
`;

export default function Loading() {
  return (
    <>
      <style>{LOADING_CSS}</style>
      <div className="shop-skeleton-page">
        <PasslyLogo height={24} />

        <div className="shop-skeleton-card" aria-busy="true" aria-label="Tickets werden geladen">
          <div className="shop-skeleton-art" />

          {/* Datumswürfel + Titelblock, gleiche Maße wie .shop-head */}
          <div style={{ padding: '22px 24px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div className="sk block" style={{ width: 52, height: 52, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 9 }}>
              <div className="sk" style={{ width: '82%', height: 19 }} />
              <div className="sk" style={{ width: '64%', height: 11 }} />
              <div className="sk" style={{ width: '48%', height: 11 }} />
            </div>
          </div>

          {/* Preiszeilen je Kategorie */}
          <div style={{ padding: '0 24px 20px', display: 'grid', gap: 12 }}>
            {[0, 1].map((i) => (
              <div
                key={i}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
                  border: '1px solid var(--line)', borderRadius: 9, padding: '14px 16px',
                }}
              >
                <div style={{ display: 'grid', gap: 7 }}>
                  <div className="sk" style={{ width: 118, height: 12 }} />
                  <div className="sk" style={{ width: 76, height: 10 }} />
                </div>
                <div className="sk" style={{ width: 62, height: 15 }} />
              </div>
            ))}
            <div className="sk block" style={{ width: '100%', height: 42, marginTop: 4 }} />
          </div>
        </div>
      </div>
    </>
  );
}
