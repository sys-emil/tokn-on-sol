/**
 * Die Grundform der Ticketkarte: Bühne, Karte, Codefeld und die zwei
 * Perforationslöcher.
 *
 * Liegt hier, weil zwei Dateien exakt dieselbe Form zeichnen müssen — die
 * Seite selbst und ihr Ladezustand (`loading.tsx`). Weichen sie voneinander
 * ab, springt das Layout beim Umschalten, und genau das soll das Skelett ja
 * verhindern.
 */
export const TICKET_SHELL_CSS = `
  .ticket-canvas {
    min-height: 100vh;
    display: grid; place-items: center;
    padding: 40px 20px;
    background:
      radial-gradient(1000px 500px at 50% -10%, var(--accent-wash), transparent 60%),
      var(--surface-2);
  }
  .ticket-screen {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 24px;
    box-shadow: var(--shadow-lg);
    width: 380px; max-width: 100%;
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .ticket-body {
    margin: 0 18px;
    padding: 20px;
    border-radius: 18px;
    background: var(--accent-wash);
    border: 1px solid var(--accent-line);
    position: relative;
  }
  .perf {
    position: absolute;
    width: 18px; height: 18px; border-radius: 50%;
    background: var(--surface); border: 1px solid var(--accent-line);
    top: 50%; transform: translateY(-50%);
  }
`;
