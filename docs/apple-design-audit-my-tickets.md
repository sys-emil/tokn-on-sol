# Apple-Design-Audit: /my-tickets

Stand 2026-09-11. Befund **und Umsetzung** (die Rangfolge am Ende ist
abgearbeitet; Stand der einzelnen Punkte unter „Was umgesetzt wurde"). Geprueft gegen den
`apple-design`-Skill (WWDC „Designing Fluid Interfaces“ 2018, „The Details of
UI Typography“ 2020, „Principles of Great Design“ 2026).

Geprueft wurden `src/app/my-tickets/page.tsx` (1913 Zeilen, CSS im
`PAGE_CSS`-Block) und die davon benutzten geteilten Klassen aus
`src/app/globals.css` (`.btn`, `.seg`, `.chip`, `.modal*`, `.badge-tile`,
`.topbar`, `.progress`).

Das Gegenstueck ist `docs/apple-design-plan.md`; der deckt `/`,
`/sportvereine` und `/clubs` ab. Mehrere Punkte unten sind genau die
Entscheidungen, die dort schon getroffen und auf `/my-tickets` nie
nachgezogen wurden.

---

## Zusammenfassung

Was die Seite **richtig** macht (und nicht „aufgeraeumt“ werden darf):

- Druckrueckmeldung auf pointer-down auf fast allen Flaechen (`.tk-wcard:active`
  0.965/0.08s, `.tk-stub:has(.tk-stub-link:active)`, `a.card:active`,
  `.tk-stub-action:active`, `.tk-timeline-item:active`, `.btn:active` global).
  Der Kommentar im CSS nennt sogar den richtigen Grund (zwei Netzaufrufe bis
  zur Ticketseite). Das ist §1 sauber getroffen.
- Der Fächer-Tilt reist als Custom Property, damit die Druck-Skalierung
  dazukommt statt die Neigung zu ersetzen — genau die Stelle, an der die
  meisten Implementierungen die Rueckmeldung verlieren.
- Ladezustand ist ein echtes Skelett in den Maszen der spaeteren Karte
  (296px), kein Spinner. Drei Fetches parallel.
- Die Suche filtert ohne Debounce bei jedem Tastendruck (§1: keine kuenstliche
  Latenz auf dem Eingabepfad).
- `prefers-reduced-motion` hat einen ausfuehrlichen, durchdachten Block.
- Grosse Schrift hat negatives Tracking (`.tk-title` 38px/-0.035em), kleine
  Mono-Label positives (0.1–0.24em). §15 im Prinzip verstanden.
- Die Rueckgabe ist zweistufig bestaetigt mit **echten**, serverseitig
  geholten Betraegen statt einer Schaetzung (§2 Forgiveness, §16 Feedback).

Was fehlt, in einem Satz: **die Seite hat keine einzige direkte Manipulation.**
Ein Faecher aus Tickets ist das physischste Objekt in der ganzen App, und er
laesst sich nur anklicken. Alles Bewegte sind CSS-Transitions und Keyframes,
also nichts davon ist unterbrechbar, geschwindigkeitsbewusst oder umkehrbar.

---

## A. Bewegung & Gesten (§2, §3, §4, §5, §6, §8, §9)

### A1 — Der Brieftaschen-Stapel ist nicht greifbar (§2, §3, §5, §6)
`page.tsx:1310–1390`. Der Stapel ist eine Liste von `<button>`s; Vorholen
laeuft ueber `onClick → setFrontId`, Oeffnen ueber `router.push`. Es gibt
kein `pointerdown`, kein `setPointerCapture`, keinen Grab-Offset, keine
Velocity-History, keine Momentum-Projektion.

Das ist der groesste Einzelbefund. Ein aufgefaecherter Kartenstapel setzt die
Erwartung, gewischt zu werden; der Skill nennt genau das („touch and content
should move together“). Heute passiert beim Ziehen nichts, und der
Faecher/Stapel-Wechsel laeuft ausschliesslich ueber einen separaten Knopf.

Fehlend, der Reihe nach: 1:1-Tracking mit Grab-Offset (§2), Uebergabe der
Release-Velocity an die Folgeanimation (§5), Projektion des Ruhepunkts statt
Snap vom Loslasspunkt (§6), Gummiband an den Stapelenden (§9).

### A2 — Alles Bewegte ist eine CSS-Transition, also nicht unterbrechbar (§3)
`page.tsx:32–41`: `.tk-stackarea` und `.tk-wcard` animieren mit
`transition: … 0.34s cubic-bezier(0.2,0.8,0.2,1)`. Waehrend der 340 ms laesst
sich eine Karte nicht greifen und nicht umlenken; ein zweiter Klick auf
„Faechern“ startet die Gegenbewegung von der Zielposition, nicht vom
Praesentationswert.

§3 nennt das den wichtigsten Punkt ueberhaupt und rät ausdruecklich von
Transitions/Keyframes fuer alles ab, was ein Nutzer anfassen kann.

### A3 — Das Schliessen der Abzeichenkarte haengt an einem Timer (§3)
`page.tsx:721–724`:

```js
const closeBadgeDetail = useCallback(() => {
  setBadgeClosing(true);
  setTimeout(() => { setBadgeDetail(null); setBadgeClosing(false); }, 240);
}, []);
```

240 ms lang ist der Dialog im Zustand „schliesst“, ohne Weg zurueck. Ein
erneuter Aufruf setzt `badgeClosing` nochmal auf `true` und legt einen
zweiten Timer an; die Animation startet nicht neu, der erste Timer feuert
weiter. Kein Rueckgriff (greifen und wieder oeffnen), kein Abbruch.

### A4 — Ueberschwingen ohne vorangegangene Geste (§4)
Drei Animationen federn, obwohl ihnen keine Geste mit Impuls vorausging —
§4 reserviert Bounce ausdruecklich fuer Momentum:

| Stelle | Kurve | Ausloeser |
|---|---|---|
| `freshIn` (`page.tsx:326`) | `cubic-bezier(0.18, 1.2, 0.3, 1)` | Seitenaufbau nach Checkout |
| `badgeLand` (`:357`) | `cubic-bezier(0.18, 1.4, 0.3, 1)` | Daten geladen |
| `badgeCardIn` (`:414`) | `cubic-bezier(0.18, 1.3, 0.3, 1)` | Klick auf eine Kachel |

Der Skill-Default waere kritisch gedaempft (damping 1.0, response 0.3–0.4).
Bei `freshIn` und `badgeLand` ist das Feiern der Zweck, das laesst sich
verteidigen — `badgeCardIn` ist ein gewoehnliches Dialog-Erscheinen und
sollte nicht federn.

### A5 — Keine Feder nirgends (§4)
Kein Spring-Integrator auf der Seite, weder Bibliothek noch handgeschrieben.
`docs/apple-design-plan.md` haelt fest, dass die Tuerszene auf `/` genau dafuer
einen eigenen Integrator bekommen hat — auf `/my-tickets` gibt es kein
Gegenstueck.

### A6 — Der Tab-Wechsel hat keinen Uebergang (§1, §7)
`page.tsx:1688–1697`. „Bevorstehend“ ↔ „Sammlung“ tauscht den DOM hart aus.
Kein Cross-Fade, keine Richtung, keine gleitende Markierung im `.seg`.
Zwei nebeneinanderliegende Ansichten ohne raeumliche Beziehung.

---

## B. Raeumliche Konsistenz (§7, §8)

### B1 — Die Abzeichenkarte kommt aus der Mitte, nicht aus der Kachel
`page.tsx:409–424`. `transform-origin: center` und `scale(0.5)` aus dem
Bildschirmmittelpunkt. §7 verlangt die Verankerung am Ausloeser: die Karte
muesste aus **ihrer** Kachel wachsen, also `transform-origin` auf deren
Position gesetzt.

### B2 — Ein- und Ausgang der Abzeichenkarte sind nicht spiegelbildlich
Rein: `scale(0.5) translateY(12px)`, 0.36s, `cubic-bezier(0.18,1.3,0.3,1)`.
Raus: `scale(0.72) translateY(6px)`, 0.24s, `cubic-bezier(0.4,0,0.9,0.4)`.
Andere Skalierung, andere Distanz, andere Dauer, keine inverse Kurve. §7
verlangt denselben Weg hin und zurueck.

### B3 — Der Overlay-Scrim der Abzeichen spricht eine andere Materialsprache
`.badge-detail-overlay` (`:390`) nutzt `blur(3px)` und 42 % Deckung; die
beiden anderen Dialoge derselben Seite (Rueckgabe, Teilen) nutzen
`.modal-backdrop` mit `blur(16px)` und 40 %. Der Kommentar in `globals.css`
begruendet die 16px ausdruecklich damit, dass eine bildschirmfuellende Flaeche
dicker liest — die Begruendung gilt fuer den Abzeichen-Scrim genauso. §12
(„bigger surfaces should read as thicker“) und §16 Craft.

### B4 — Kein Zuruecktreten der Hintergrundebene
§12: eine modale Aufgabe kombiniert Scrim **und** Zuruecktreten/Verschieben
der darunterliegenden Ebene. Alle drei Dialoge legen nur einen Schleier
drueber.

### B5 — Materialisieren statt Einblenden
§12 letzter Punkt: Glasflaechen sollen Blur-Radius und Scale gemeinsam
animieren. `.badge-detail-overlay` blendet den fertigen 3px-Blur mit
`opacity` ein (`badgeOverlayIn`), `.modal-backdrop` ebenso mit `fadeIn`.

---

## C. Material, Tiefe, Kanten (§12)

### C1 — Die Filterleiste faellt aus dem Transparenz-Schalter heraus
`page.tsx:216–224` setzt `backdrop-filter: blur(10px)` auf `.tk-filters`.
Der `prefers-reduced-transparency`-Block in `globals.css:946` kennt nur
`.topbar`, `.modal-backdrop` und `.celebrate-backdrop`. Ergebnis: wer im
System „Transparenz reduzieren“ aktiviert, bekommt auf `/my-tickets`
trotzdem zwei unscharfe Ebenen — die Filterleiste und den
Abzeichen-Overlay. §14 klarer Verstoss, und zwar einer, den das Projekt
anderswo schon geloest hat.

### C2 — Harte Trennlinie statt Scroll-Edge-Effekt
`.tk-filters` schliesst mit `border-bottom: 1px solid var(--line)`. §12 rät
ausdruecklich zum weichen Verlauf/Maskenrand dort, wo Inhalt unter
schwebende Chrome laeuft, statt zur 1px-Linie.

### C3 — Zwei uebereinanderliegende helle Transluzenz-Ebenen
`.topbar` (82 % `--surface`, blur 14px) klebt bei `top: 0`, `.tk-filters`
(88 % `--surface-2`, blur 10px) bei `top: 60px` direkt darunter. Beim
Scrollen stehen zwei helle durchscheinende Streifen aufeinander — §12
verbietet genau das („never stack a light translucent surface on another“).
Optisch geht es hier gut, weil sie sich nicht ueberlappen, aber die Kante
zwischen ihnen ist die duennste Stelle der Seite.

### C4 — Keine Vibrancy-Korrektur ueber den Farbflaechen
`.tk-motif-kicker` (opacity 0.82), `.tk-motif-k` (0.72), `.tk-motif-venue`
(0.86) stehen als weisse Schrift auf einem Verlauf, der bei gesetztem
Eventbild zusaetzlich ein Foto durchscheinen laesst. §12 Vibrancy verlangt
dort hoeheren Kontrast und etwas mehr Gewicht statt Opazitaetsabsenkung. Bei
`.tk-motif-k` sind es 9px Mono mit 0.16em auf einem Foto.

---

## D. Typografie (§15)

### D1 — Saemtliche Schriftgroessen stehen in px
Ueber 60 `font-size`-Angaben, alle in px (38, 22, 19, 18, 15, 13.5, 12.5,
11.5, 10, 9.5, 9, 8.5). `docs/apple-design-plan.md` hat fuer `/`,
`/sportvereine` und `/clubs` genau das auf `rem` umgestellt; `/my-tickets`
ist nie nachgezogen worden. Wer die Browser-Schriftgroesse hochstellt,
bekommt hier gar nichts. §15 „Respect the user's text-size setting“.

### D2 — Layout skaliert nicht mit der Schrift
Folge aus D1: alle Abstaende, Kartenhoehen (`height: 296`), Spaltenbreiten
(`372px`, `150px`, `146px`, `120px`) und die Stapelgeometrie
(`62px`-Kopf, `fanStep` 62–78, `cardW` 260–352) sind feste Pixel. Groessere
Schrift bricht die Karten, statt sie wachsen zu lassen.

### D3 — Sticky-Offsets in px gegen eine rem-Topbar
`.topbar-inner` ist `height: 3.75rem`. Dagegen stehen:
- `.tk-filters { top: 60px }` (`page.tsx:217`)
- `.tk-timeline-label { top: 120px }` (`:242`)
- `<div className="card tk-front" style={{ position: 'sticky', top: 76 }}>` (`:1400`)

Bei 16px Wurzelgroesse passt das exakt; bei 20px wandert die Topbar auf 75px
und die Filterleiste klebt 15px darunter fest, mit sichtbarem Spalt, durch den
der Inhalt laeuft.

### D4 — Breakpoints in px, obwohl globals.css em benutzt
`page.tsx`: `@media (min-width: 940px)`, `(max-width: 1080px)`,
`(max-width: 760px)`. `globals.css` nutzt `@media (max-width: 38.75em)`.
Der Design-Plan nennt em-Breakpoints als getroffene Entscheidung.

### D5 — Schriftgroessen unter der praktischen Untergrenze
`.tk-datechip .m` 8.5px · `.tk-motif-k` / `.tk-motif-vip` 9px ·
`.tk-motif-kicker` 9.5px · `.tk-fact-k` / `.tk-stub-notch`-Label 10px ·
`.tk-lane-label` / `.tk-stat-l` / `.bd-hint` 11px. Mit Tracking und
Grossbuchstaben ist das am unteren Rand des Lesbaren, teils auf Farbflaechen
(siehe C4) und teils in `--ink-4`.

### D6 — Tracking-Ausreisser
Grundsaetzlich richtig gestaffelt, drei Stellen fallen raus:
`.tk-motif-title` 18px mit `-0.025em` (so eng wie eine Display-Zeile),
`.bd-name` 19px mit nur `-0.01em` (zu lose fuer die Groesse), und
`.tk-title` faellt bei ≤760px von 38px auf 30px, behaelt aber `-0.035em`.
§15: Tracking ist groessenspezifisch, also muesste es beim Umbruch mitgehen.

---

## E. Reaktion & Rueckmeldung (§1, §10, §13, §16)

### E1 — Die Abzeichenkachel hat keinen Druckzustand
`.badge-tile.is-clickable` (`:379`) hat `cursor: pointer`,
`:focus-visible` und einen Hover (`translateY(-2px)` + Glanzstreifen), aber
**kein `:active`**. Auf dem Telefon gibt es keinen Hover — dort ist die
Kachel zwischen Tippen und Erscheinen des Dialogs voellig stumm. Das ist die
einzige anfassbare Flaeche der Seite ohne Druckrueckmeldung, und §1 nennt sie
als Fundament.

### E2 — Die Segment-Schalter geben nicht nach
`.seg button` in `globals.css` hat weder `:active` noch `transition`. Betrifft
beide Segmentleisten der Seite (Bevorstehend/Sammlung, Mosaik/Zeitstrahl).

### E3 — Trefferflaechen deutlich unter 44px
| Element | effektive Hoehe |
|---|---|
| `.tk-stub-action` (`:203`) — Teilen / Zurueckgeben / Vorzeigen | ~20px |
| `.seg button` | ~22px |
| `.close-btn` (globals) | 30px |
| `.btn.sm` | ~30px |

Der Design-Plan haelt 44px als bewusste px-Ausnahme fest („44px ist ein
Finger, keine Typografie“). Auf `/my-tickets` sind die drei Aktionen pro
Ticketstub die am haeufigsten benutzten Ziele und die kleinsten der Seite.
Dazu keine Hit-Padding-Hysterese (§10 empfiehlt ~10px Rand).

### E4 — Kleine Aktionsinseln in einer grossen Linkflaeche
`.tk-stub-link` liegt mit `position: absolute; inset: 0` ueber der ganzen
Karte (z-index 1), die Aktionen stehen mit z-index 2 darin. Ein danebenliegender
Daumen oeffnet also das Ticket, statt zu teilen. Ohne Trefferpolster ist das
ein Fehlbedien-Risiko genau bei „Zurueckgeben“ (Geldbewegung).

### E5 — Kein `touch-action`, kein `will-change`
Nirgends gesetzt. §11 empfiehlt `will-change` dort, wo Bewegung bevorsteht
(Stapelkarten), und `touch-action` waere Voraussetzung, sobald A1 angegangen
wird.

### E6 — Keine Haptik, kein Ton (§13)
Kein Aufruf der Vibration API. Die drei Momente, die §13 „Utility“ meint,
gibt es alle auf dieser Seite: Link kopiert, Abzeichen erscheint,
Rueckgabe bestaetigt. Optional, aber vollstaendig ungenutzt.

### E7 — Der Fehlerkanal sitzt am falschen Ende der Seite
`shareError` rendert als Banner ganz oben (`page.tsx:1273`), waehrend der
ausloesende Knopf im Ticketstub weit unten steht — bei mehreren Tickets
ausserhalb des Sichtfelds. §16 „Grouping & mapping“: Rueckmeldung gehoert
neben das, was sie betrifft.

Dazu ein Verdrahtungsfehler: `withdrawResale` schreibt seinen Fehler
ebenfalls nach `setShareError` (`page.tsx:937`). Ein fehlgeschlagenes
Zurueckholen erscheint dann unter dem Teilen-Banner.

---

## F. Dialoge, Agency, Wayfinding (§2, §16)

### F1 — Escape schliesst nur einen von drei Dialogen
Der Abzeichen-Dialog hat einen `keydown`-Listener (`page.tsx:727–733`).
Der Rueckgabe-Dialog und der Teilen-Dialog haben keinen. Beide sind
`.modal`/`.modal-backdrop` und schliessen nur per Klick auf den Hintergrund
oder den X-Knopf.

### F2 — Keine Fokusverwaltung in allen drei Dialogen
Kein Fokus-Trap, kein initialer Fokus, keine Rueckgabe des Fokus an das
ausloesende Element. Mit Tastatur laeuft man aus dem offenen Dialog heraus in
die Seite dahinter. §16 Wayfinding („Never trap the user“ meint das Gegenteil
davon, hier ist es der umgekehrte Fehler: gar keine Fuehrung).

### F3 — Die ganze Abzeichenkarte ist ein Schliessknopf
`page.tsx:1799` — `onClick={closeBadgeDetail}` auf `.badge-detail-card`
selbst, zusaetzlich zum Overlay. Der Text darin laesst sich nicht markieren,
und jeder Tippfehler schliesst. Der Hinweis „Zum Schliessen tippen“ macht es
vorhersagbar, aber es bleibt eine Flaeche ohne eigene Funktion.

### F4 — `aria-pressed` widerspricht der Beschriftung
`page.tsx:1307`: `aria-pressed={fan}` an einem Knopf, dessen Text die
**Aktion** nennt (`fan ? 'Stapeln' : 'Faechern'`). Ein Screenreader liest
„Stapeln, gedrueckt“, waehrend gefaechert ist. Entweder Beschriftung als
Zustand oder `aria-pressed` weglassen.

### F5 — Der Login-Dialog oeffnet sich ungefragt
`page.tsx:798–804` ruft `login()` im Effect, sobald `ready && !authenticated`.
§2 Agency: der Besucher landet in einem Dialog, den er nicht angefordert hat.
Die Fallback-Karte danach („Deine Tickets warten hier“) ist gut gemacht —
sie waere der bessere erste Zustand.

### F6 — `if (!ready) return null` zeigt eine weisse Seite
`page.tsx:1052`. Zwischen Navigation und aufgeloester Sitzung steht nichts.
Fuer die Daten gibt es ein sorgfaeltiges Skelett, fuer die Auth-Aufloesung
davor nicht. §1: jede Latenz auf dem Weg gehoert geprueft.

---

## G. Frame-Ebene & Performance (§11)

### G1 — Der Faecher animiert Layout-Eigenschaften
`.tk-wcard` (`page.tsx:37–41`) animiert `top` und `left`, `.tk-stackarea`
animiert `height`. §11 verlangt ausdruecklich nur `transform` und `opacity`.
Bei bis zu N Karten gleichzeitig ist das N-mal Layout + Paint pro Frame,
340 ms lang. `transform: translate()` waere hier eine reine
Compositor-Bewegung — die Positionen stehen ohnehin schon als berechnete
Zahlen im `pos`-Objekt.

Die Seite hat dieselbe Lektion anderswo bereits gelernt: der Design-Plan
haelt fest, dass die Tuerszene auf `/` von scroll-gebundenen Positionen
weggebaut wurde, weil sie „sichtbar stotterte“.

### G2 — Dauerlaufende Hintergrundanimationen
`cardAuroraDrift 8s linear infinite` (`:145`) verschiebt eine
`background-position` auf einem 320%-Verlauf — Repaint pro Frame, endlos, pro
Karte mit `border-style: aurora`. `cardNeonPulse 2.6s infinite` dazu.
§14 warnt zusaetzlich vor langsamen Endlosschleifen um 0.2 Hz; 8s sind
0.125 Hz und liegen damit in dem Band. Unter `prefers-reduced-motion`
korrekt abgeschaltet — der Normalfall bleibt.

### G3 — Box-Shadow-Transitions auf grossen Flaechen
`.tk-wcard` (box-shadow 0.2s), `.tk-stub` (0.18s), `.badge-tile` (0.2s),
`.tk-timeline-item` (0.15s). Schatten sind Paint, nicht Composite; auf der
Stapelkarte laeuft das zusammen mit G1.

---

## H. Reduced Motion — Luecken im sonst guten Block (§14)

Der Block `page.tsx:435–447` ist ausfuehrlich. Nicht erfasst sind:

| Nicht abgeschaltet | Stelle |
|---|---|
| `.tk-stub:has(.tk-stub-link:active)` — `transform: scale(0.985)` | `:118` |
| `a.card:active` — `scale(0.985)` | `:126` |
| `.tk-stub-action:active` — `scale(0.94)` | `:207` |
| `.tk-timeline-item:active` — `scale(0.985)` | `:250` |
| `.badge-tile:hover` — `translateY(-2px)` | globals |
| `.tk-filters` — `backdrop-filter` (gehoert zu §14 Transparenz, s. C1) | `:222` |

`globals.css:934` loest genau diesen Fall fuer `.btn` schon vorbildlich:
`transform: none; filter: brightness(0.94)` — „der Druck bleibt spuerbar, nur
nicht mehr als Bewegung“. Die vier Kartendruecke oben muessten dieselbe
Behandlung bekommen.

Ausserdem: `prefers-contrast: more` (`globals.css:55`) hebt nur die
Ink-/Line-Tokens. Die weisse Schrift auf den Motiv-Flaechen (C4) und die
Chips auf farbigem Grund bleiben unveraendert.

---

## I. Simplicity & Craft (§16)

### I1 — Zwei konkurrierende Darstellungen derselben Tickets
Oben stehen die bevorstehenden Tickets als Brieftaschen-Stapel, darunter
dieselben Tickets nochmal als Stub-Liste unter „Bevorstehend“. Der Hinweis
„Noch N weitere Tickets unten in der Liste“ (`:1396`) gibt zu, dass die
Beziehung erklaert werden muss. §16 Simplicity: jedes Element verdient seinen
Platz; hier zeigen zwei Bloecke dieselbe Menge in zwei Formen.

### I2 — Drei Ebenen fuer „meine Tickets“
Stapel → Tabs (Bevorstehend/Sammlung) → Layout-Schalter (Mosaik/Zeitstrahl),
dazu die Suche. Vier Bedienelemente in einer Leiste, bevor ein Ticket
sichtbar wird. §16: den haeufigen Weg zuerst, Fortgeschrittenes eine Ebene
tiefer.

### I3 — Die Fächer-Geometrie ist stellenweise nicht herleitbar
`page.tsx:1015–1019`:

```js
const stackHeight = fan
  ? Math.max(420, Math.round(46 + Math.pow((stackCount - 1) / 2, 2) * 7) + 296 + 20)
  : visibleStack.length < 2 ? 300 : 300 + (visibleStack.length - 2) * 48 + 296;
```

Die Konstanten 46, 7, 296, 20, 300, 48 stehen ohne Herleitung; 296 ist die
Kartenhoehe, der Rest ist Bogenparametrisierung. §16 Craft verlangt Werte,
die man verteidigen kann — hier braeuchte es benannte Konstanten.

### I4 — Der Zeitstrahl kennt keinen leeren Monat
`collectionMonths` baut Gruppen nur aus vorhandenen Tickets; Luecken zwischen
Monaten verschwinden. Fuer einen „Zeitstrahl“ ist die Luecke die Information.

### I5 — Suche ohne Treffermeldung
Es gibt Leerzustaende fuer „nichts gefunden“, aber keine Trefferzahl bei
Erfolg, und die Suche filtert nur den aktiven Tab — der Zaehler auf dem
inaktiven Tab bleibt auf der ungefilterten Gesamtzahl stehen.

---

## Rangfolge fuer eine spaetere Umsetzung

Wenn davon etwas gemacht wird, in dieser Reihenfolge — nach Wirkung pro
Aufwand:

1. **C1** Transparenz-Schalter auf `.tk-filters` + `.badge-detail-overlay`
   ziehen. Zwei Zeilen, behebt einen echten Systemeinstellungs-Verstoss.
2. **E1** Druckzustand auf `.badge-tile.is-clickable`. Eine Regel.
3. **F1** Escape fuer die beiden `.modal`-Dialoge. Besser gleich als Hook in
   `globals`/einer gemeinsamen Komponente, damit es nicht wieder auseinanderlaeuft.
4. **E7** Fehlerkanal trennen und ans Ereignis ruecken.
5. **H** Die vier Kartendruecke in den Reduced-Motion-Block, mit der
   `brightness`-Behandlung, die `.btn` schon hat.
6. **G1** Stapel auf `transform: translate()` umstellen. Mechanisch, die
   Zahlen liegen vor.
7. **B1/B2** Abzeichenkarte aus ihrer Kachel wachsen lassen, Weg spiegeln.
8. **D1–D4** Typo auf rem, Sticky-Offsets und Breakpoints mit; das ist die
   Nacharbeit dessen, was `docs/apple-design-plan.md` fuer die
   Landingpages schon entschieden hat.
9. **E3/E4** Trefferflaechen der Stub-Aktionen auf 44px.
10. **A1/A2** Der Faecher als echte direkte Manipulation mit Feder,
    Velocity-Uebergabe und Gummiband. Groesster Effekt, groesster Aufwand,
    und erst sinnvoll, wenn 6 erledigt ist.


---

## Was umgesetzt wurde (2026-09-11)

Umgesetzt sind A2–A6, B1–B3, B5, C1, C2, C4, D1, D3–D6, E1–E3, E5, E7, F1–F3,
F5, G1, H, I4, I5 sowie beide beim Lesen gefundenen Verdrahtungsfehler.

Kern der Aenderung ist `src/app/my-tickets/stackMotion.ts`: ein eigener
Feder-Integrator (Apples Parameterpaar Daempfung/Antwortzeit statt
Masse/Steifigkeit, kritisch gedaempft als Grundfeder, leichtes Nachfedern nur
nach einem Wisch) plus die Zeigergeste auf der vordersten Karte — 1:1-Tracking
mit Hysterese, Geschwindigkeit aus einer kurzen Historie, Apples
Projektionsformel fuer den Ruhepunkt, Gummiband am Ende des Stapels und
Uebergabe der Fingergeschwindigkeit an die Feder. Lage, Neigung und
Stapelordnung schreibt der Lauf direkt auf die Knoten, also nur noch ueber
`transform` (das ist G1); ein Ziehen loest kein Rendern aus.

**Beim Bauen gefunden und behoben** — der Fehler, der die ganze Mechanik
lahmlegte: die Aufraeumfunktion brach den angeforderten Frame ab, setzte
`raf.current` aber nicht zurueck. Weil `kick()` bei belegter Ref sofort
umkehrt, sprang der Lauf danach nie wieder an — unter React StrictMode (in der
Entwicklung laeuft jeder Effekt doppelt) also nach dem ersten Bild nie. Die
Karten sprangen dann nur noch beim Rendern auf ihre Ziele. Im Browser gemessen:
`raf.current` stand dauerhaft auf `2`, der Lauf protokollierte kein einziges
Bild.

Ebenfalls beim Pruefen gefunden, Bestandscode: `handleShare`, `withdrawResale`
und `submitResale` hatten `try/finally` ohne `catch`. Ein Netzfehler oder eine
Antwort, die kein JSON ist (die Route antwortet lokal mit 500 **und HTML**,
`res.json()` wirft also), endete in einer unbehandelten Ablehnung — der Knopf
hoerte auf zu laden und sonst passierte nichts. Ohne diesen Zweig waere E7 gar
nicht sichtbar geworden.

**Im Browser nachgemessen**, nicht nur nach Augenmass:

| Punkt | Messung |
|---|---|
| A1/G1 | Nach dem Wisch sitzt jede der fuenf Karten exakt auf ihrem Ziel (332/20/98/176/254), Stapelordnung korrekt |
| B1 | `transform-origin` der Abzeichenkarte loest absolut auf (226, 330) — punktgenau der Mittelpunkt der angeklickten Kachel |
| B3 | Blur des Abzeichen-Schleiers jetzt 16px, gleich `.modal-backdrop` |
| D1/D3 | Bei 20px Wurzelgroesse waechst die Topbar auf 75px und die klebende Filterleiste folgt auf exakt 75px (vorher fest 60px, also 15px Spalt); Titel 38→47.5px |
| E3 | `.tk-stub-action` 34px sichtbar, `::after` mit −5px Inset → 44px Trefferflaeche |
| E7 | Genau **eine** Meldung, im ausloesenden Stub (nicht mehr im Frontpanel zugleich, nicht mehr als Banner am Seitenkopf) |
| F1/F2 | Escape schliesst, der Fokus kehrt auf die ausloesende Abzeichenkachel zurueck |

### Bewusst nicht umgesetzt

- **A1 nur fuer die vorderste Karte.** Die Karten dahinter bleiben Tippziele
  („nach vorn holen"). Zwei gleichzeitige Wisch-Bedeutungen auf einem Stapel
  waeren nicht unterscheidbar.
- **D2 (Layout in rem).** Schriftgroessen, Sticky-Offsets und Breakpoints sind
  umgestellt; die **Pixelmasse der gezeichneten Ticketkarte** (296px hoch,
  Faechergeometrie) bleiben px. Das ist dieselbe Ausnahme, die
  `docs/apple-design-plan.md` fuer `DoorScene`, `ShowcaseMocks` und
  `HeroTicket` festhaelt: gezeichnete Produktattrappen auf fester Buehne. Die
  Stapelmathematik rechnet ausserdem in JS-Pixeln.
- **B4 (Hintergrundebene zuruecktreten lassen).** Trifft alle `.modal`-Flaechen
  der App, nicht nur diese Seite — gehoert in einen eigenen Durchgang ueber
  `globals.css`.
- **G2 (Dauerschleifen der Aurora-/Neon-Raender).** Das ist ein bezahltes
  Pro-Gestaltungsmerkmal des Veranstalters; unter `prefers-reduced-motion`
  steht es still. Abschalten waere eine Produktentscheidung, keine
  Designkorrektur.
- **I1/I2 (Stapel und Liste zeigen dieselben Tickets; vier Bedienelemente vor
  dem ersten Ticket).** Das sind Vorschlaege zur Informationsarchitektur, keine
  Abweichungen vom Skill — sie gehoeren entschieden, nicht nebenbei umgebaut.
- **E6 (Haptik).** Kein Aufruf der Vibration API ergaenzt; auf iOS-Safari
  wirkungslos, und §13 verlangt Sparsamkeit.

### Eine Verhaltensaenderung, die eine Entscheidung ist

**F5**: Der Anmeldedialog springt auf `/my-tickets` nicht mehr von selbst auf.
Wer abgemeldet ankommt, sieht die Karte „Deine Tickets warten hier" und
oeffnet ihn per Klick. Das ist §2 (Agency) und war so im Befund; es ist aber
ein Klick mehr auf dem Weg zu den eigenen Tickets. Wenn die Konversion an
dieser Stelle wichtiger ist als die Entscheidungsfreiheit, ist es der eine
Punkt hier, den man zurueckdrehen sollte.
