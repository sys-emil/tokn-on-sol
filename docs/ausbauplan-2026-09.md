# Ausbauplan September 2026

Brainstorm vom 2026-09-13, freigegeben von Emil. Wird Punkt fuer Punkt
abgearbeitet; jeder erledigte Punkt bekommt hier Datum und Commit. Reihenfolge:
was am ersten echten Abend fehlt und klein ist zuerst, dann Betrieb, dann die
grossen Produktstuecke. Nicht enthalten (ausdruecklich ausgeklammert): Stripe
live, echte Kunden, Impressum-Platzhalter.

Legende: `[ ]` offen · `[x]` erledigt · `[~]` braucht Emils Entscheidung/Zugang

## Block 1 — Der erste echte Abend (klein, sofort spuerbar)

- [x] **1.1 ICS in der Bestaetigungsmail.** _(2026-09-13)_ `sendTicketConfirmation` bekommt die
      Kalenderdatei als Anhang (`text/calendar`) und den Link auf
      `/api/events/[eventId]/ics`. Nutzt den vorhandenen ICS-Generator.
- [x] **1.2 Einzelerstattung durch den Veranstalter.** _(2026-09-13; Tabelle `organizer_refunds` migriert)_ Neue Route
      `POST /api/organizer/refund` (`requestOwnsWallet`, Event-Besitz): erstattet
      genau ein Ticket eines Kaufs, nur solange die `payouts`-Zeile `pending`
      ist. Voll-Refund bei 1 Ticket, Teil-Refund (anteilig gross) bei mehreren;
      der bestehende `charge.refunded`-Webhook macht Revoke + Sitz frei +
      Umrechnung. Knopf auf `/dashboard/events/[id]` in der Ticketliste, mit
      Bestaetigung. Nicht fuer Abendkasse, Freitickets, Saisonpaesse,
      ausgezahlte Zeilen (wie bei der Rueckgabe).
- [x] **1.3 Manuelle Suche an der Tuer.** _(2026-09-13)_ Doorman-Seite: Suchfeld ueber dem
      Scanner, sucht im Offline-Snapshot nach E-Mail/Name (Snapshot muss die
      Kaeufer-Mail tragen, nur fuer Tuer-berechtigte). Treffer zeigt
      Einlass-Stand, Knopf „Von Hand einlassen" laeuft ueber denselben
      Redeem-Pfad wie ein Scan (online `verify`-Aequivalent per assetId, offline
      in die Queue). Schutz: nur auf der ohnehin gegateten Tuer-Oberflaeche.
- [x] **1.4 Taegliche Verkaufszusammenfassung an den Veranstalter.** _(2026-09-13; Spalte `organizers.daily_digest` migriert)_ Im
      Payout-Cron: pro Veranstalter mit Verkaeufen in den letzten 24 h eine Mail
      („gestern 12 Tickets, 87 von 150, naechstes Event in 5 Tagen").
      Abschaltbar (`organizers.daily_digest` bool, default true).
- [x] **1.5 Ticketlimit pro Bestellung einstellbar.** _(2026-09-13; Spalte `events.max_per_order` migriert)_ `events.max_per_order`
      (1–10, default 4), im EventEditor, im Shop und in `/api/checkout/create`.
- [x] **1.6 Mint-Status im Dashboard.** _(2026-09-13)_ Auf `/dashboard/events/[id]`: Zeile
      „n Tickets werden gerade ausgestellt" aus `mint_jobs` (queued/processing),
      und „n fehlgeschlagen, Kaeufer erstattet" bei `failed`.

## Block 2 — Betrieb

- [x] **2.1 Fehler-Tracking.** _(2026-09-13 verdrahtet, schlafend; **Emil: Sentry-Projekt anlegen und `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` in Vercel setzen**)_ Sentry (`@sentry/nextjs`) fuer Server-Routen,
      Cron und Client; DSN als Env. Braucht ein Sentry-Konto von Emil (Free-Plan
      reicht). Ohne DSN muss alles weiterlaufen.
- [x] **2.2 Tests fuer den Geldweg.** _(2026-09-13: `stripeWebhook.test.ts`, `mintJobs.test.ts`, `organizerRefund.test.ts` gegen `fakeSupabase.ts`)_ Vitest mit gemocktem Supabase/Stripe:
      Webhook `checkout.session.completed` (Idempotenz, Payout-Zeile, Job),
      `checkout.session.expired`, `charge.refunded` (voll/teil/nach Auszahlung,
      Rueckgabe-Skip), Reservierungs-Retry bei erschoepfter Kapazitaet,
      Mint-Worker (Backoff, Auto-Refund einmalig).
- [x] **2.3 Englisch fertigstellen** _(2026-09-13)_ (`ShopClient`, Shop-Erfolgsseite,
      `/my-tickets`, `/claim/[token]`, `TicketClient`), Schluessel liegen in
      `i18n.ts`. Seiten immer ganz uebersetzen.

## Block 3 — Produkt

- [x] **3.1 Onboarding-Checkliste im Dashboard.** _(2026-09-13)_ Vier Haken: Profil (Handle),
      Stripe verbunden, erstes Event, Tuerlink erstellt. Verschwindet, wenn alle
      gesetzt sind. Passt zur Rollen-Aenderung vom 2026-09-13.
- [x] **3.2 Einbettbares Kaufwidget.** _(2026-09-13)_ `/embed/[id]` (schlanke Shopkarte im
      iframe, `frame-ancestors` dafuer gelockert nur auf dieser Route) plus
      Snippet-Generator auf der Event-Detailseite („Auf deine Website").
- [x] **3.3 Mehrtaegige Events.** _(2026-09-13; Spalte `events.end_date` migriert)_ `events.end_date` (nullable): Anzeige
      „12.–14. Okt.", ICS mit Ende, Erinnerung/Einlass-Fenster/Payout-Anker auf
      den letzten Tag. Wiederkehrende Events bleiben Kopieren + Saisonpass.
- [ ] **3.4 Wallet-Pass** (Apple Wallet `.pkpass`, Google Wallet). Groesster
      Qualitaetssprung, eine Woche. Braucht Apple-Developer-Zertifikat (Emil)
      und einen Pass-Push-Endpunkt fuer den rotierenden Code — Entwurf zuerst.
- [~] **3.5 Sitzplaetze.** Eigenes Vorhaben, nur nach Entscheidung: Saalplan-
      Editor, `seats`-Tabelle, Reservierung pro Sitz. Vorher Bedarf beim
      Pilotkunden klaeren.
- [~] **3.6 Auftragsverarbeitungsvertrag.** Kein Code; Vorlage fuer
      Veranstalter, verlinkt aus AGB und Dashboard. Braucht juristische Pruefung.
