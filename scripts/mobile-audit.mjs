/**
 * Mobile-Layout-Pruefung: rendert Seiten in einem emulierten iPhone (390 px)
 * und meldet, was aus dem Bild ragt oder abgeschnitten ist.
 *
 *   npm run mobile-audit                       # oeffentliche Seiten auf getpassly.de
 *   npm run mobile-audit -- --login            # einmal anmelden, Sitzung lokal speichern
 *   npm run mobile-audit -- --paths=/my-tickets,/dashboard
 *   BASE=http://localhost:3000 npm run mobile-audit
 *
 * Braucht Playwright + Chromium: `npx playwright install chromium` (einmalig).
 *
 * Gemessen wird pro Seite:
 *   - horizontaler Ueberlauf des Dokuments (scrollWidth > Viewport),
 *   - Elemente, die ueber ihren naechsten Clip-Container hinausragen
 *     (Viewport oder ein Vorfahr mit overflow hidden/clip). Bewusst scrollende
 *     Container (overflow auto/scroll, z. B. die Nav-Leiste, Tabellenrahmen)
 *     werden nur als Hinweis gelistet,
 *   - Knoepfe/Links, deren Inhalt breiter ist als ihr Kasten.
 *
 * Bekannte Fehlalarme: `.btn-shine` (das ::after des Glanzes zaehlt in
 * scrollWidth) und die `.tk-stub-action` auf /my-tickets (das unsichtbare
 * 44-px-Fingerpolster ist ein ::after mit inset -5px). Beide sind hier
 * ausgenommen. Dekorative Kerben (`.tk-notch`, `.perf`) ebenso.
 *
 * Die Anmeldung fuer eingeloggte Seiten: `--login` oeffnet einen sichtbaren
 * Browser, man meldet sich wie gewohnt per Code an und schliesst ihn; die
 * Sitzung landet in .mobile-audit/state.json (gitignored) und wird danach
 * automatisch benutzt. Screenshots liegen in .mobile-audit/shots/.
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
const base = (process.env.BASE || args.base || 'https://getpassly.de').replace(/\/$/, '');
const outDir = path.resolve('.mobile-audit');
const stateFile = path.join(outDir, 'state.json');
const shotsDir = path.join(outDir, 'shots');
fs.mkdirSync(shotsDir, { recursive: true });

const device = devices[args.device || 'iPhone 14'];
if (!device) { console.error(`Unbekanntes Geraet: ${args.device}`); process.exit(1); }

const PUBLIC = ['/', '/sportvereine', '/clubs', '/preise', '/hilfe', '/events', '/so-funktionierts',
  '/fuer-veranstalter', '/impressum', '/datenschutz', '/agb', '/avv', '/become-organizer', '/account'];
const SIGNED_IN = ['/my-tickets', '/dashboard', '/dashboard/payouts', '/dashboard/passes', '/dashboard/profile',
  '/dashboard/analytics', '/dashboard/events/neu'];

if (args.login) {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ ...device, locale: 'de-DE' });
  const page = await ctx.newPage();
  await page.goto(base + '/my-tickets');
  console.log('Melde dich im Browser an. Sobald "Meine Tickets" geladen ist, wird die Sitzung gespeichert.');
  await page.waitForURL(/my-tickets|dashboard/, { timeout: 0 });
  await page.waitForSelector('a[href="/dashboard"], a[href="/events"]', { timeout: 0 });
  await page.waitForTimeout(2000);
  await ctx.storageState({ path: stateFile });
  console.log(`Sitzung gespeichert: ${stateFile}`);
  await browser.close();
  process.exit(0);
}

const hasState = fs.existsSync(stateFile);
const paths = args.paths
  ? String(args.paths).split(',').map((p) => p.trim()).filter(Boolean)
  : [...PUBLIC, ...(hasState ? SIGNED_IN : [])];
if (!hasState && !args.paths) console.log('Keine gespeicherte Sitzung, nur oeffentliche Seiten. Anmelden: npm run mobile-audit -- --login\n');

const AUDIT = () => {
  const d = document;
  const vw = d.documentElement.clientWidth;
  const sel = (el) => el.tagName.toLowerCase() + ((typeof el.className === 'string' && el.className.trim())
    ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const IGNORE = /(^|\s)(btn-shine|tk-stub-action|tk-notch|perf|tk-stub-notch)(\s|$)/;
  const issues = [];
  const seen = new Set();
  for (const el of d.querySelectorAll('body *')) {
    if (el.closest('[data-mobile-audit-ignore]')) continue;
    const cls = typeof el.className === 'string' ? el.className : '';
    if (IGNORE.test(cls)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    const rc = el.getBoundingClientRect();
    if (rc.width < 2 || rc.height < 2) continue;
    let a = el.parentElement, clipL = 0, clipR = vw, by = 'viewport', scroll = false;
    while (a && a !== d.body) {
      const s = getComputedStyle(a);
      if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) {
        const ar = a.getBoundingClientRect(); clipL = ar.left; clipR = ar.right; by = sel(a);
        scroll = /(auto|scroll)/.test(s.overflowX); break;
      }
      a = a.parentElement;
    }
    // 3px Toleranz: der Unschaerfe-Effekt hinter dem Login-Dialog skaliert die Seite minimal.
    const outside = rc.right > clipR + 3 || rc.left < clipL - 3;
    const isControl = el.matches('.btn, button, a, .chip, select, input');
    const textClipped = isControl && el.scrollWidth > el.clientWidth + 3;
    if (!outside && !textClipped) continue;
    const key = sel(el) + '|' + Math.round(rc.top) + '|' + Math.round(rc.left);
    if (seen.has(key)) continue; seen.add(key);
    issues.push({
      kind: textClipped ? 'text-clipped' : scroll ? 'in-scroller' : 'outside',
      el: sel(el), text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      left: Math.round(rc.left), right: Math.round(rc.right), clipRight: Math.round(clipR), by,
    });
  }
  return { vw, sw: d.documentElement.scrollWidth, issues };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...device, locale: 'de-DE', storageState: hasState ? stateFile : undefined });
let hard = 0;
for (const p of paths) {
  const page = await ctx.newPage();
  try {
    await page.goto(base + p, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(AUDIT);
    const name = (p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root') + '.png';
    await page.screenshot({ path: path.join(shotsDir, name), fullPage: true });
    const overflow = r.sw > r.vw;
    const real = r.issues.filter((i) => i.kind !== 'in-scroller');
    const hints = r.issues.filter((i) => i.kind === 'in-scroller');
    hard += real.length + (overflow ? 1 : 0);
    const mark = overflow || real.length ? 'FEHLER' : 'ok';
    console.log(`\n${mark}  ${p}  ->  ${page.url().replace(base, '') || '/'}  (${r.vw}px, scrollWidth ${r.sw})`);
    if (overflow) console.log('  horizontaler Ueberlauf der Seite');
    for (const i of real.slice(0, 15)) console.log(`  ${i.kind}: ${i.el} "${i.text}"  ${i.left}..${i.right} (clip ${i.clipRight}, ${i.by})`);
    if (real.length > 15) console.log(`  ... ${real.length - 15} weitere`);
    if (hints.length) console.log(`  hinweis: ${hints.length} Element(e) in scrollenden Containern (${[...new Set(hints.map((h) => h.by))].join(', ')})`);
  } catch (e) {
    hard++;
    console.log(`\nFEHLER  ${p}  ${String(e.message).split('\n')[0]}`);
  }
  await page.close();
}
await browser.close();
console.log(`\nScreenshots: ${shotsDir}`);
process.exit(hard ? 1 : 0);
