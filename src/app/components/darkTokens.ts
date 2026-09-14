/*
 * Die eine dunkle Palette von Passly.
 *
 * Dunkel ist hier kein Nutzer-Setting, sondern ein Register: Der Pro-Bereich
 * ist durchgängig dunkel, und überall sonst kündigt genau diese Palette den
 * Pro-Bereich an (Pro-Karte auf der Übersicht, Pro-Spalte auf /preise). Ein
 * globaler Dark-Mode-Toggle würde das Signal verschenken — dann wäre Pro nur
 * „Free mit Dark Mode an". Die einzige Ausnahme ist die Tür: dort ist Dunkel
 * ein Gebrauchsargument (nachts vor dem Club blendet ein weißes Telefon) und
 * per Schalter zu haben, für alle Veranstalter.
 *
 * Deklarationen ohne Selektor, damit jede Seite sie in ihren eigenen Rahmen
 * setzen kann: `:root` für eine ganze Seite, `.card.pro-dark` für eine einzelne
 * Karte auf heller Seite. Alle Komponenten-CSS in globals.css lesen nur Tokens,
 * deshalb folgen Buttons, Chips und Eingaben automatisch.
 *
 * Der Farbton steht fest auf 285 statt `var(--hue)`: auf Dunkel sind die
 * Helligkeiten so abgestimmt, dass sie mit dem Passly-Lila lesbar sind, nicht
 * mit jedem Event-Akzent.
 */
export const DARK_TOKENS = `
    color-scheme: dark;
    --ink:        oklch(0.97 0.008 285);
    --ink-2:      oklch(0.82 0.015 285);
    --ink-3:      oklch(0.64 0.018 285);
    --ink-4:      oklch(0.50 0.02 285);
    --line:       oklch(0.30 0.02 285 / 0.55);
    --line-2:     oklch(0.40 0.03 285 / 0.65);
    --surface:    oklch(0.185 0.018 285);
    --surface-2:  oklch(0.135 0.016 285);
    --surface-3:  oklch(0.235 0.022 285);
    --accent:     oklch(0.74 0.16 285);
    --accent-2:   oklch(0.80 0.14 285);
    --accent-ink: oklch(0.88 0.09 285);
    --accent-wash:oklch(0.34 0.10 285 / 0.40);
    --accent-line:oklch(0.48 0.13 285 / 0.55);
    --ok:         oklch(0.78 0.15 155);
    --ok-wash:    oklch(0.36 0.08 155 / 0.35);
    --warn:       oklch(0.82 0.15 78);
    --warn-wash:  oklch(0.38 0.09 78 / 0.35);
    --bad:        oklch(0.70 0.17 22);
    --bad-wash:   oklch(0.38 0.10 22 / 0.35);
    --shadow-sm:  0 1px 0 oklch(0.10 0.02 285 / 0.6);
    --shadow:     0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.28);
    --shadow-lg:  0 24px 60px rgba(0,0,0,.5), 0 4px 12px rgba(0,0,0,.35);
`;

/** Dunkle Schrift auf dem hellen Dunkel-Akzent; Weiß wäre dort zu blass. */
export const ON_DARK_ACCENT = 'oklch(0.16 0.03 285)';

/**
 * Dunkle Karte auf heller Seite: die Pro-Ankündigung. Selektor mitgeben, weil
 * Seiten sie in ihrem eigenen <style>-Block einsetzen.
 */
export function darkCardCss(selector: string): string {
  return `
  ${selector} {
    ${DARK_TOKENS}
    color: var(--ink);
    background: linear-gradient(180deg, oklch(0.205 0.02 285) 0%, oklch(0.178 0.018 285) 100%);
    border-color: var(--line-2);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 30px rgba(0,0,0,0.32);
  }
  ${selector} .btn.primary { color: ${ON_DARK_ACCENT}; font-weight: 600; }
  ${selector} .btn.ghost { background: oklch(0.225 0.02 285); color: var(--ink); border-color: var(--line-2); }
  ${selector} .btn.ghost:hover { background: oklch(0.27 0.025 285); }
  ${selector} .chip { background: var(--surface-3); color: var(--ink-2); border-color: var(--line-2); }
  ${selector} .chip.pro { background: var(--accent); color: ${ON_DARK_ACCENT}; border-color: transparent; }
  ${selector} .chip.pro .d { background: ${ON_DARK_ACCENT}; }
  `;
}
