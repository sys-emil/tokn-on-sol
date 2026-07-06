# Passly — how to build with this design system

Passly is a German event-ticketing product (light theme, violet accent, Geist fonts). **All UI copy must be German, informal du-Form**, short and warm. Never use crypto/web3 wording (no NFT, Blockchain, Wallet, Solana) — the framing is "fälschungssicher"; say "Konto" and "Ticket".

## Setup

No provider or wrapper is required — components and classes work as soon as `styles.css` is loaded (it carries the tokens, the Geist/Geist Mono fonts and every component class). Page skeleton for app-style screens:

```jsx
<div className="app">
  <div className="topbar"><div className="topbar-inner">
    {/* logo */} <div className="nav"><a className="active">Events</a><a>Meine Tickets</a></div>
    <div className="topbar-right"><button className="btn primary sm">Loslegen</button></div>
  </div></div>
  <div className="main">
    <div className="aurora" aria-hidden="true" />
    <div className="container">
      <div className="hero">
        <div className="eyebrow"><span className="pulse" />Entdecken</div>
        <h1>Bevorstehende Events</h1>
        <p className="lead">Fälschungssichere Tickets — kaufen, teilen, vorzeigen.</p>
      </div>
      {/* sections */}
    </div>
  </div>
</div>
```

Mobile/focused screens (ticket, checkout, claim) instead center one card on:
`background: radial-gradient(1000px 500px at 50% -10%, var(--accent-wash), transparent 60%), var(--surface-2)`.

## Styling idiom: semantic CSS classes + oklch tokens

This is a plain-CSS class system (NOT Tailwind — never use utility-class soup). Compose with these classes and style your own glue with inline styles referencing the tokens.

| Family | Classes |
|---|---|
| Shell | `app`, `topbar`, `topbar-inner`, `nav` (+`active`), `topbar-right`, `avatar`, `main`, `container`, `aurora` |
| Hero | `hero`, `eyebrow` (+child `pulse`), `lead` |
| Buttons | `btn` + `primary` \| `ghost` \| `subtle`, sizes `sm` \| `lg` |
| Cards | `card`, `card-header`, `empty` |
| KPIs | `kpis` > `kpi` (children `label`, `value`, `delta` (+`neg`), `spark`) |
| Events | `events-grid` > `event-card` (children `date-chip` (`m`/`d`), `title`, `meta` (+`dot`), `sold`), `progress` (>`span` width %) |
| Chips | `chip` + `ok` \| `warn` \| `bad` \| `accent`, with dot child `<span className="d" />` |
| Tables | `ticket-table` (inside a `card`), cell `mono`, `row-qr` |
| Forms | `field` (>label), `input`, `textarea`, `select`, `field-row` |
| Overlays | `modal-backdrop` > `modal` (`modal-head`/`modal-body`/`modal-foot`, `close-btn`); drawers slide from the right: `drawer-backdrop` + `drawer` (`drawer-head`/`drawer-body`/`drawer-foot`) — forms open as drawers, not modals |
| Misc | `seg` (segmented control, buttons +`active`), `crumbs` (+`sep`), `section-head` (h2 + `sub`), utilities `row`, `stack`, `gap-2/3/4`, `mono`, `muted`, `hidden` |

Tokens (all oklch, accent hue via `--hue: 285`): ink scale `--ink`, `--ink-2..4`; surfaces `--surface`, `--surface-2` (page bg), `--surface-3`; lines `--line`, `--line-2`; accent `--accent`, `--accent-2` (hover), `--accent-ink`, `--accent-wash`, `--accent-line`; semantic `--ok/--ok-wash`, `--warn/--warn-wash`, `--bad/--bad-wash`; radii `--radius-sm/--radius/--radius-lg`; shadows `--shadow-sm/--shadow/--shadow-lg`; fonts `--font` (Geist), `--mono` (Geist Mono).

Patterns: status surfaces = wash background + matching border + 32–36px icon square (radius 8–10); numbers get `fontVariantNumeric: 'tabular-nums'`; muted text is `var(--ink-3)`; restraint with the accent — primary actions, status and brand moments only.

## Components on `window.Passly`

- `Icon` — 27 stroke icons: `plus calendar users ticket check doublecheck arrow download share x search dots qr scan clock euro mail location shield sparkle camera refresh chevronRight chevronLeft settings wifi bell`. Props: `name`, `size` (default 16), `strokeWidth`.
- `Spark` — minimal sparkline. Props: `data: number[]`, `color`, `width`, `height`. Lives in `.kpi > .spark` on dashboards.

## Where the truth lives

Read `styles.css` before styling anything — every class above is defined there verbatim. Per-component API: `components/general/Icon/Icon.d.ts`, `components/general/Spark/Spark.d.ts` and their `.prompt.md`.

## Idiomatic example

```jsx
const { Icon, Spark } = window.Passly;
<div className="card" style={{ padding: 22, display: 'flex', gap: 16 }}>
  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-wash)',
    border: '1px solid var(--accent-line)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
    <Icon name="shield" size={17} />
  </div>
  <div style={{ flex: 1 }}>
    <h3 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em' }}>Nicht kopierbar</h3>
    <p style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, marginTop: 4 }}>
      Der QR-Code erneuert sich jede Minute.
    </p>
    <span className="chip ok" style={{ marginTop: 10 }}><span className="d" />Gültig</span>
  </div>
</div>
```
