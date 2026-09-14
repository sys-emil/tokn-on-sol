/*
 * Der Übergang in den Pro-Bereich.
 *
 * Der Pro-Bereich ist dunkel, der Rest des Dashboards hell. Ohne Übergang
 * springt die Seite beim Klick von Weiß auf Schwarz — das liest sich wie ein
 * Render-Fehler, nicht wie ein Eintreten. Deshalb legt sich beim Klick ein
 * dunkler Vorhang vom Klickpunkt aus über die Seite (clip-path-Kreis), und
 * erst dahinter wird navigiert; die Pro-Seite blendet den Vorhang aus, sobald
 * sie steht.
 *
 * Der Vorhang hängt direkt am <body>, außerhalb des React-Baums, deshalb
 * überlebt er den Routenwechsel. Sicherungen: bei `prefers-reduced-motion`
 * wird nur navigiert, und ein Vorhang, den keine Seite abholt (Navigation
 * gescheitert), räumt sich nach kurzer Zeit selbst weg — ein hängender
 * schwarzer Schirm wäre schlimmer als jeder Sprung.
 */
const CURTAIN_ID = 'passly-pro-curtain';
const ENTER_MS = 420;
const LEAVE_MS = 320;
const ORPHAN_MS = 4000;

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Vorhang vom Punkt (x, y) aus schließen; löst auf, wenn er die Seite bedeckt. */
export function startProTransition(x: number, y: number): Promise<void> {
  if (typeof document === 'undefined' || reducedMotion()) return Promise.resolve();
  document.getElementById(CURTAIN_ID)?.remove();

  const el = document.createElement('div');
  el.id = CURTAIN_ID;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  Object.assign(el.style, {
    position: 'fixed', inset: '0', zIndex: '9999', pointerEvents: 'none',
    background: 'oklch(0.135 0.016 285)',
    clipPath: `circle(0px at ${x}px ${y}px)`,
    transition: `clip-path ${ENTER_MS}ms cubic-bezier(0.32, 0, 0.16, 1), opacity ${LEAVE_MS}ms ease`,
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);

  // Erst nach dem Layout die Zielgröße setzen, sonst gibt es keinen Übergang.
  void el.offsetWidth;
  el.style.clipPath = `circle(${Math.ceil(radius)}px at ${x}px ${y}px)`;

  window.setTimeout(() => { if (el.isConnected) finishProTransition(); }, ORPHAN_MS);
  return new Promise((resolve) => window.setTimeout(resolve, ENTER_MS));
}

/** Vorhang ausblenden und entfernen; ohne Vorhang passiert nichts. */
export function finishProTransition(): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(CURTAIN_ID);
  if (!el) return;
  el.style.opacity = '0';
  window.setTimeout(() => el.remove(), LEAVE_MS + 50);
}
