'use client';

/**
 * Ladezustand des Event-Rasters.
 *
 * Dieselben Karten im selben Raster, damit die Uebersicht beim Eintreffen der
 * Daten nicht von einer schmalen Zeile auf mehrere Spalten aufspringt. Die
 * feststehenden Beschriftungen bleiben stehen: sie sind schon richtig und
 * machen sofort klar, was hier gleich steht.
 */
export function EventsSkeleton() {
  return (
    <div className="events-grid" aria-busy="true" aria-label="Veranstaltungen werden geladen">
      {[0, 1, 2].map((i) => (
        <div key={i} className="event-card" style={{ cursor: 'default' }}>
          <div className="row gap-3">
            <div className="sk block" style={{ width: 44, height: 46, flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 7 }}>
              <div className="sk" style={{ width: `${76 - i * 12}%`, height: 13 }} />
              <div className="sk" style={{ width: 116, height: 10 }} />
            </div>
          </div>
          <div>
            <div className="sold">
              <div className="sk" style={{ width: 128, height: 10 }} />
              <div className="sk" style={{ width: 28, height: 10 }} />
            </div>
            <div className="progress"><span style={{ width: 0 }} /></div>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="sk" style={{ width: 62, height: 20, borderRadius: 6 }} />
            <div className="sk" style={{ width: 74, height: 10 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Die ganze Uebersicht als Geruest: Hero mit Titel und Hauptknopf, eine
 * Karte in der Groesse der Checkliste, darunter das Event-Raster.
 *
 * Gedacht fuer Seiten, die einen angemeldeten Veranstalter gleich auf
 * /dashboard weiterschicken (`/become-organizer` prueft erst den Status).
 * Vorher stand dort das Geruest des Bewerbungsformulars, und die Seite
 * sprang beim Weiterleiten von einer schmalen Formularkarte auf das breite
 * Raster. Titel und Knopf sind hier Balken, kein Text: das Geruest darf
 * nichts behaupten, was sich fuer einen Gast gleich als falsch herausstellt.
 */
export function DashboardPageSkeleton() {
  return (
    <div className="container" aria-busy="true" aria-label="Wird geladen">
      <div className="hero">
        <div className="sk" style={{ width: 236, height: 30, borderRadius: 8 }} />
        <div className="row gap-2" style={{ marginTop: 22 }}>
          <div className="sk block" style={{ width: 232, height: 46 }} />
        </div>
      </div>

      <section>
        <div className="card" style={{ padding: '18px 20px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div className="sk" style={{ width: 132, height: 13 }} />
              <div className="sk" style={{ width: 96, height: 10 }} />
            </div>
            <div className="sk" style={{ width: 84, height: 28, borderRadius: 8 }} />
          </div>
          <div className="sk" style={{ width: '100%', height: 4, borderRadius: 2, margin: '12px 0 6px' }} />
          {[0, 1, 2].map((i) => (
            <div key={i} className="row gap-3" style={{ padding: '11px 0', borderTop: i ? '1px solid var(--line)' : 0 }}>
              <div className="sk circle" style={{ width: 22, height: 22, flex: 'none' }} />
              <div className="sk" style={{ width: `${52 - i * 9}%`, height: 12 }} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <EventsSkeleton />
      </section>
    </div>
  );
}
