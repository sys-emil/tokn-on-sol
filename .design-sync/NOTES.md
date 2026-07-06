# design-sync NOTES — tokn-on-sol (Passly)

- Kein Library-Build: das Repo ist eine Next.js-App. Converter läuft mit
  `--entry ./src/app/components/passlyUi.tsx` (auch als `entry` in config.json) —
  ohne `--entry` crasht der Build, weil `node_modules/tokn-on-sol` nicht existiert.
- Das eigentliche Designsystem sind die CSS-Klassen in `src/app/globals.css`
  (seit dem Template-Redesign 2026-07-06 liegt dort auch das komplette Komponenten-CSS).
  Nur `Icon` und `Spark` sind echte React-Exports.
- `PasslyLogo` ist ausgeschlossen (`componentSrcMap: null`) — lädt `/passly-logo.svg`
  per absolutem Pfad, bricht außerhalb der App. `CtaButton` ausgeschlossen (Privy-Hooks).
- **`.design-sync/passly.css` ist GENERIERT aus `src/app/globals.css`** (Tailwind-Import
  entfernt, Google-Fonts-@import für Geist/Geist Mono ergänzt, `var(--font-geist)`-Präfixe
  aus `--font`/`--mono` gestrippt, weil next/font-Variablen außerhalb der App fehlen).
  Regenerieren bei jedem Re-Sync, wenn sich globals.css geändert hat:
  ```sh
  { echo '/* GENERATED from src/app/globals.css by design-sync (see .design-sync/NOTES.md) — do not edit by hand */';
    echo "@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&display=swap');";
    sed '1d' src/app/globals.css; } > .design-sync/passly.css
  sed -i '' -e "s/var(--font-geist), 'Geist'/'Geist'/" -e "s/var(--font-geist-mono), 'Geist Mono'/'Geist Mono'/" .design-sync/passly.css
  ```
- Fonts: bewusst remote via Google Fonts (`[FONT_REMOTE]` ist erwartet, kein neuer Warn).
- `cfg.overrides.Icon.cardMode = "column"` wegen `[GRID_OVERFLOW]` (Icon-Raster breiter als Grid-Zelle).
- Playwright/Chromium installiert nach `~/Library/Caches/ms-playwright` (chromium-headless-shell v1228).

## Known render warns
- (keine — Render-Check läuft 2/2 sauber)

## Re-sync risks
- **passly.css-Drift**: Änderungen an `src/app/globals.css` (neue Klassen/Tokens) erreichen
  Claude Design erst, wenn passly.css regeneriert und neu gesynct wird — das ist der
  wichtigste manuelle Schritt jedes Re-Syncs.
- **conventions.md-Drift**: die Klassen-Tabelle dort enumeriert globals.css-Klassen von Hand;
  bei neuen/umbenannten Klassen mitpflegen (Validierungslauf beim Re-Sync deckt Entferntes auf).
- Icon-Namensliste in conventions.md + Icon-Preview (`ALL_ICONS`) muss bei neuen Icons in
  `passlyUi.tsx` erweitert werden — sonst zeigt die Vorschau nicht alle Icons.
- Geist via Google Fonts: sollte die Familie dort je verschwinden/umbenannt werden, rendert
  alles im Fallback — @import-URL in passly.css prüfen.
