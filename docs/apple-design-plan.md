# Apple-Design-Plan — Landingpages

**Status:** Phasen 1–4 und 6 sind umgesetzt (A2, A1, A3 · B1, B2 ·
D1, D2, D3 · C6, C5, C2 · C3) — Stand 2026-09-10. Offen sind **Phase 5**
(die rem-Umstellung, bewusst übersprungen) und **Phase 7** (Entscheidungen).
**Geltungsbereich:** `/` (`src/app/page.tsx`), `/sportvereine`, `/clubs` und alles,
was sie rendern — plus die Tokens in `src/app/globals.css`, soweit die drei
Seiten sie tragen.

Dieser Plan geht aus einem Abgleich der drei Seiten mit der `apple-design`-Skill
hervor (Apple, *Designing Fluid Interfaces* WWDC 2018 · *The Details of UI
Typography* WWDC 2020 · *Principles of Great Design* WWDC 2026). Paragraphen
(§1 … §16) verweisen auf deren Abschnitte.

**Für eine spätere Session:** jeder Punkt steht für sich. Reihenfolge siehe
„Phasen" unten; innerhalb einer Phase ist die Reihenfolge egal, **außer A2 vor
A1**. Haken (`[ ]` → `[x]`) beim Erledigen setzen und das Datum dazuschreiben.

---

## Regeln, die über allem stehen

Aus `CLAUDE.md`, nicht verhandelbar und beim Umsetzen leicht zu übersehen:

- **Keine Pillen-Formen.** Textbadges nie `border-radius: 999px`; Chips 5–9px.
  Rund bleibt nur, was wirklich rund ist (Fortschrittsbalken, Punkte, Avatare).
- **Deutsch, du-Form**, kein Krypto-Wording. Dieser Plan ändert an keiner Stelle
  Copy — wenn doch etwas nötig wird, ist es eine eigene Entscheidung.
- **Kein Tailwind** auf diesen Seiten. Styles gehören in die Inline-`<style>`-
  Blöcke der Seite oder in `globals.css`.
- **Ein blankes `.btn` hat keinen Hintergrund und keinen Rahmen.** Es braucht
  `.primary` / `.ghost` / `.subtle` — oder eine Regel wie `.cta-banner .btn`,
  die es sichtbar macht. Beim Umbauen von Buttons darauf achten.
- **Nav-Leisten nie von Hand schreiben.** `SiteNav` gibt immer alle Punkte in
  einer festen Reihenfolge aus; eine Seite wählt nichts aus, sie sagt nur, wo
  sie steht (`active`).
- **Marken-Violett** über `--hue: 285`. Nischenseiten unterscheiden sich über
  Inhalt und Beispiele, nie über die Farbe.

## Prüfen

```bash
npx tsc --noEmit   # Typen
npm run lint       # ESLint
npm test           # Vitest
```

Dev-Server und Build laufen **nicht** in der Session; der Nutzer pusht selbst
und schaut sich Vercel an. Optische Prüfung deshalb per Codelesen oder, wenn
nötig, mit den Chrome-Tools gegen eine bereits deployte Preview.

Zusätzlich bei diesem Plan von Hand zu prüfen:

- **Reduced Motion:** macOS → Systemeinstellungen → Bedienungshilfen → Anzeige →
  „Bewegung reduzieren". Alle drei Seiten müssen als Standbild lesbar bleiben.
- **Reduced Transparency:** dieselbe Stelle, „Transparenz reduzieren".
- **Tastatur:** einmal mit Tab durch jede Seite. Jeder Halt muss sichtbar sein.
- **Kontrast:** Farbwerte mit einem Prüfer gegen `--surface` (#fff) **und**
  `--surface-2` messen, nicht schätzen.

---

## Phasen

| Phase | Inhalt | Aufwand | Risiko |
|---|---|---|---|
| ~~**1**~~ | ~~A2 → A1, A3~~ | erledigt 2026-09-10 | — |
| ~~**2**~~ | ~~B1, B2~~ | erledigt 2026-09-10 | — |
| ~~**3**~~ | ~~D1, D2, D3~~ | erledigt 2026-09-10 | — |
| ~~**4**~~ | ~~C6, C5, C2~~ | erledigt 2026-09-10 | — |
| **5** | B3 (rem-Umstellung) | groß, mechanisch | mittel — eigener Durchgang |
| ~~**6**~~ | ~~C3~~ | erledigt 2026-09-10 | — |
| **7** | C1, C4, D4, E | **Entscheidungen, keine Patches** | — |

Phase 7 nicht ohne Rücksprache umsetzen: das sind Haltungsfragen, keine Fehler.

---

# A — Reaktion auf Eingabe (§1)

> Apples erste Regel: auf **Pointer-down** reagieren, nicht auf Release. Ohne
> das fällt das Gefühl von Direktheit „von der Klippe". Auf dem Handy gibt es
> gar keinen Hover — dort ist ein fehlender `:active` das einzige, was der
> Nutzer merkt.

## [x] A2 — `transition: all` auf `.btn` ersetzen — erledigt 2026-09-10

**Wo:** `src/app/globals.css:232`

```css
border: 1px solid transparent; transition: all 0.15s;
```

**Warum:** `all` animiert jede Eigenschaft mit, auch künftige, und zwingt den
Druck auf dieselbe Dauer wie den Hover. Apple drückt in ~100 ms auf `transform`
allein; Hover darf langsamer bleiben. Außerdem ist `all` ein Repaint-Risiko
genau dort, wo im CTA-Banner ohnehin `.btn-shine::after` läuft.

**Wie:** auf benannte Eigenschaften umstellen, z. B.
`transition: background-color .15s, border-color .15s, box-shadow .15s, color .15s, transform .1s ease-out;`

**Zuerst.** A1 legt sich auf diese Deklaration.

**Fertig, wenn:** kein `transition: all` mehr in `globals.css` für `.btn`;
Hover auf `.btn.primary` sieht unverändert aus.

## [x] A1 — Druckzustand für alle Bedienelemente der drei Seiten — erledigt 2026-09-10

**Warum:** `globals.css:228–250` kennt nur `:hover` und `:disabled`. Der
Haupt-CTA der Startseite (`page.tsx`, Hero, „Kostenlos anfangen →") gibt auf
einem Telefon **null** Rückmeldung zwischen Tippen und Navigation. Das ist die
einzige Handlung, um die die ganze Seite gebaut ist.

Das ist **keine Hausregel, sondern eine Lücke**: `my-tickets/page.tsx:126`,
`LoginModal.tsx:360` und `doorman/[eventId]/page.tsx:264` machen es bereits
richtig. Diese Umsetzungen sind die Vorlage — Werte von dort übernehmen, damit
die App eine Sprache spricht.

**Wo, mit Absicht getrennt:**

| Element | Datei | Vorschlag |
|---|---|---|
| `.btn` (alle Größen) | `globals.css:228` | `transform: scale(.97)` |
| `.nav a`, `.nav button` | `globals.css:132` | kein Scale — Hintergrund eine Stufe dunkler; ein kippender Nav-Punkt wirkt unruhig |
| `.faq summary` | `sportvereine/page.tsx`, `clubs/page.tsx` (PAGE_CSS) | `background: var(--surface-2)` |
| `.fee-calc .payer button` | `FeeCalculator.tsx:57` | `transform: scale(.97)` |
| `.fee-copy .more`, `.nsw-more`, `.footer .links a` | jeweilige PAGE_CSS / `NicheSwitch.tsx` | `opacity: .7` |

**Nicht anfassen:** `.trust-item` ist ein `div`, kein Link, und darf keine
Druck-Rückmeldung bekommen — sonst verspricht sie eine Handlung, die es nicht
gibt.

**Falle:** `.faq summary` liegt im `PAGE_CSS`-String **beider** Nischenseiten,
doppelt getippt. Beide ändern, sonst laufen sie auseinander. (Wenn dabei ohnehin
angefasst: die FAQ-CSS ist zwischen den beiden Seiten identisch und wäre ein
Kandidat für eine geteilte Konstante — aber als eigener Schritt, nicht hier.)

**Fertig, wenn:** jedes anklickbare Element auf allen drei Seiten sichtbar
reagiert, bevor der Finger hochgeht.

## [x] A3 — Sichtbarer Fokus — erledigt 2026-09-10

**Warum:** in `globals.css` gibt es **keinen** Fokusring. Zeile 543 ist
`outline: none` auf Eingabefeldern — dort ersetzt durch Rand und Schatten, das
ist in Ordnung. Buttons, Nav-Links, Footer-Links und vor allem die
FAQ-`<summary>`-Zeilen (`list-style: none`, eigenes Chevron) sind für jemanden
an der Tastatur unsichtbar. §16 Handlungsfähigkeit: den Nutzer nie im Blindflug
lassen.

**Wie:** eine gezielte Regel in `globals.css`, **nicht** global auf `*`:

```css
a:focus-visible,
button:focus-visible,
summary:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm); /* damit der Ring der Form folgt */
}
```

**Fallen:**
- `:focus-visible`, nicht `:focus` — sonst blitzt der Ring bei jedem Mausklick.
- `.input`/`.textarea`/`.select` sind absichtlich ausgenommen (sie haben ihren
  eigenen Fokuszustand ab `globals.css:539`). Prüfen, dass die neue Regel sie
  nicht doch trifft.
- `outline-offset` braucht Platz. Bei `.nav a` in der engen Leiste und bei den
  Buttons im CTA-Banner nachsehen, dass nichts abgeschnitten wird.
- Im CTA-Banner steht der Ring auf Violett — dort ist `var(--accent)` unsichtbar.
  Für `.cta-banner :focus-visible` auf Weiß umstellen.

**Fertig, wenn:** ein Tab-Durchlauf über alle drei Seiten an jeder Station
sichtbar ist, auch im violetten Banner.

### Umsetzungsnotizen zu Phase 1 (2026-09-10)

Drei bewusste Abweichungen vom Wortlaut oben:

- **A3 setzt kein `border-radius`.** Der Vorschlag hatte
  `border-radius: var(--radius-sm)` in der Fokusregel; das formt aber die
  Elemente *selbst* um, solange sie den Fokus haben (`.btn.lg` springt von 10px
  auf 6px, `.nav a` von 7px auf 6px). Heutige Engines legen den Ring von allein
  um den vorhandenen Radius — die Zeile ist überflüssig und schädlich.
- **A1 bei `.faq summary`: `--surface-3` statt `--surface-2`.** Die Zeile steht
  auf weißem Grund; 0.987 gegen 1.0 ist kein sichtbarer Unterschied. Dieselbe
  Stufe wie `.nav a:active`.
- **A1 bekam einen `prefers-reduced-motion`-Zweig** (wie in „Nicht anfassen"
  gefordert). Das Drücken verschwindet dort nicht, es wird nur bewegungsfrei:
  `transform: none; filter: brightness(0.94)` — sonst hätte gerade der Nutzer
  mit reduzierter Bewegung als Einziger gar keine Rückmeldung.

Zusätzlich zur Tabelle mitgenommen, weil die Abnahmebedingung „jedes anklickbare
Element" lautet: `.le-more` (`LiveEvents.tsx`) und der klassenlose Textlink neben
`ProPrice`, über `.pro-price a:active` erwischt statt über neues Markup.

Nebenwirkung, die in Phase 5 wieder auftaucht: `.nav` bekam bei ≤700px
`padding-block: 4px`. Die Leiste scrollt dort in sich selbst und ist damit ein
Clip-Container, der den Fokusring oben und unten abgeschnitten hätte.

**Nicht erledigt, bewusst:** `.event-card` (die Karten von `LiveEvents`) hat
weiterhin keinen Druckzustand. Sie ist app-weit und trägt `/events`,
`/@handle` und das Dashboard mit — das sprengt „klein, eine Datei" und gehört in
einen eigenen Durchgang zusammen mit den übrigen Kartenflächen.

---

# B — Zugänglichkeit, wo die gute Arbeit knapp aufhört

> Die Seiten decken `prefers-reduced-motion` vorbildlich ab. Die beiden
> Geschwister-Abfragen fehlen komplett, und ein Token liegt unter der Schwelle.

## [x] B1 — `prefers-reduced-transparency` behandeln — erledigt 2026-09-10

**Warum:** die Kopfleiste ist eine echte durchscheinende Ebene
(`globals.css:120–125`, `backdrop-filter: saturate(1.3) blur(14px)`) — genau das,
was §12 will. Die Skill koppelt das aber an eine Abschaltmöglichkeit, und die
gibt es nirgends.

**Betroffen:**
- `.topbar` — `globals.css:120–125`
- `.modal-backdrop` — `globals.css:496` (`blur(4px)`)
- `globals.css:811` (zweiter Blur, beim Anfassen mitnehmen)
- `HeroTicket.tsx` — `background: 'rgba(255,255,255,.72)'` (Inline-Style, nicht
  per Media Query erreichbar; entweder in eine Klasse ziehen oder bewusst so
  lassen und hier vermerken)

**Wie:**

```css
@media (prefers-reduced-transparency: reduce) {
  .topbar { background: var(--surface); backdrop-filter: none; -webkit-backdrop-filter: none; }
  .modal-backdrop { backdrop-filter: none; background: oklch(0.2 0.02 275 / 0.5); }
}
```

**Fertig, wenn:** mit aktivierter Systemeinstellung keine Fläche mehr durchscheint
und alle Texte auf deckendem Grund stehen.

### Umsetzung (2026-09-10)

Ein Block am Ende von `globals.css`, direkt neben dem `prefers-reduced-motion`-
Block — die beiden Systemeinstellungen gehören zusammen gelesen. Darin
`.topbar`, `.modal-backdrop` und `.celebrate-backdrop` (das war der „zweite
Blur"), dazu `.auth-scene[data-dimmed]`, dessen Blur denselben Zweck hat.

Zwei Ergänzungen über die Liste hinaus, beide von allen drei Seiten aus
erreichbar: **`.login-veil`** (`LoginModal.tsx`, `blur(7px)`) — der Schleier
deckt dort ohne Blur stärker (46 % → 72 %), sonst steht der Dialog auf einer
scharf lesbaren Seite. Und `.auth-scene`, siehe oben.

**`HeroTicket` wurde in eine Klasse gezogen**, nicht vermerkt-und-gelassen:
`background` und `border` stehen jetzt in `HERO_TICKET_CSS` (vormals
`IDLE_CSS`, umbenannt, weil die Konstante nicht mehr nur die Bewegung trägt),
der Rest bleibt Inline-Style. Unter reduzierter Transparenz wird die Karte
deckend weiß. Der Kommentar zum fehlenden `backdrop-filter` ist mitgewandert
und gilt unverändert (siehe E3).

**Die Scrims bleiben absichtlich halbdurchsichtig.** Was fällt, ist der Blur;
die Deckung steigt zum Ausgleich (Modal 40 → 50 %, Celebrate 36 → 48 %). Ein
komplett deckender Scrim würde die Seite dahinter verschwinden lassen, und
`prefers-reduced-transparency` zielt auf Material und Vibrancy, nicht auf
Verdunkelung. Die Abnahmebedingung oben ist in diesem einen Punkt strenger
formuliert als sie gemeint sein kann.

Wo die Abfrage noch nicht unterstützt wird (Firefox), bleibt alles wie bisher —
derselbe akzeptierte Rückfall wie bei `::details-content` in C5.

## [x] B2 — `--ink-4` erfüllt AA nicht + `prefers-contrast` fehlt — erledigt 2026-09-10

**Warum:** `--ink-4: oklch(0.68 0.012 275)` (`globals.css:16`) liegt auf
`--surface` bei rund **3:1** — unter den 4.5:1, die kleiner Text braucht. Auf
den drei Seiten trägt es Text zwischen 9.5 und 12.5px, also genau die Größen,
bei denen es am meisten weh tut:

- `.fee-calc .scale`, `.fee-row .hint` — `FeeCalculator.tsx:35,44`
- `.psc-row .k .sub` — `ShopCard.tsx:123`
- `.scn-tk-kicker`, `.scn-door-counters .l` — `DoorScene.tsx` (DOOR_SCENE_CSS)
- `.faq summary .faq-chev` — beide Nischenseiten

**Wie:** `--ink-4` auf etwa `oklch(0.58 0.012 275)` absenken (≈5:1 auf Weiß)
und zusätzlich:

```css
@media (prefers-contrast: more) {
  :root { --ink-3: oklch(0.44 0.015 275); --ink-4: oklch(0.50 0.012 275);
          --line: oklch(0.80 0.01 275); --line-2: oklch(0.72 0.012 275); }
}
```

**⚠️ Reichweite:** `--ink-4` ist ein **app-weites** Token. Die Änderung wirkt auf
Dashboard, Ticketseiten, Doorman, Admin. Das ist erwünscht (überall dasselbe
Problem), aber nach der Änderung mindestens `/dashboard`, `/my-tickets`,
`/tickets/[assetId]` und `/doorman/[eventId]` durchsehen, dass nichts, was
absichtlich zurücktritt (Platzhalter, deaktivierte Zeilen), plötzlich vordrängt.

Falls die Reichweite unerwünscht ist, die Alternative: `--ink-4` lassen und die
sechs Fundstellen oben einzeln auf `--ink-3` heben. Weniger sauber, dafür
eingegrenzt. **Vorschlag: Token ändern**, weil das Problem wirklich überall
dasselbe ist.

**Fertig, wenn:** jede der sechs Fundstellen gemessen ≥4.5:1 erreicht.

### Umsetzung (2026-09-10) — der Wert oben war zu hell

**`oklch(0.58 …)` erreicht 4.29:1 auf Weiß, nicht die im Plan geschätzten ≈5:1**
— also weiterhin unter AA. Nachgerechnet (OKLCH → sRGB → Relativluminanz,
WCAG-2-Formel) statt geschätzt:

| L | auf `--surface` (#fff) | auf `--surface-2` |
|---|---|---|
| 0.68 (alt) | 2.88:1 | 2.78:1 |
| 0.58 (Planwert) | 4.29:1 | 4.13:1 |
| **0.555 (gesetzt)** | **4.76:1** | **4.58:1** |
| 0.54 (= `--ink-3`) | 5.07:1 | 4.88:1 |

Gesetzt ist **`oklch(0.555 0.012 275)`** — der hellste Wert, der auf *beiden*
im Plan genannten Gründen über 4.5:1 misst.

**Die eigentliche Erkenntnis:** damit liegt `--ink-4` 1,5 % Helligkeit von
`--ink-3` entfernt, ist optisch also derselbe Ton. Eine vierte, noch leisere
Textstufe ist auf weißem Grund nicht AA-fähig — das ist keine Panne der
Umsetzung, sondern genau die Alternative, die der Plan selbst nennt („die sechs
Fundstellen einzeln auf `--ink-3` heben"). Das Token bleibt als eigener Name
bestehen, damit die Absicht „leiseste Stufe" ansprechbar bleibt; **ob die
Ink-Skala künftig nur noch drei Stufen hat, ist eine eigene Entscheidung** und
gehört zu Phase 7, nicht hierher.

**Die Fundstellen stimmen nicht mehr ganz:** `.scn-door-counters .l` trägt
inzwischen `--ink-3` und war nie betroffen; dafür stehen zwei 9.5px-Beschriftungen
im `HeroTicket` („Ticket", „Kategorie") auf `--ink-4`. Alle betroffenen Stellen
liegen auf `--surface` (weiß), keine auf `--surface-3`.

**Durchsicht der app-weiten Reichweite** (die ⚠️ oben), Ergebnis:

- **Ein echter Zusammenstoß, behoben:** `.login-resend:disabled`
  (`LoginModal.tsx`) war `--ink-4` gegen `--ink-3` im aktiven Zustand — der
  Unterschied wäre verschwunden. Steht jetzt auf `--ink-3` mit `opacity: .55`.
  Deaktivierte Bedienelemente sind von der Kontrastregel ausgenommen; dort
  zählt das Zurücktreten.
- **Bewusst gelassen:** `.ev-card:hover .ev-cta.ghost` und `.type-card:hover`
  benutzen `--ink-4` als *Rahmenfarbe* und werden dadurch dunkler. Ein Hover
  ist ein Betonungs-, kein Rückzugszustand — mehr Betonung ist dort keine
  Verschlechterung.
- **Unkritisch bis besser:** Platzhaltertext (`/events`-Suche), der
  Ausverkauft-Balken (`eventCardView`), leere Abzeichen-Plätze auf
  `/my-tickets` (das „leer" trägt dort der gestrichelte Ring, nicht die
  Textfarbe), `.qty-btn:disabled` (aktiv ist `--ink-2`, der Abstand bleibt).
- **Nicht betroffen:** `/dashboard`, `/tickets/[assetId]` und
  `/doorman/[eventId]` benutzen `--ink-4` gar nicht; der dunkle Pro-Bereich
  überschreibt das Token vollständig (`proTheme.ts`) und bleibt unberührt —
  auch unter `prefers-contrast`, weil sein `:root` später in der Kaskade steht.

Der veraltete Kommentar in `event/[id]/page.tsx` („ink-4 auf surface-2 liegt
unter dem 3:1-Kontrast") wurde nachgezogen; die Entscheidung dort bleibt richtig,
ihre Begründung stimmte nach der Anhebung nicht mehr.

**`prefers-contrast: more` ist wie vorgeschlagen übernommen** und gemessen:
`--ink-3` 7.78:1, `--ink-4` 6.01:1, `--line` 1.23 → 1.87:1, `--line-2`
1.44 → 2.48:1.

## [ ] B3 — Nichts skaliert mit der Textgröße des Nutzers (§15)

**Warum:** jede Maßangabe auf allen drei Seiten ist feste px — Schrift
(`14.5px`, `13.5px`, `9.5px`), Abstände (`padding: 88px 64px 96px`), und der
Hero bei hart `62px` (`page.tsx`, `.hero-v2 h1`). §15 ist eindeutig: Abstände in
`rem`/`em`, damit eine größere Schrift das Layout nicht sprengt. Heute bekommt
jemand, der seine Browserschrift hochstellt, eine unveränderte Seite.

**Das ist ein eigener Durchgang, kein Nebenbei.** Groß, mechanisch, und beim
Vermischen mit anderen Punkten wird jedes Review unlesbar.

**Vorgehen:**
1. Nur `globals.css` plus die drei `PAGE_CSS`-Blöcke und die Showcase-Komponenten
   umstellen. Nicht die ganze App.
2. `font-size` und **vertikale** Abstände (`padding-block`, `margin-top`, `gap`)
   → `rem` bei Basis 16px (`14.5px` → `0.906rem`; sauberer ist, auf ganze
   Viertel zu runden: `0.9rem`).
3. **In px bleiben:** Haarlinien (`1px`), Radien (`--radius*`), Rahmenstärken,
   Schattenmaße, `box-shadow: 0 0 0 520px` im Sucher (`DoorScene.tsx`) — das ist
   Geometrie, keine Typografie.
4. `clamp()` behalten; nur der px-Anteil wird `rem`, der `vw`-Anteil bleibt.
   `clamp(32px, 4.6vw, 48px)` → `clamp(2rem, 4.6vw, 3rem)`.
5. `.hero-v2 h1 { font: 700 62px/1.03 }` bekommt bei der Gelegenheit ein
   `clamp()` nach oben — heute gibt es zwischen 980px und 1240px Viewport keine
   Anpassung, die 62px stehen dort in einem engen Zweispalter.

**Die halben Pixel** (`12.5`, `13.5`, `14.5`) sind gewollter Hausstil. Sie sind
aber auch der Grund, warum die Umstellung nicht rein mechanisch ist — pro Wert
entscheiden, ob gerundet wird. Im Zweifel den optischen Eindruck erhalten.

**Fertig, wenn:** bei Browserschrift 20px statt 16px alle drei Seiten größer
werden, ohne dass etwas überlappt oder waagerecht scrollt.

---

# C — Bewegung und Interaktionshandwerk

## [x] C6 — Schieberegler: Trefferfläche und Druck (§1, §2) — erledigt 2026-09-10

**Wo:** `FeeCalculator.tsx:29`

```css
.fee-calc input[type="range"] { width: 100%; accent-color: var(--accent); height: 4px; cursor: pointer; }
```

**Warum:** das einzige Element auf diesen Seiten, das man wirklich anfasst, ist
auf dem Handy am schwersten zu greifen. Die Regel
`@media (pointer: coarse) { .btn { min-height: 44px } }` (`globals.css:911`)
erreicht `input[type=range]` nicht. Und der Griff wächst beim Drücken nicht — §1.

**Wie:** Bahn und Griff selbst zeichnen, Trefferfläche auf 44px, Griff bei
`:active` auf ~1.15 skalieren.

**Fallen:**
- Sobald `-webkit-appearance: none` gesetzt ist, **greift `accent-color` nicht
  mehr**. Bahn und Griff müssen dann vollständig selbst gestylt werden, und zwar
  doppelt: `::-webkit-slider-runnable-track` / `::-webkit-slider-thumb` **und**
  `::-moz-range-track` / `::-moz-range-thumb`. Die beiden Pseudo-Selektoren
  vertragen sich nicht in einer Regelliste — getrennt schreiben, sonst verwirft
  der Browser beide.
- Der Griff ist ein echter Kreis. `border-radius: 50%` ist hier **richtig** und
  kein Verstoß gegen die Pillen-Regel.
- Die 44px Trefferfläche über Padding/`height` am `input`, nicht am Griff — sonst
  wächst die sichtbare Bahn mit.
- `FeeCalculator` steht auch auf `/preise`. Die Änderung dort mitprüfen.

**Fertig, wenn:** der Griff auf dem Telefon ohne Zielen zu treffen ist und beim
Drücken sichtbar reagiert.

### Umsetzung (2026-09-10)

Bahn und Griff sind jetzt selbst gezeichnet, jede Zeile doppelt (WebKit und
Gecko) und in **getrennten** Regeln, wie oben gewarnt. Trefferfläche über
`height` am Eingabefeld: 24px normal, **44px unter `(pointer: coarse)`**. Griff
18px, echter Kreis, `margin-top: -7px` zentriert ihn auf der 4px-Bahn; bei
`:active` `scale(1.15)`.

**Die gefüllte Bahn musste ersetzt werden.** Das stand nicht im Plan: mit
`accent-color` malt der Browser die Bahn links vom Griff von allein in der
Akzentfarbe — sobald `appearance: none` gesetzt ist, ist auch das weg, und ein
Regler ohne Füllung sieht nach „deaktiviert" aus. Die Füllung kommt jetzt aus
der Komponente als `--fill` (Prozent) in einen `linear-gradient` auf der Bahn.
Der Versatz zwischen Füllkante und Griffmitte beträgt an den Vierteln maximal
4,5px und liegt damit unter dem 18px breiten Griff — nicht korrigiert, weil die
`calc()`-Fassung die Regel unlesbar macht.

**Die Trefferfläche wächst nur nach innen.** Ein 44px hohes Eingabefeld an der
Stelle eines 4px hohen schiebt Preiszeile, Bahn und Beschriftung um 20px
auseinander — die Karte fällt auseinander, und die Beschriftung „kostenlos /
150 €" steht plötzlich weit unter der Bahn, zu der sie gehört. Deshalb steht die
zusätzliche Höhe in `--hit` und wird von den Außenabständen wieder
herausgenommen: `(14 − hit) + (4 + 2·hit) + (−hit) = 18px`, also genau der
senkrechte Platzbedarf von vorher, unabhängig von `--hit`. Fein 10px (24px
Feld), grob 20px (44px Feld). Der Abstand nach oben ist dafür aus dem
Inline-Style in die CSS gewandert, wo er mit `--hit` verrechnet wird.

**Zusätzlich: Fokus.** Der Ring aus A3 greift hier nicht — ein `input` ist weder
`a` noch `button` noch `summary`, und mit `appearance: none` verschwindet der
Standardring mancher Engines gleich mit. Der Regler bekommt deshalb einen
eigenen `:focus-visible`-Ring **am Griff** statt eines Rechtecks um das ganze
44px-Feld, in derselben Sprache wie `.input:focus` in `globals.css`. Das war
eine Lücke in Phase 1, die erst hier auffiel.

`prefers-reduced-motion`: der Druck bleibt, wird aber ein Ring statt einer
Vergrößerung.

**Auf `/preise` geprüft:** die Seite rendert `<FeeCalculator />` ohne eigene
`.fee-calc`-Regeln, bekommt die Änderung also unverändert.

⚠️ **Das ist der Punkt aus Phase 4, der am ehesten eine Pixelkorrektur braucht.**
Die vertikale Zentrierung der Bahn im 44px-Feld hängt daran, wie die Engine
`::-webkit-slider-runnable-track` im Eingabefeld platziert; das ist das übliche
Rezept, aber ungetestet im Browser.

## [x] C5 — FAQ öffnet ohne Bewegung (§8) — erledigt 2026-09-10

**Wo:** `sportvereine/page.tsx`, `clubs/page.tsx` (`.faq details`, beide PAGE_CSS)

**Warum:** das Chevron dreht sich über `0.2s`, der Antworttext springt schlagartig
auf volle Höhe — natives `<details>`. Das einzige bewegte Teil sagt nichts über
den Inhalt, der erscheint. §8: Zwischenbewegung soll auf das Ergebnis zeigen.

**Wie:** ohne JS, als progressive Verbesserung:

```css
:root { interpolate-size: allow-keywords; }
.faq details::details-content {
  block-size: 0; overflow: hidden;
  transition: block-size .28s cubic-bezier(.16,1,.3,1), content-visibility .28s allow-discrete;
}
.faq details[open]::details-content { block-size: auto; }
```

**Fallen:**
- `::details-content` und `interpolate-size` sind noch nicht überall da. Wo nicht,
  öffnet es wie heute schlagartig — das ist der akzeptierte Rückfall, kein Fehler.
- `interpolate-size` auf `:root` wirkt app-weit auf jede `height`-Transition mit
  Schlüsselwörtern. Prüfen, dass nirgends etwas anfängt zu animieren, was heute
  steht (Drawer, Modal, EventEditor).
- Wieder: **beide** Nischenseiten, doppelt getippte CSS.
- `@media (prefers-reduced-motion: reduce)` in beiden PAGE_CSS ergänzen; dort
  steht bislang nur das Chevron.

### Umsetzung (2026-09-10)

Wie vorgeschlagen, mit **einer Abweichung: `interpolate-size` steht auf
`.faq details`, nicht auf `:root`.** Die Eigenschaft vererbt, das reicht für
`::details-content` vollständig — und damit entfällt die app-weite Reichweite,
vor der der Plan selbst warnt. Drawer, Modal und EventEditor sind gar nicht
erst betroffen, es gibt nichts nachzusehen.

Der reduced-motion-Zweig ist in beiden PAGE_CSS ergänzt.

**Rückfall geprüft, alle Stufen sind unschädlich:** ohne `::details-content`
greift keine der beiden Regeln und es klappt auf wie bisher; mit
`::details-content`, aber ohne `interpolate-size` schaltet `block-size` sofort
von 0 auf auto (kein Zwischenzustand, in dem etwas unsichtbar bliebe); kennt
eine Engine `allow-discrete` nicht, ist nur die `transition`-Deklaration
ungültig, nicht die Höhe.

**`/fuer-veranstalter` und `/so-funktionierts` haben dieselbe FAQ und bleiben
unanimiert** — ihre PAGE_CSS ist eine eigene Kopie, und der Plan grenzt C5 auf
die beiden Nischenseiten ein. Das ist jetzt der dritte Punkt, an dem die
vierfach getippte FAQ-CSS auffällt (siehe die Falle unter A1); eine geteilte
Konstante wäre ein eigener, lohnender Schritt.

## [x] C2 — `100dvh` unter einer klebenden Bühne (§11) — erledigt 2026-09-10

**Wo:** `DoorScene.tsx` (DOOR_SCENE_CSS): `.scn { height: 240vh }`,
`.scn-stage { position: sticky; top: 0; height: 100vh; height: 100dvh; }`

**Warum:** auf iOS ändert das Ein- und Ausfahren der Adressleiste `dvh`
**während** des Scrollens. Die angeheftete Bühne wird also mitten in der
Geräte-Transition neu vermessen — klassische Zitterquelle.

**Wie:** `100svh` statt `100dvh` für die klebende Höhe. `svh` ist der kleinste
Zustand und ändert sich beim Scrollen nicht. Die Bühne wird dadurch etwas
niedriger; die Innenaufteilung (`.scn-phone { top: calc(50% + 55px) }` und die
Breakpoint-Varianten bei 1180px/480px) danach nachmessen.

**Betrifft alle drei Seiten** — `DoorScene` steht auf jeder.

### Umsetzung (2026-09-10)

`height: 100vh; height: 100svh;` — die erste Zeile bleibt als Rückfall.

**Nachgemessen wurde nichts, und das ist begründet, nicht vergessen:** `svh` ist
genau die Höhe, mit der iOS die Seite ohnehin **lädt** (Adressleiste
ausgefahren). Die Innenaufteilung musste also nie mit mehr Platz auskommen als
jetzt — es fällt nur weg, dass die Bühne beim Scrollen auf `lvh` *wächst*. Alle
Offsets (`place-items: center`, `.scn-phone { top: calc(50% + 55px) }`, die
1180er- und 480er-Varianten) sind relativ zur Bühnenmitte und wandern mit. Die
zwei Auslöser liegen in `.scn` (240vh), nicht in der Bühne, und sind von der
Änderung gar nicht berührt.

`.scn { height: 240vh }` bleibt absichtlich `vh`: das ist die Scrollstrecke, nicht
die Bühne. Auf dem Desktop ändert sich nichts, dort sind `svh`, `dvh` und `vh`
identisch.

## [x] C3 — `HeroTicket` ist reine Maus (§2, §1) — erledigt 2026-09-10

**Wo:** `HeroTicket.tsx:38` (`onMouseMove`), `:54` (`onMouseLeave`)

**Warum:** kein Pointer-Event, kein `setPointerCapture`, kein Touch-Pfad. Auf
dem Telefon — wo der Großteil des kalten Traffics aus einem Instagram-Bio-Link
ankommt — ist die Karte eine dauernd driftende Dekoration, die auf Berührung
**gar nicht** reagiert. Der Kommentar in der Datei begründet die Idle-Animation
genau damit, dass es auf Touch keinen Hover gibt; sie ersetzt aber keine
Reaktion, sie ersetzt nur die Bewegung.

**Wie:**
1. `onMouseMove`/`onMouseLeave` → `onPointerMove`/`onPointerLeave` (gleiche
   Signatur, gleiche Rechnung).
2. `onPointerDown`: `setPointerCapture`, sofort in Richtung Berührung kippen —
   das ist die Rückmeldung auf den Druck (§1).
3. `onPointerUp`/`onPointerCancel`: zurückfedern wie heute.

**Fallen:**
- Auf Touch feuert `pointermove` **nur während einer Berührung**. Der Ablauf ist
  dort also `down → move → up`, nicht `move → leave`. Beide Wege müssen den
  `resumeTimer` und die Klasse `is-tilting` korrekt hinterlassen.
- Ein Ziehen auf der Karte darf das Seitenscrollen nicht abwürgen. `touch-action`
  bewusst setzen — vermutlich `pan-y`, damit senkrechtes Scrollen gewinnt.
- Der Kommentar in der Datei erklärt genau, warum die Idle-Animation und die
  Inline-Transformation sich im Cascade schlagen. Diese Begründung gilt weiter;
  die 700ms-Logik nicht wegräumen.
- **Optional, niedrig (§5):** Beim Loslassen die Zeigergeschwindigkeit in die
  Rückkehr übergeben. Heute liefert ein schnelles Wegreißen und ein langsames
  Verlassen dieselbe 700ms-Kurve. Nur machen, wenn ohnehin an der Datei
  gearbeitet wird.

### Umsetzung (2026-09-10)

Alle drei Schritte wie beschrieben. `handleMove` und `tiltTo` sind getrennt,
weil `pointerdown` dieselbe Rechnung braucht; `beginTilt` kapselt das Abräumen
der Idle-Animation, dessen Cascade-Begründung unverändert im Code steht.

**`pointerup` federt nur bei Finger und Stift zurück, nicht bei der Maus.** Nach
einem Mausklick steht der Zeiger weiter auf der Karte — dort beendet erst
`pointerleave` die Bewegung. Ohne diese Unterscheidung hätte jeder Klick ein
sichtbares Zucken erzeugt: zurückfedern und vom nächsten `pointermove` sofort
wieder aufrichten.

**`touch-action: pan-y`** wie vermutet, plus **`user-select: none`** — ein Ziehen
mit der Maus markierte sonst den Text im Mockup, statt die Karte zu kippen. Die
Karte ist `aria-hidden` und reine Dekoration, es geht nichts zum Kopieren
verloren.

**Die optionale §5-Sache ist mitgemacht**, weil die Bedingung („wenn ohnehin an
der Datei gearbeitet wird") erfüllt war: die Zeigergeschwindigkeit vor dem
Loslassen verkürzt die Rückkehr von 700ms auf minimal 440ms (gedeckelt bei
1 px/ms). Der `resumeTimer` folgt jetzt der tatsächlichen Dauer statt einer
festen 700 — sonst übernähme die Idle-Animation bei einem schnellen Wegreißen zu
spät. Das ist der am leichtesten wieder herausnehmbare Teil dieses Punktes,
falls er sich falsch anfühlt.

**Nebenbei geschlossen: das Kippen war nie von `prefers-reduced-motion`
erfasst.** Die Liste unter „Nicht anfassen" führt die Abdeckung als vollständig,
aber sie gilt nur für die CSS-Animationen — das zeigergesteuerte Kippen liegt in
JS und lief weiter. Bisher traf das nur Maus-Nutzer, mit dem Touch-Pfad träfe es
jeden. Die Handler steigen jetzt bei aktiver Einstellung aus; `handleLeave`
**nicht**, sondern es holt die Karte ohne Feder zurück, damit sie nicht gekippt
stehen bleibt, wenn die Einstellung mitten in einer Berührung umgelegt wird.

## [ ] C4 — Bewegungsbudget (§14, §16 Zurückhaltung) — **Entscheidung**

Auf der Startseite laufen gleichzeitig: 2 Aurora-Flecken, 2 Glows, das
Hero-Verlaufsfeld, der Shimmer-Sweep, das Idle-Kippen, ~10 Scroll-Reveals, der
Türstrahl, der QR-Wechsel, der Ablaufbalken, der CTA-Shine. **Über elf gleichzeitig.**
Jede einzelne ist im Code begründet; keine wurde gegen die anderen abgewogen.

Der auffälligste Einzelfall: `heroTicketIdle` läuft `13s ... infinite` und hört
**nie** auf (`HeroTicket.tsx`, `IDLE_CSS`). Das größte Element über der Falz
rotiert dauerhaft in 3D. §14 rät ausdrücklich von dauerhaft bewegten großen
Flächen ab und schlägt vor, große bewegte Objekte während der Fahrt halb
durchsichtig zu machen.

**Zu entscheiden (nicht einfach umsetzen):**
- Idle-Kippen nach ein paar Durchläufen anhalten? Oder nur beim ersten
  Sichtbarwerden? Das Signal „diese Karte reagiert" trägt auch so.
- Aurora **oder** Glows — heute liegen beide Farbgrafiken übereinander plus das
  Hero-Feld.
- Scroll-Reveal auf die Kapitelanfänge begrenzen statt auf jeden Block.

## [ ] C1 — `DoorScene` ist ein Film, keine Oberfläche (§3, §8) — **Entscheidung**

`DoorScene.tsx:113` schaltet `data-step` **nur vorwärts**, danach läuft eine
verkettete Keyframe-Folge von rund **1,6 s** mit festen Verzögerungen
(`0.62s` Wash → `0.74s` Haken → `0.92s` Strich → `1.2s`/`1.3s` Text). Der Scroll
**löst** aus, er steuert nicht. Nichts davon ist greifbar, umkehrbar oder
scrubbar — §3 nennt Unterbrechbarkeit das wichtigste Prinzip überhaupt.

**Der Kommentar in der Datei begründet den Tausch ehrlich** (die scrollgebundene
Fassung ruckelte auf beiden Seiten), und der Tausch ist richtig. Zwei Folgen
gehören trotzdem benannt:

1. Wer schneller als 1,6 s vorbeiscrollt, sieht eine halb gespielte Szene und
   nie den Erfolgsmoment. Die Szene ist das beste Argument der Seite.
2. Wer hochscrollt, sieht eine tote Bühne. „Nur vorwärts" ist vertretbar — ein
   **Zurücksetzen beim vollständigen Verlassen** nach oben wäre es aber auch,
   und widerspricht der Begründung nicht.

**Apples Weg wäre nicht Scroll-Bindung**, sondern dieselben zwei Schritte über
Federn vom aktuellen Bildschirmwert aus, sodass ein unterbrochener Schritt neu
zielt statt sich anzustellen. Das wäre eine Bibliothek (Motion) und ein größerer
Umbau — nur mit ausdrücklicher Entscheidung.

---

# D — Orientierung und Wiedererkennbarkeit (§7, §16)

## [x] D1 — Die Nischenseiten beantworten „wo bin ich?" falsch — erledigt 2026-09-10

**Wo:** `sportvereine/page.tsx:190` und die gleiche Stelle in `clubs/page.tsx`:
`<SiteNav active="organizers" />`

**Warum:** die Leiste hebt **„Für Veranstalter"** hervor, während die URL
`/sportvereine` ist. Der hervorgehobene Punkt führt woanders hin. §16: was gleich
aussieht, muss sich gleich verhalten.

Dazu: keine der beiden Seiten kommt in `SiteNav.tsx:28–34` überhaupt vor. Zwei
eigene Einstiegsseiten haben keinen Platz in der Hauptstruktur — erreichbar nur
über den Footer der Startseite und die zwei `NicheSwitch`-Links.

**Wie:** `SiteNavKey` (`SiteNav.tsx:23`) um `'sport' | 'clubs'` erweitern und die
Seiten ihren eigenen Schlüssel übergeben lassen. Dann hebt die Leiste **nichts**
hervor — das ist ehrlich und genau das, was der Kommentar in `SiteNav.tsx`
verlangt („eine Seite wählt hier nichts aus; sie sagt nur, wo sie selbst steht").

**Ob die beiden Seiten zusätzlich Punkte in der Leiste bekommen, ist eine eigene
Entscheidung** (siehe D4) — die Leiste hat schon fünf Punkte und scrollt auf dem
Handy in sich selbst (`globals.css:880`).

### Umsetzung (2026-09-10)

Wie vorgeschlagen. `SiteNav.tsx` trennt jetzt zwei Typen: `SiteNavItemKey` sind
die fünf Punkte, die die Leiste ausgibt, `SiteNavKey` ist das, was eine Seite
über sich selbst sagen darf — die fünf plus `'sport' | 'clubs'`. Beide
Nischenseiten übergeben ihren eigenen Schlüssel, die Leiste hebt dort nichts
hervor.

Die Trennung ist wichtiger, als sie aussieht: ohne sie sieht ein späterer Leser
zwei Schlüssel ohne Eintrag und „repariert" das. Der Kommentar am Typ nennt
deshalb ausdrücklich den Zweck. Nebenbei stand der große Komponenten-Kommentar
bisher über dem Typ statt über der Komponente; er sitzt jetzt richtig.

## [x] D2 — Zwei konkurrierende Haupt-CTAs auf den Nischenseiten — erledigt 2026-09-10

**Wo:** beide Nischenseiten. Kopfleiste: `<Link className="btn primary sm">
Kostenlos starten</Link>`. Hero, wenige hundert Pixel darunter:
`<Link className="btn primary lg">Kostenlos starten</Link>` — **derselbe Text,
dieselbe Farbe, gleichzeitig sichtbar.** Dazu daneben `.btn ghost lg`
„Was es kostet".

Die Startseite macht es richtig: genau ein primärer Knopf im Hero, in der
Kopfleiste nur `SignInButton`.

**Wie (Vorschlag):** die Kopfleiste der Nischenseiten auf `.btn ghost sm` oder
auf `SignInButton` umstellen, damit im Hero eine einzige Hauptsache steht. §16
Hierarchie: das Wichtigste muss das Auffälligste sein — zweimal dasselbe
Auffällige hebt sich auf.

### Umsetzung (2026-09-10): `SignInButton`, nicht `.btn ghost sm`

Von den beiden angebotenen Wegen der zweite, aus drei Gründen:

1. Es ist genau das, was die Startseite tut — und die macht es laut diesem
   Absatz richtig. Danach sind alle drei Einstiegsseiten gleich gebaut.
2. Ein leiserer Knopf mit **demselben Text** wäre immer noch eine Dopplung, nur
   eine schwächere. `SignInButton` sagt etwas anderes („Anmelden" bzw.
   „Dashboard") und ist damit keine zweite Hauptsache, sondern ein zweiter Weg.
3. **Der eigentliche Fehler war größer als die Hierarchie:** auf beiden
   Nischenseiten gab es überhaupt keine Anmeldung. Ein Veranstalter mit Konto,
   der auf `/clubs` landet, konnte nur „Kostenlos starten" — also zurück auf
   das Formular, das er längst ausgefüllt hat.

Folge, in `CLAUDE.md` nachgezogen: die Regel „Anmeldung von der Startseite
leitet weiter, sonst bleibt man stehen" heißt jetzt „von einer
**Einstiegsseite**" und zählt die drei auf. Keine neue Regel, dieselbe mit dem
richtigen Geltungsbereich — `/shop/[id]`, `/order/[token]`, Ticket und Tür
bleiben unverändert außen vor.

Die Hero-CTAs der Nischenseiten sind **nicht** angefasst: „Kostenlos starten"
(primary) neben „Was es kostet" (ghost) ist eine saubere Haupt-/Nebensache.

## [x] D3 — Abschnittsrhythmus läuft auseinander — erledigt 2026-09-10

Startseite (`page.tsx`, PAGE_CSS):
```css
.container > section + section { margin-top: 88px; padding-top: 88px; border-top: 1px solid var(--line); }
```
Beide Nischenseiten: dieselben `88px` — **ohne** die Haarlinie.

Gleicher Abstand, unterschiedliches Struktursignal, kein genannter Grund.
**Vorschlag:** die Haarlinie auf allen dreien führen. Sie ist auf der langen
Startseite entstanden, weil dort die Abschnitte ineinanderliefen; auf den
Nischenseiten mit FAQ und vier Kapiteln gilt dasselbe.

### Umsetzung (2026-09-10)

Wie vorgeschlagen, samt `padding-top` — die Startseite setzt beides, und ohne
das Padding säße die Linie am oberen Rand des Inhalts statt in der Mitte des
Abstands. Der 700px-Zweig ist mitgezogen (56px). Beide Seiten trugen über der
Zeile den Kommentar „wie auf der Startseite", ohne dass es stimmte; er sagt
jetzt, was die Regel tut und warum.

**Eine Stelle sieht dadurch anders aus als auf der Startseite, und das ist ein
Struktur-, kein CSS-Unterschied:** dort steht der Hero **außerhalb** von
`.container` (vollbreite Bahn mit eigenem Hintergrund), auf den Nischenseiten
ist `.info-hero` der erste Abschnitt **im** Container. Die Regel greift ab dem
zweiten Kind — also zieht sie auf den Nischenseiten eine Linie zwischen Hero
und Vertrauensleiste, die es auf der Startseite an dieser Stelle nicht gibt.
Bewusst so gelassen: der Nischen-Hero hat keine eigene Fläche, die ihn absetzt,
und lief vorher in die Vertrauensleiste hinein. Wenn die Linie dort auf der
Preview stört, ist das ein Einzeiler
(`.container > .info-hero + section { border-top: none; padding-top: 0 }`),
kein Rückbau von D3.

## [ ] D4 — Seitenwechsel ohne Anker (§7) — **Entscheidung**

`NicheSwitch` (`NicheSwitch.tsx`) führt aus der Mitte von Kapitel 1 auf eine
Seite mit anderer Hero-Bauform: `.hero-v2` (zweispaltig, 62px, Ticket-Mockup,
ein CTA) gegen `.info-hero` (einspaltig ≤720px, `clamp(32,4.6vw,48)`,
dreizeilige Überschrift, zwei CTAs). Nichts trägt hinüber — kein geteiltes
Element, kein Ursprung. §7 will, dass das Ziel dort hervorgeht, wo es ausgelöst
wurde.

**Zu entscheiden:** entweder die drei Heros auf eine gemeinsame Bauform bringen
(dann ist der Wechsel ein Übergang statt eines Schnitts) — oder den Unterschied
bewusst behalten, weil die Nischenseiten eigene Eingänge sind und nicht
Unterseiten (so steht es im Kopfkommentar von `sportvereine/page.tsx`).
Beides vertretbar; heute ist es keine Entscheidung, sondern ein Nebeneffekt.

---

# E — Material und Tiefe (§12) — meist Entscheidung

## [ ] E1 — Harte Trennlinie statt Scroll-Kante

`globals.css:125`: `.topbar { border-bottom: 1px solid var(--line) }` wird
**immer** gezeichnet, auch ganz oben, wenn gar nichts darunter durchläuft. §12
will stattdessen eine Verlaufs-/Blur-Kante genau dort, wo schwebende Chrome
tatsächlich Inhalt überdeckt.

**Wie:** die Linie erst ab einem Scroll-Offset zeigen. Ohne JS geht das mit
`animation-timeline: scroll()` — das ist aber noch nicht überall verfügbar.
Deshalb: **prüfen, ob es die Sache wert ist.** Die Linie stört nicht, sie ist nur
nicht das, was Apple tut.

## [ ] E2 — Materialstärke skaliert nicht mit der Fläche

Kopfleiste, 60px hoch: `blur(14px)` (`globals.css:123`).
`.modal-backdrop`, ganzer Bildschirm: `blur(4px)` (`globals.css:496`).
Die **größere** Fläche hat den **schwächeren** Blur. §12: größere Flächen lesen
sich dicker. Umdrehen wäre eine Zeile — betrifft aber jedes Modal der App, also
mit B1 zusammen anfassen und dann überall ansehen.

## [ ] E3 — Hell auf hell im Hero (nur vermerkt, kein Fehler)

`HeroTicket`s `rgba(255,255,255,.72)` liegt über dem Hero-Verlaufsfeld, der
Aurora und einem Glow — nominell der „helle durchscheinende Fläche auf heller
durchscheinender Fläche"-Stapel, vor dem §12 warnt. In der Praxis trägt jedes
Schriftzeichen ein **deckendes** Kind, die Lesbarkeit hält also.

**Nur damit eine spätere Änderung nicht Text direkt auf diese Fläche setzt.**
Der Kommentar in `HeroTicket.tsx` erklärt außerdem, warum dort kein
`backdrop-filter` mehr steht (unsichtbar, aber pro Shimmer-Frame teuer) — das
nicht zurückbauen.

---

# Nicht anfassen — das ist schon richtig

Wenn eine spätere Session hier „aufräumt", ist es eine Verschlechterung:

- **Größenabhängiges Tracking**, sauber über alle drei Seiten: `-0.045em` @62px,
  `-0.035em` @clamp(32–48), `-0.03em` auf h2, `-0.02em`/`-0.015em` auf h3,
  `-0.005em` auf Buttons. Das ist §15 in Reinform. **Nie auf einen festen
  `letter-spacing`-Wert vereinheitlichen.**
- **Zeilenhöhe läuft gegenläufig zur Größe:** 1.03 → 1.15 → 1.3 → 1.65.
- **`prefers-reduced-motion` ist wirklich vollständig:** Aurora, Glows, Shimmer,
  Idle-Kippen, Scroll-Reveal, FAQ-Chevron und `DoorScene` mit vollem Standbild-
  Endzustand — in JS (`DoorScene.tsx:99`) **und** in CSS. Bei jeder neuen
  Animation aus diesem Plan denselben Zweig mitliefern.
- **Die Kopfleiste ist eine echte durchscheinende Ebene**, unter der Inhalt
  durchläuft — nicht ein deckender Streifen (§12).
- **Das Sucherfeld ist ein echtes Loch**, gemalt vom eigenen Schlagschatten
  (`box-shadow: 0 0 0 520px var(--surface)`). Genau ein QR-Code, nie zwei, die
  auseinanderlaufen könnten. Nicht durch ein zweites Element „vereinfachen".
- **`ScrollReveal` setzt Elemente nach der Animation in ihren Naturzustand
  zurück** (`.reveal-done`, `globals.css:99`), damit Hover-Übergänge nicht gegen
  eine stehengebliebene Animation kämpfen — genau der Cascade-Fehler, vor dem §3
  warnt.
- **`@media (pointer: coarse) { .btn { min-height: 44px } }`** (`globals.css:911`).
- **Die Nischenseiten sind keine Startseite mit ausgetauschten Substantiven.**
  Sport hat das Dauerkarten-Kapitel, Clubs das Rückgabe-Kapitel. Das ist der
  Grund, warum sie keine Doorway-Pages sind — beim Vereinheitlichen erhalten.
