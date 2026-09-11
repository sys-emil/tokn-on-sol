'use client';

import { useLogout, useAuth, getAccessToken, useWallets as useSolanaWallets } from '@/lib/auth';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AccountMenu } from '@/app/components/AccountMenu';
import { Celebration } from '@/app/components/Celebration';
import { ProfileNudge } from '@/app/components/ProfileNudge';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { badgeDisplay, BADGE_META, type BadgeType } from '@/lib/badgeMeta';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SiteNav } from '@/app/components/SiteNav';
import { useDialogChrome } from '@/app/components/useDialogChrome';
import { useStackMotion, useReducedMotion, type CardTarget } from './stackMotion';

const PAGE_CSS = `
  /* ── Kopfbereich ─────────────────────────────────────────── */
  .tk-head {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 24px; padding: 26px 0 22px; flex-wrap: wrap;
  }
  .tk-title { font-size: 2.375rem; font-weight: 600; letter-spacing: -0.035em; line-height: 1.05; }
  .tk-subline { display: flex; align-items: center; gap: 14px; margin-top: 10px; flex-wrap: wrap; }
  .tk-subline .sep { width: 1px; height: 12px; background: var(--line-2); }

  /* ── Brieftaschen-Stapel ─────────────────────────────────── */
  .tk-lane { display: grid; grid-template-columns: minmax(0, 1fr) 372px; gap: 36px; align-items: start; }
  .tk-lane-label {
    font: 600 0.6875rem/1 var(--mono); letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--ink-3);
  }
  .tk-stackarea { position: relative; transition: height 0.34s cubic-bezier(0.2, 0.8, 0.2, 1); }
  /* Lage, Neigung und Stapelordnung schreibt stackMotion.ts direkt auf den
     Knoten — hier steht deshalb weder top/left noch eine Transition darauf.
     Beides zusammen war der Grund, warum sich der Faecher weder greifen noch
     umlenken liess und pro Bild und Karte einen Layout-Durchgang kostete.
     Der Druck reist als --press mit, damit er sich in die Transformation des
     Laufs einreihen kann, statt sie zu ersetzen. */
  .tk-wcard {
    position: absolute; top: 0; left: 0;
    display: flex; flex-direction: column; align-items: stretch;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 14px; overflow: hidden; text-align: left; padding: 0; cursor: grab;
    transform-origin: bottom center;
    transition: box-shadow 0.2s;
    /* Senkrecht scrollt die Seite, waagerecht gehoert die Geste der Karte. */
    touch-action: pan-y;
    will-change: transform;
    -webkit-user-select: none; user-select: none;
  }
  .tk-wcard:hover { box-shadow: 0 14px 40px rgba(17, 20, 45, 0.16); }
  .tk-wcard.is-front:active { cursor: grabbing; }
  .tk-wcard:active { --press: 0.965; }
  .tk-wcard-head {
    display: flex; align-items: center; gap: 11px; padding: 0 14px; height: 62px;
    flex: none; border-bottom: 1px solid var(--line); background: var(--surface);
  }
  .tk-datechip {
    width: 44px; flex: none; border: 1px solid var(--line);
    border-radius: 8px; overflow: hidden; text-align: center;
  }
  .tk-datechip .m {
    font-family: var(--mono); font-size: 0.5938rem; font-weight: 600; letter-spacing: 0.1em;
    background: var(--accent); color: #fff; padding: 3px 0;
  }
  .tk-datechip .d {
    font-size: 0.9375rem; font-weight: 600; padding: 2px 0 3px;
    letter-spacing: -0.02em; font-variant-numeric: tabular-nums;
  }
  .tk-wcard-title {
    font-size: 0.8438rem; font-weight: 600; letter-spacing: -0.015em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .tk-wcard-venue {
    font-size: 0.7188rem; color: var(--ink-3); white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; margin-top: 2px;
  }
  .tk-cover {
    height: 74px; flex: none; display: grid; place-items: center;
    background-size: cover; background-position: center;
  }
  .tk-cover span {
    font-family: var(--mono); font-size: 0.625rem; letter-spacing: 0.24em;
    color: rgba(255, 255, 255, 0.86); text-transform: uppercase;
    padding: 0 12px; text-align: center; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; max-width: 100%;
  }
  .tk-wcard-facts { padding: 12px 14px 0; display: flex; gap: 18px; }
  .tk-fact-k {
    font-size: 0.625rem; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--ink-4); font-weight: 600;
  }
  .tk-fact-v { font-size: 0.8125rem; font-weight: 600; font-variant-numeric: tabular-nums; margin-top: 2px; }
  .tk-perf { position: absolute; left: 0; right: 0; bottom: 52px; border-top: 1px dashed var(--line-2); }
  .tk-notch {
    position: absolute; width: 16px; height: 16px; border-radius: 50%;
    background: var(--surface-2); border: 1px solid var(--line); bottom: 44px;
  }
  .tk-wcard-foot {
    position: absolute; left: 0; right: 0; bottom: 0; height: 52px;
    display: flex; align-items: center; gap: 8px; padding: 0 14px; background: var(--surface);
  }

  /* ── Ticket-Stubs (Listen + Sammlung) ────────────────────── */
  .tk-stub {
    position: relative; display: flex; overflow: hidden;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 14px; box-shadow: var(--shadow); text-align: left;
    transition: box-shadow 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
  }
  .tk-stub:hover { box-shadow: var(--shadow-lg); border-color: var(--line-2); }
  .tk-stub.is-muted { opacity: 0.78; }

  /* ── Druckrueckmeldung ───────────────────────────────────────
     Zwischen Tippen und fertiger Ticketseite liegen zwei Netzaufrufe. Ohne
     eine Reaktion auf den Druck wirkt die Liste in dieser Zeit tot, und man
     tippt ein zweites Mal. Die Karte gibt deshalb sofort nach; das Skelett
     unter /tickets/[assetId] uebernimmt danach.
     :has() statt eines schlichten :active, damit nur der Ticket-Link die
     Karte drueckt — die Knoepfe darin (Teilen, Verkaufen) oeffnen nichts. */
  .tk-stub:has(.tk-stub-link:active) {
    transform: scale(0.985);
    box-shadow: var(--shadow-sm);
    transition-duration: 0.08s;
  }
  /* Saisonpass-Karten sind Links; nur die reagieren, nicht jede .card. */
  a.card { transition: transform 0.08s ease, box-shadow 0.15s ease; }
  a.card:active { transform: scale(0.985); box-shadow: var(--shadow-sm); }

  /* Rand-Presets des Veranstalters (Pro) + VIP; gleiche Rangfolge wie auf den
     Event-Karten: VIP > Rand-Preset > Akzentfarbe > Bild. */
  .tk-stub.border-gold, .tk-wcard.border-gold {
    border-color: oklch(0.80 0.10 92);
    box-shadow: 0 0 0 1px oklch(0.80 0.10 92 / 0.5), 0 4px 16px oklch(0.55 0.10 90 / 0.22), var(--shadow);
  }
  .tk-stub.border-chrome, .tk-wcard.border-chrome {
    border-color: oklch(0.82 0.006 275);
    box-shadow: 0 0 0 1px oklch(0.82 0.006 275 / 0.6), 0 4px 16px rgba(17,20,45,0.12), var(--shadow);
  }
  .tk-stub.border-aurora, .tk-wcard.border-aurora {
    border: 1.5px solid transparent;
    background:
      linear-gradient(var(--surface), var(--surface)) padding-box,
      linear-gradient(115deg,
        oklch(0.62 0.22 var(--hue)),
        oklch(0.74 0.18 calc(var(--hue) + 90)),
        oklch(0.66 0.20 calc(var(--hue) - 90)),
        oklch(0.62 0.22 var(--hue))) border-box;
    background-size: auto, 320% 320%;
    animation: cardAuroraDrift 8s linear infinite;
  }
  .tk-stub.border-neon, .tk-wcard.border-neon {
    border-color: oklch(0.60 0.24 var(--hue));
    animation: cardNeonPulse 2.6s ease-in-out infinite;
  }
  .tk-stub.vip, .tk-wcard.vip {
    border-color: oklch(0.80 0.10 92) !important;
    box-shadow: 0 0 0 1px oklch(0.80 0.10 92 / 0.5), 0 6px 18px oklch(0.55 0.10 90 / 0.24), var(--shadow) !important;
    animation: none !important;
  }
  .tk-stub.vip .tk-stubcol, .tk-wcard.vip .tk-wcard-head, .tk-wcard.vip .tk-wcard-foot {
    background: linear-gradient(150deg, oklch(0.99 0.015 95), oklch(0.965 0.045 92));
  }
  .tk-wcard.vip .tk-datechip .m {
    background: linear-gradient(110deg, oklch(0.62 0.11 88), oklch(0.78 0.12 92) 30%, oklch(0.92 0.09 95) 50%, oklch(0.78 0.12 92) 70%, oklch(0.62 0.11 88));
    color: oklch(0.28 0.06 85);
  }
  .tk-motif {
    flex: 1; min-width: 0; padding: 16px 18px; color: #fff;
    background-size: cover; background-position: center;
  }
  .tk-motif-kicker { font-family: var(--mono); font-size: 0.625rem; letter-spacing: 0.16em; opacity: 0.92; }
  .tk-motif-vip {
    font-family: var(--mono); font-size: 0.5625rem; letter-spacing: 0.14em;
    padding: 2px 7px; border-radius: 5px;
    background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.34);
  }
  .tk-motif-title {
    font-size: 1.125rem; font-weight: 600; letter-spacing: -0.015em;
    line-height: 1.2; margin-top: 22px; text-wrap: pretty;
  }
  .tk-motif-venue { font-size: 0.7812rem; opacity: 0.86; margin-top: 5px; }
  .tk-motif-facts { display: flex; gap: 20px; margin-top: 16px; flex-wrap: wrap; }
  .tk-motif-k { font-family: var(--mono); font-size: 0.625rem; letter-spacing: 0.12em; opacity: 0.9; font-weight: 500; }
  .tk-motif-v { font-size: 0.875rem; font-weight: 600; margin-top: 3px; font-variant-numeric: tabular-nums; }
  .tk-motif-count {
    display: inline-flex; align-items: center; gap: 6px; margin-top: 16px;
    font-size: 0.7188rem; font-weight: 500; padding: 3px 9px; border-radius: 6px;
    background: rgba(255, 255, 255, 0.16); border: 1px solid rgba(255, 255, 255, 0.3);
  }
  .tk-stubcol {
    width: 150px; flex: none; border-left: 2px dashed var(--line-2);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 7px; padding: 16px 12px; background: var(--surface);
  }
  .tk-stubcol.narrow { width: 146px; gap: 6px; }
  .tk-stub-notch {
    position: absolute; width: 18px; height: 18px; border-radius: 50%;
    background: var(--surface-2); transform: translateX(9px); pointer-events: none;
  }
  .tk-stub-link { position: absolute; inset: 0; z-index: 1; }
  .tk-stub-actions { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: stretch; gap: 8px; }
  /* Diese drei sind die meistbenutzten Ziele der Seite und waren mit ~20px die
     kleinsten. Sie liegen ausserdem als Inseln in der ganzflaechigen
     Ticket-Verlinkung (.tk-stub-link), ein danebengesetzter Daumen oeffnete
     also das Ticket statt zu teilen — bei „Zurueckgeben" bewegt das Geld.
     Sichtbar bleiben sie klein (die Karte hat keinen Platz fuer drei
     ausgewachsene Knoepfe); der Finger bekommt das Polster unsichtbar ueber
     ::after dazu, zusammen 44px. */
  .tk-stub-action {
    position: relative;
    display: inline-flex; align-items: center; justify-content: center; gap: 4px;
    font-size: 0.7188rem; font-weight: 500; color: var(--ink-3);
    border-radius: 6px; padding: 7px 10px; min-height: 34px;
  }
  .tk-stub-action::after { content: ""; position: absolute; inset: -5px; }
  .tk-stub-action:hover:not(:disabled) { color: var(--accent); background: var(--accent-wash); }
  .tk-stub-action { transition: transform 0.08s ease, color 0.15s ease, background 0.15s ease; }
  .tk-stub-action:active:not(:disabled) { transform: scale(0.94); }
  .tk-stub-action:disabled { opacity: 0.6; cursor: default; }
  .tk-action-error {
    font-size: 0.7188rem; line-height: 1.45; color: var(--bad);
    text-align: center; text-wrap: pretty;
  }
  .tk-qrbox {
    width: 60px; height: 60px; border: 1px solid var(--line);
    border-radius: 9px; display: grid; place-items: center; color: var(--ink-2);
  }
  /* Der Wechsel Bevorstehend/Sammlung tauschte den Inhalt hart aus. Ein kurzer
     Ueberblendweg stellt die Beziehung zwischen den beiden Ansichten her —
     bewusst nur ein paar Pixel Weg, es ist ein Wechsel und kein Ortswechsel. */
  .tk-panel { animation: tkPanelIn 0.26s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
  @keyframes tkPanelIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: none; }
  }
  .tk-groups-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .tk-group-head { display: flex; align-items: center; gap: 12px; margin-bottom: 13px; }
  .tk-group-head h2 { font-size: 0.9375rem; font-weight: 600; letter-spacing: -0.015em; }
  .tk-group-head .n { font-family: var(--mono); font-size: 0.6875rem; color: var(--ink-4); }
  .tk-group-head .rule { flex: 1; height: 1px; background: var(--line); }

  /* ── Sticky Filterleiste ─────────────────────────────────── */
  .tk-filters {
    position: sticky; top: var(--topbar-h); z-index: 20;
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 12px 0; margin-top: 22px;
    background: color-mix(in oklab, var(--surface-2) 88%, transparent);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  }
  /* Kein 1px-Strich unter der schwebenden Leiste, sondern ein kurzer Verlauf:
     der Inhalt laeuft darunter durch und loest sich auf, statt an einer Kante
     abgeschnitten zu werden (§12). */
  .tk-filters::after {
    content: ""; position: absolute; left: 0; right: 0; top: 100%; height: 14px;
    background: linear-gradient(var(--surface-2), transparent);
    pointer-events: none;
  }
  .tk-search-count {
    flex-basis: 100%; font-size: 0.75rem; color: var(--ink-3);
  }
  .tk-search { position: relative; margin-left: auto; width: 260px; max-width: 100%; }
  .tk-search .ic { position: absolute; left: 10px; top: 9px; color: var(--ink-4); pointer-events: none; }

  /* ── Sammlung ────────────────────────────────────────────── */
  .tk-stats { display: flex; gap: 22px; text-align: right; }
  .tk-stat-n { font-size: 1.5rem; font-weight: 600; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  .tk-stat-l { font-size: 0.6875rem; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.05em; }
  .tk-timeline-gap {
    display: grid; grid-template-columns: 120px 1fr; gap: 24px;
    font-size: 0.7188rem; color: var(--ink-4); font-style: italic;
    padding: 10px 0 10px 0;
  }
  .tk-timeline-gap::before { content: ""; }
  .tk-timeline-row {
    display: grid; grid-template-columns: 120px 1fr; gap: 24px;
    padding: 18px 0; border-top: 1px solid var(--line);
  }
  .tk-timeline-label {
    font-size: 0.8125rem; font-weight: 600; letter-spacing: -0.01em;
    position: sticky; top: calc(var(--topbar-h) + 3.5rem); height: max-content;
  }
  .tk-timeline-item {
    display: flex; align-items: center; gap: 12px; padding: 10px 14px;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 10px; box-shadow: var(--shadow-sm);
    transition: transform 0.08s ease, box-shadow 0.15s ease;
  }
  .tk-timeline-item:active { transform: scale(0.985); box-shadow: none; }

  /* Zwei Knoepfe nebeneinander. Ein .btn bricht nie um, also braucht das Paar
     zusammen gut 300px — mehr, als die Karte auf einem 360px-Geraet innen
     hergibt. Darunter stehen sie deshalb untereinander. Gemessen wird die
     Karte, nicht das Fenster: dieselbe Karte steht mobil ueber die volle
     Breite und am Rechner in der schmalen rechten Spalte. */
  .tk-front { container-type: inline-size; }
  .tk-actions-2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
  @container (max-width: 20em) { .tk-actions-2 { grid-template-columns: minmax(0, 1fr); } }

  /* ── Vorteile + Abzeichen ────────────────────────────────── */
  /* Mobil-zuerst eine Spalte. Nebeneinander lohnt sich erst, wenn beide
     Karten mindestens ~430px breit werden — darunter quetscht die
     Vorteilszeile Code und Knopf auf Briefmarkengroesse. */
  .tk-rewards {
    display: grid; grid-template-columns: minmax(0, 1fr);
    gap: 16px; margin-top: 30px; align-items: stretch;
  }
  @media (min-width: 58.75em) {
    .tk-rewards.is-split { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }
  }

  /* Die Vorteilszeile richtet sich nach der Breite ihrer Karte, nicht nach
     der des Fensters: dieselbe Karte steht mal ueber die volle Breite und
     mal in der schmalen linken Spalte. */
  .tk-perks-card { container-type: inline-size; }
  /* Festes Raster statt flex-wrap: umgebrochen ist der Code zwar unter den
     Text gerutscht, der senkrechte Trenner stand aber weiter daneben. Mit
     drei Spalten gibt es diesen halb umgebrochenen Zwischenzustand nicht. */
  .tk-perk {
    display: grid; grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center; gap: 14px; padding: 12px 14px;
    border: 1px solid var(--line); border-radius: 12px; background: var(--surface-2);
  }
  .tk-perk-action {
    text-align: right; padding-left: 14px;
    border-left: 1px dashed var(--line-2);
  }
  @container (max-width: 23.75em) {
    .tk-perk { grid-template-columns: auto minmax(0, 1fr); align-items: start; }
    /* Gestapelt gehoert der Trenner nach oben; links stehend zeigte er
       quer zur Leserichtung ins Leere. */
    .tk-perk-action {
      grid-column: 1 / -1; text-align: left;
      padding-left: 0; padding-top: 12px;
      border-left: none; border-top: 1px dashed var(--line-2);
    }
    .tk-perk-action .btn { width: 100%; }
  }
  .tk-perk-ic {
    width: 34px; height: 34px; flex: none; border-radius: 9px;
    background: var(--accent-wash); border: 1px solid var(--accent-line);
    color: var(--accent); display: grid; place-items: center;
  }
  .tk-perk-code {
    font-family: var(--mono); font-size: 0.9375rem; font-weight: 600;
    letter-spacing: 0.13em; color: var(--accent);
  }

  @media (max-width: 67.5em) {
    .tk-lane { grid-template-columns: minmax(0, 1fr); gap: 24px; }
    .tk-lane .tk-front { position: static !important; }
  }
  @media (max-width: 47.5em) {
    .tk-title { font-size: 1.875rem; letter-spacing: -0.028em; }
    .tk-groups-grid { grid-template-columns: 1fr; }
    .tk-search { margin-left: 0; width: 100%; }
    .tk-stats { gap: 16px; }
    .tk-timeline-row, .tk-timeline-gap { grid-template-columns: 1fr; gap: 10px; }
    .tk-timeline-gap::before { display: none; }
    .tk-timeline-label { position: static; }
    .tk-stubcol, .tk-stubcol.narrow { width: 118px; }
    .tk-stub-notch { display: none; }
    .tk-motif-title { font-size: 1rem; }
  }

  /* ── Frisch gekauftes Ticket: Entrance + Akzent-Halo ─────── */
  .is-fresh {
    animation: freshIn 0.6s cubic-bezier(0.18, 1.2, 0.3, 1) var(--fresh-delay, 0ms) both;
  }
  .is-fresh::after {
    content: "";
    position: absolute; inset: 0;
    border-radius: inherit;
    border: 2px solid var(--accent);
    box-shadow: inset 0 0 24px oklch(0.56 0.22 var(--hue) / 0.12), 0 0 24px oklch(0.56 0.22 var(--hue) / 0.35);
    opacity: 0;
    animation: freshHalo 2.8s ease-out calc(var(--fresh-delay, 0ms) + 250ms);
    pointer-events: none;
    z-index: 3;
  }
  @keyframes freshIn {
    from { opacity: 0; transform: scale(0.9) translateY(14px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes freshHalo {
    0% { opacity: 0; }
    12% { opacity: 1; }
    100% { opacity: 0; }
  }

  /* Frisch verdientes Abzeichen: Landung + pulsierender Medaillen-Glow
     (Basis-Medaillen-Styles sind global, auch /collection nutzt sie) */
  .badge-tile.is-new {
    animation: badgeLand 0.7s cubic-bezier(0.18, 1.4, 0.3, 1) var(--fresh-delay, 150ms) both;
  }
  .badge-tile.is-new .badge-medal {
    animation: medalGlow 1.5s ease-in-out calc(var(--fresh-delay, 150ms) + 350ms) 3;
  }
  @keyframes badgeLand {
    from { opacity: 0; transform: scale(0.55) translateY(18px) rotate(-4deg); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes medalGlow {
    0%, 100% {
      box-shadow:
        0 4px 12px oklch(0.52 0.20 var(--bh) / 0.38),
        inset 0 1px 2px rgba(255,255,255,0.5),
        inset 0 -3px 6px oklch(0.40 0.18 var(--bh) / 0.45);
    }
    50% {
      box-shadow:
        0 0 0 9px oklch(0.60 0.20 var(--bh) / 0.14),
        0 0 30px oklch(0.60 0.20 var(--bh) / 0.60),
        inset 0 1px 2px rgba(255,255,255,0.5),
        inset 0 -3px 6px oklch(0.40 0.18 var(--bh) / 0.45);
    }
  }

  /* ── Klickbare Abzeichen: Detailkarte zieht sich auf ─────── */
  .badge-tile.is-clickable { cursor: pointer; }
  .badge-tile.is-clickable:focus-visible {
    outline: 2px solid oklch(0.56 0.20 var(--bh)); outline-offset: 2px;
  }
  /* Die Kachel war die einzige anfassbare Flaeche der Seite ohne Antwort auf
     den Druck: am Telefon gibt es keinen Hover, dort lag zwischen Tippen und
     erscheinender Detailkarte nichts. Kuerzere Dauer als der Hover, damit die
     Kachel unter dem Finger liegt und ihm nicht hinterherlaeuft. */
  .badge-tile.is-clickable:active {
    transform: scale(0.965);
    transition-duration: 0.08s;
  }
  .badge-slot {
    text-align: center; color: var(--ink-4);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 18px 12px;
  }
  .badge-slot .ring {
    width: 48px; height: 48px; border-radius: 50%;
    border: 1px dashed var(--line-2); display: grid; place-items: center;
  }

  .badge-detail-overlay {
    position: fixed; inset: 0; z-index: 120;
    display: grid; place-items: center;
    padding: 20px;
    background: oklch(0.30 0.03 285 / 0.42);
    /* Gleiche Materialstaerke wie .modal-backdrop in globals.css. Vorher
       standen auf derselben Seite zwei Schleier mit 3px und 16px Blur; die
       Begruendung dort — eine bildschirmfuellende Flaeche liest sich dicker
       als ein 60px-Streifen — gilt hier genauso. */
    backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    animation: badgeOverlayIn 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .badge-detail-overlay.is-closing {
    animation: badgeOverlayOut 0.28s cubic-bezier(0.8, 0, 0.8, 0.2) both;
  }
  /* Blur und Deckkraft laufen zusammen: die Flaeche kommt als Material an,
     statt als fertige Scheibe eingeblendet zu werden (§12). */
  @keyframes badgeOverlayIn {
    from { opacity: 0; backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
    to   { opacity: 1; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
  }
  @keyframes badgeOverlayOut {
    from { opacity: 1; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
    to   { opacity: 0; backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
  }

  .badge-detail-card {
    --bh: 285;
    position: relative;
    width: min(360px, 100%);
    padding: 32px 26px 24px;
    text-align: center;
    border-radius: 22px;
    cursor: pointer;
    overflow: hidden;
    background:
      radial-gradient(200px 130px at 50% -10%, oklch(0.95 0.06 var(--bh)), transparent 72%),
      linear-gradient(180deg, oklch(0.99 0.008 var(--bh)), #fff);
    border: 1px solid oklch(0.88 0.06 var(--bh));
    box-shadow: 0 24px 64px oklch(0.45 0.18 var(--bh) / 0.30), inset 0 1px 0 #fff;
    /* Wachstumspunkt ist die angeklickte Kachel, nicht die Bildschirmmitte;
       die Werte setzt die Karte selbst, sobald sie ihre eigene Lage kennt. */
    transform-origin: var(--ox, 50%) var(--oy, 50%);
    /* Kritisch gedaempft statt federnd: dem Erscheinen ging ein Klick voraus,
       keine Geste mit Impuls — Ueberschwingen ist §4 vorbehalten, wo vorher
       wirklich geschwungen wurde. Der Ausgang spiegelt den Eingang exakt:
       dieselbe Dauer, dieselbe Skalierung, die umgekehrte Kurve
       (1−x2, 1−y2, 1−x1, 1−y1). */
    animation: badgeCardIn 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .badge-detail-overlay.is-closing .badge-detail-card {
    animation: badgeCardOut 0.28s cubic-bezier(0.8, 0, 0.8, 0.2) both;
  }
  @keyframes badgeCardIn {
    from { opacity: 0; transform: scale(0.28); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes badgeCardOut {
    from { opacity: 1; transform: none; }
    to   { opacity: 0; transform: scale(0.28); }
  }
  .badge-detail-card .badge-medal { width: 78px; height: 78px; font-size: 1.875rem; }
  .badge-detail-card .badge-medal::before { inset: -7px; }
  .bd-name { font-size: 1.1875rem; font-weight: 700; margin-top: 18px; letter-spacing: -0.02em; animation: bdRise 0.4s ease 0.14s both; }
  .bd-desc { font-size: 0.8438rem; line-height: 1.55; color: var(--ink-2); margin-top: 10px; animation: bdRise 0.4s ease 0.22s both; }
  .bd-meta { font-size: 0.75rem; color: var(--ink-3); margin-top: 16px; animation: bdRise 0.4s ease 0.30s both; }
  .bd-close {
    margin-top: 20px; min-height: 36px; padding: 8px 18px;
    font-size: 0.7812rem; font-weight: 600; color: var(--ink-2);
    border: 1px solid var(--line-2); border-radius: 9px; background: var(--surface);
    animation: bdRise 0.4s ease 0.38s both;
    transition: background 0.15s, color 0.15s, transform 0.08s ease;
  }
  .bd-close:hover { background: var(--surface-2); color: var(--ink); }
  .bd-close:active { transform: scale(0.96); }
  @keyframes bdRise { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }

  /* „Transparenz reduzieren" im System. globals.css loest das fuer .topbar,
     .modal-backdrop und .celebrate-backdrop; diese beiden Ebenen gehoeren
     derselben Familie an und waren dort nie eingetragen, blieben also als
     einzige unscharf. Gleiche Behandlung: der Blur faellt, die Deckung steigt
     zum Ausgleich. */
  @media (prefers-reduced-transparency: reduce) {
    .tk-filters {
      background: var(--surface-2);
      backdrop-filter: none; -webkit-backdrop-filter: none;
    }
    .badge-detail-overlay {
      background: oklch(0.30 0.03 285 / 0.58);
      backdrop-filter: none; -webkit-backdrop-filter: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    /* Der Druck bleibt spuerbar, nur nicht mehr als Bewegung — dieselbe
       Behandlung, die .btn in globals.css schon bekommt. Ohne sie waren die
       vier Kartenflaechen die einzigen, die hier weiter skalierten. */
    .tk-stub:has(.tk-stub-link:active),
    a.card:active,
    .tk-timeline-item:active,
    .badge-tile.is-clickable:active {
      transform: none; filter: brightness(0.96);
    }
    /* Die Stapelkarte traegt ihre Lage im transform; transform:none wuerde
       sie auf 0/0 werfen. Stillgelegt wird deshalb nur der Druckanteil. */
    .tk-wcard:active { --press: 1; filter: brightness(0.96); }
    .tk-stub-action:active:not(:disabled) { transform: none; filter: brightness(0.9); }
    .badge-tile:hover { transform: none; }
    .is-fresh, .is-fresh::after,
    .tk-stub.border-aurora, .tk-wcard.border-aurora,
    .tk-stub.border-neon, .tk-wcard.border-neon,
    .badge-tile.is-new, .badge-tile.is-new .badge-medal { animation: none; }
    .is-fresh::after { opacity: 0; }
    .tk-stackarea { transition: none; }
    .badge-tile::after { transition: none; }
    .tk-panel { animation: none; }
    .badge-detail-overlay, .badge-detail-overlay.is-closing,
    .badge-detail-card, .badge-detail-overlay.is-closing .badge-detail-card,
    .bd-name, .bd-desc, .bd-meta, .bd-close { animation: none; }
  }
`;

/** A season pass: one ticket, many dates, each burned at most once. */
interface PassView {
  assetId: string;
  passId: string;
  passName: string;
  purchasedAt: string;
  dates: {
    eventId: string;
    eventName: string;
    eventDate: string;
    startTime: string | null;
    venue: string | null;
    cancelled: boolean;
    redeemedAt: string | null;
  }[];
}

interface Ticket {
  assetId: string;
  eventName: string;
  eventDate: string;
  startTime: string | null;
  venue: string | null;
  purchasedAt: string;
  eventId: string;
  redeemedAt: string | null;
  claimUrl: string | null;
  imageUrl: string | null;
  accentHue: number | null;
  borderStyle: string | null;
  tierName: string | null;
  faceValueCents: number;
  returnEnabled: boolean;
  returnPreview: { paidCents: number; returnFeeCents: number; refundCents: number } | null;
  returnOffer: { id: string; paidCents: number; returnFeeCents: number; refundCents: number; status: string } | null;
}

const euro = (cents: number) => (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

interface BadgeItem {
  badgeType: string;
  assetId: string | null;
  earnedAt: string;
}

interface Progress {
  attendedCount: number;
  nextMilestone: { type: string; threshold: number } | null;
  topOrganizer: { name: string; attendedEvents: number; threshold: number } | null;
}

interface LoyaltyProgramView {
  programId: string;
  organizerName: string;
  /** Name der erreichten (oder angepeilten) Stufe, z. B. "Gold". */
  tierName?: string | null;
  benefitTitle: string;
  benefitDescription: string | null;
  threshold: number;
  attendedEvents: number;
  qualified: boolean;
  claim: { code: string; redeemedAt: string | null } | null;
}

/* Geometrie des Brieftaschen-Stapels. Diese Zahlen standen vorher roh in den
   Rechnungen und waren von aussen nicht herleitbar. */
/** Hoehe einer Ticketkarte. */
const CARD_H = 296;
/** Oberkante des Bogens, wenn gefaechert. */
const FAN_TOP = 46;
/** Wie stark der Bogen nach aussen durchhaengt (Faktor auf den quadratischen
 *  Abstand zur Mitte). */
const FAN_ARC = 7;
/** Sichtbare Kante einer Karte im eingeklappten Stapel. */
const COLLAPSED_EDGE = 48;

/** Dauer der Ein-/Ausgangsanimation der Abzeichenkarte; muss zu den
 *  `badgeCardIn`/`badgeCardOut`-Regeln in PAGE_CSS passen. */
const BADGE_CARD_MS = 280;

const MONTHS_FULL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const monthShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' }).replace('.', '');
const dayNum = (iso: string) => new Date(iso + 'T00:00:00').getDate();
const formatDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
const formatDateShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Ladezustand der Ticketuebersicht.
 *
 * Zeichnet die Brieftaschen-Bahn nach: links die vorderste Karte in ihren
 * echten Maszen (296px hoch), rechts die Detailspalte mit Countdown-Feld und
 * Knopfreihe. Vorher stand hier eine schmale Karte mit „Lade Tickets …", und
 * die Seite baute sich danach in voller Breite neu auf.
 */
function TicketsSkeleton() {
  return (
    <div className="tk-lane" aria-busy="true" aria-label="Tickets werden geladen">
      <div>
        <div className="tk-lane-label" style={{ marginBottom: 10 }}>Als nächstes</div>
        <div className="sk block" style={{ width: '100%', height: 296, borderRadius: 14 }} />
        {/* Angedeutete Kanten der Karten darunter, wie im eingeklappten Stapel. */}
        <div className="sk block" style={{ width: '96%', height: 34, borderRadius: 14, margin: '10px auto 0', opacity: 0.7 }} />
        <div className="sk block" style={{ width: '92%', height: 34, borderRadius: 14, margin: '8px auto 0', opacity: 0.45 }} />
      </div>

      <div className="card tk-front" style={{ padding: 22 }}>
        <div className="tk-lane-label">Dein nächstes Ticket</div>
        <div className="sk" style={{ width: '84%', height: 22, marginTop: 14 }} />
        <div style={{ display: 'grid', gap: 11, marginTop: 18 }}>
          {[188, 156, 172].map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div className="sk" style={{ width: 15, height: 15, flex: 'none' }} />
              <div className="sk" style={{ width: w, height: 11 }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, padding: '14px 16px', borderRadius: 12, background: 'var(--accent-wash)', border: '1px solid var(--accent-line)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-ink)', fontWeight: 500 }}>Türöffnung in</div>
          <div className="sk" style={{ width: 132, height: 30, marginTop: 4 }} />
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
          <div className="sk block" style={{ width: '100%', height: 46 }} />
          <div className="tk-actions-2">
            <div className="sk block" style={{ width: '100%', height: 38 }} />
            <div className="sk block" style={{ width: '100%', height: 38 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function daysUntil(iso: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(iso + 'T00:00:00').getTime() - today.getTime()) / 86400000);
}

function isUpcoming(iso: string): boolean { return daysUntil(iso) >= 0; }

function relativeDayLabel(iso: string): string {
  const n = daysUntil(iso);
  if (n <= 0) return 'Heute';
  if (n === 1) return 'Morgen';
  return `in ${n} Tagen`;
}

/** Startzeitpunkt als ms; ohne `start_time` gilt Mitternacht. */
function eventStartMs(t: Pick<Ticket, 'eventDate' | 'startTime'>): number {
  const time = t.startTime ? t.startTime.slice(0, 5) : '00:00';
  return new Date(`${t.eventDate}T${time}:00`).getTime();
}

/** Live-Countdown bis zum Einlass: Tage/Stunden, unter 24 h sekundengenau. */
function countdownLabel(targetMs: number, nowMs: number): string {
  const diff = targetMs - nowMs;
  if (diff <= 0) return 'Es geht los';
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  if (days >= 1) {
    const hours = Math.floor((totalMinutes % 1440) / 60);
    return `${days} ${days === 1 ? 'Tag' : 'Tage'} ${hours} Std`;
  }
  const secs = Math.floor(diff / 1000);
  const hh = String(Math.floor(secs / 3600)).padStart(2, '0');
  const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * Ticket-Code fürs Auge: stabil aus Eventname + Ticket-ID abgeleitet, damit
 * Gäste ihr Ticket am Einlass ansprechen können. Kein Sicherheitsmerkmal —
 * geprüft wird ausschließlich der signierte QR-Code.
 */
function ticketCode(eventName: string, assetId: string): string {
  const letters = (eventName.toUpperCase().match(/[A-Z]/g) ?? []).join('');
  const prefix = (letters.slice(0, 3) || 'PSY').padEnd(3, 'X');
  const suffix = (assetId.replace(/[^A-Za-z0-9]/g, '').slice(-4) || '0000').toUpperCase();
  return `${prefix}-${suffix}`;
}

/** Ort → Stadt: der letzte Teil hinter dem Komma („Zenith, München"). */
function cityOf(venue: string | null): string | null {
  if (!venue) return null;
  const parts = venue.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

/** Stabiler Farbton, wenn der Veranstalter keinen Akzent gesetzt hat. */
function hueOf(t: Ticket): number {
  if (t.accentHue != null) return t.accentHue;
  let h = 0;
  for (const ch of t.eventId || t.assetId) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return 250 + (h % 80); // 250–329: bleibt im violett/magenta-Korridor der Marke
}

/**
 * Großflächige Farbflächen zeigen das Eventbild, sobald der Veranstalter eins
 * hinterlegt hat; der Verlauf bleibt als Overlay drüber, damit die weiße
 * Schrift lesbar bleibt. Ohne Bild bleibt es der reine Verlauf.
 */
function motifStyle(t: Ticket, hue: number, muted: boolean): React.CSSProperties {
  const gradient = muted
    ? 'linear-gradient(150deg, oklch(0.68 0.03 275), oklch(0.48 0.025 275))'
    : `linear-gradient(150deg, oklch(0.62 0.19 ${hue + 8}), oklch(0.38 0.16 ${hue - 12}))`;
  if (t.imageUrl) {
    const veil = muted
      ? 'linear-gradient(150deg, oklch(0.34 0.02 275 / 0.86), oklch(0.22 0.02 275 / 0.80))'
      : `linear-gradient(150deg, oklch(0.36 0.14 ${hue + 8} / 0.84), oklch(0.20 0.10 ${hue - 12} / 0.80))`;
    return { backgroundImage: `${veil}, url("${t.imageUrl}")` };
  }
  return { backgroundImage: gradient };
}

function coverStyle(t: Ticket, hue: number): React.CSSProperties {
  const gradient = `linear-gradient(135deg, oklch(0.66 0.17 ${hue}), oklch(0.44 0.20 ${hue - 26}))`;
  if (t.imageUrl) {
    return {
      backgroundImage: `linear-gradient(135deg, oklch(0.40 0.13 ${hue} / 0.78), oklch(0.24 0.12 ${hue - 26} / 0.74)), url("${t.imageUrl}")`,
    };
  }
  return { backgroundImage: gradient };
}

const isVipTier = (t: Ticket) => /\bvip\b/i.test(t.tierName ?? '');

export default function MyTickets() {
  const router = useRouter();
  const { ready, authenticated, user, login } = useAuth();
  const { logout } = useLogout({ onSuccess: () => router.push('/') });
  const { wallets: solanaWallets } = useSolanaWallets();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [passes, setPasses] = useState<PassView[]>([]);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyProgramView[]>([]);
  const [claimingProgramId, setClaimingProgramId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [shareModal, setShareModal] = useState<{ assetId: string; url: string } | null>(null);
  // Die Rueckmeldung gehoert neben den Knopf, der sie ausgeloest hat, nicht in
  // ein Banner am Seitenkopf: bei mehreren Tickets stand das Banner ausserhalb
  // des Sichtfelds. Deshalb traegt der Fehler die Ticket-ID mit sich.
  // `at` unterscheidet die beiden Aktionsflaechen desselben Tickets: das
  // Frontpanel und der Stub in der Liste haben beide einen Teilen-Knopf, und
  // die Meldung gehoert nur an den, der gedrueckt wurde.
  const [actionError, setActionError] = useState<
    { assetId: string; at: 'front' | 'stub'; message: string } | null
  >(null);
  const [sharingAssetId, setSharingAssetId] = useState<string | null>(null);
  const [copyConfirmed, setCopyConfirmed] = useState(false);
  const [freshAssetIds, setFreshAssetIds] = useState<Set<string>>(new Set());
  const [newBadgeTypes, setNewBadgeTypes] = useState<Set<string>>(new Set());
  const [celebration, setCelebration] = useState<{ emoji: string; title: string; message: string } | null>(null);
  // `origin` ist der Bildschirmmittelpunkt der angeklickten Kachel. Die
  // Detailkarte waechst daraus hervor, statt aus der Bildschirmmitte: §7
  // verlangt, dass eine Flaeche dort entsteht, wo sie aufgerufen wurde.
  const [badgeDetail, setBadgeDetail] = useState<
    { type: string; earnedAt: string; origin: { x: number; y: number } } | null
  >(null);
  const [badgeClosing, setBadgeClosing] = useState(false);
  const [resaleModal, setResaleModal] = useState<Ticket | null>(null);
  const [resaleQuote, setResaleQuote] = useState<
    { paidCents: number; returnFeeCents: number; refundCents: number; backupIssued: boolean } | null
  >(null);
  const [resaleBusy, setResaleBusy] = useState(false);
  const [resaleError, setResaleError] = useState<string | null>(null);
  const [cancelBusyId, setCancelBusyId] = useState<string | null>(null);

  // Ansichtszustand der neuen Brieftaschen-Oberfläche
  const [tab, setTab] = useState<'upcoming' | 'collection'>('upcoming');
  const [collectionLayout, setCollectionLayout] = useState<'mosaik' | 'timeline'>('mosaik');
  const [query, setQuery] = useState('');
  const [fanned, setFanned] = useState(true);
  const [frontId, setFrontId] = useState<string | null>(null);
  const [stackWidth, setStackWidth] = useState(700);
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Der Fächer richtet sich nach der tatsächlichen Spaltenbreite; die Karte
  // erscheint erst nach dem Laden, deshalb ein Callback-Ref statt eines Effekts.
  const resizeObs = useRef<ResizeObserver | null>(null);
  const stackRef = useCallback((el: HTMLDivElement | null) => {
    resizeObs.current?.disconnect();
    resizeObs.current = null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w) setStackWidth((prev) => (Math.abs(w - prev) > 2 ? w : prev));
    });
    ro.observe(el);
    resizeObs.current = ro;
  }, []);

  /**
   * Schliessen laeuft ueber einen Timer, weil die Ausgangsanimation zu Ende
   * laufen soll. Der Timer haengt an einer Ref und wird bei jedem erneuten
   * Aufruf verworfen: vorher legte ein zweiter Klick waehrend des Schliessens
   * einen zweiten Timer an, waehrend der erste weiterlief. `openBadgeDetail`
   * bricht ein laufendes Schliessen ab, statt es abzuwarten — die Karte laesst
   * sich also mitten im Verschwinden wieder hervorholen.
   */
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeBadgeDetail = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setBadgeClosing(true);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setBadgeDetail(null);
      setBadgeClosing(false);
    }, BADGE_CARD_MS);
  }, []);

  const openBadgeDetail = useCallback((type: string, earnedAt: string, el: HTMLElement) => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    const r = el.getBoundingClientRect();
    setBadgeClosing(false);
    setBadgeDetail({ type, earnedAt, origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 } });
  }, []);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // Escape, Anfangsfokus und Tab-Kreis fuer alle drei Dialoge der Seite.
  // Vorher hatte nur die Abzeichenkarte einen eigenen Escape-Listener, und
  // keiner der drei fuehrte den Fokus.
  const badgeDialogRef = useDialogChrome(!!badgeDetail && !badgeClosing, closeBadgeDetail);
  const resaleDialogRef = useDialogChrome(!!resaleModal, () => { if (!resaleBusy) setResaleModal(null); });
  const shareDialogRef = useDialogChrome(!!shareModal, () => setShareModal(null));

  // Sekundentakt für den Einlass-Countdown
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Zwei verschiedene Dinge, die frueher eins waren: `signedIn` beantwortet
  // „darf ich laden?", `accountWallet` ist die Adresse, auf die Tickets
  // tatsaechlich lauten. Letztere wird serverseitig aus der Nutzer-ID
  // abgeleitet und ist nicht mehr die des Wallet-Anbieters.
  const signedIn = !!solanaWallets[0]?.address;
  const [accountWallet, setAccountWallet] = useState<string | undefined>(undefined);

  // Arrival celebration: the checkout success page drops the freshly minted
  // asset IDs into sessionStorage right before redirecting here.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('passly_new_tickets');
      if (!raw) return;
      sessionStorage.removeItem('passly_new_tickets');
      const ids = JSON.parse(raw) as string[];
      if (!Array.isArray(ids) || ids.length === 0) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot sessionStorage handoff, runs once on mount
      setFreshAssetIds(new Set(ids));
      setCelebration({
        emoji: '🎟️',
        title: 'Herzlichen Glückwunsch!',
        message: ids.length === 1
          ? 'Dein neues Ticket ist da, sicher in deinem Konto und bereit für einen unvergesslichen Abend.'
          : `Deine ${ids.length} neuen Tickets sind da, sicher in deinem Konto und bereit für einen unvergesslichen Abend.`,
      });
    } catch { /* private mode */ }
  }, []);

  // Badge celebration: compare the loaded badges against what this device has
  // already seen. First visit only seeds the store (no stale celebrations).
  useEffect(() => {
    if (!loaded || !accountWallet) return;
    const key = `passly_badges_seen:${accountWallet}`;
    try {
      const raw = localStorage.getItem(key);
      const current = badges.map((b) => b.badgeType);
      if (raw !== null) {
        const seen = new Set(JSON.parse(raw) as string[]);
        const fresh = current.filter((t) => !seen.has(t));
        if (fresh.length > 0) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- diff against localStorage is only known after the fetch
          setNewBadgeTypes(new Set(fresh));
          const meta = badgeDisplay(fresh[0]);
          setCelebration((prev) => prev ?? {
            emoji: '🏅',
            title: 'Neues Abzeichen!',
            message: fresh.length === 1
              ? `Herzlichen Glückwunsch, du hast dir „${meta.name}“ verdient. Ein echter Meilenstein für deine Sammlung.`
              : `Herzlichen Glückwunsch, du hast dir ${fresh.length} neue Abzeichen verdient. Echte Meilensteine für deine Sammlung.`,
          });
        }
      }
      localStorage.setItem(key, JSON.stringify(current));
    } catch { /* private mode */ }
  }, [loaded, accountWallet, badges]);

  // Der Anmeldedialog sprang frueher von selbst auf, sobald die Sitzung als
  // „nicht angemeldet" feststand. Das nimmt dem Besucher die Entscheidung ab,
  // bevor er die Seite ueberhaupt gesehen hat; stattdessen steht jetzt die
  // Karte unten („Deine Tickets warten hier") da und er oeffnet ihn selbst.

  useEffect(() => {
    if (!signedIn || loaded) return;
    async function load() {
      try {
        const authToken = await getAccessToken();
        const authHeaders = { Authorization: `Bearer ${authToken ?? ''}` };
        const [res, loyaltyRes, meRes] = await Promise.all([
          fetch('/api/my-tickets', { headers: authHeaders }),
          fetch('/api/loyalty/status', { headers: authHeaders }),
          fetch('/api/me', { headers: authHeaders }),
        ]);
        if (meRes.ok) {
          const me = (await meRes.json()) as { walletAddress: string };
          setAccountWallet(me.walletAddress);
        }
        if (res.ok) {
          const data = (await res.json()) as { tickets: Ticket[]; passes?: PassView[]; badges: BadgeItem[]; progress?: Progress };
          setTickets(data.tickets);
          setPasses(data.passes ?? []);
          setBadges(data.badges ?? []);
          setProgress(data.progress ?? null);
        }
        if (loyaltyRes.ok) {
          const data = (await loyaltyRes.json()) as { programs: LoyaltyProgramView[] };
          setLoyalty(data.programs ?? []);
        }
      } finally {
        setLoaded(true);
      }
    }
    void load();
  }, [signedIn, loaded]);

  async function handleShare(assetId: string, existingClaimUrl: string | null, at: 'front' | 'stub' = 'stub') {
    setActionError(null);
    if (existingClaimUrl) { setShareModal({ assetId, url: existingClaimUrl }); return; }
    setSharingAssetId(assetId);
    try {
      const authToken = await getAccessToken();
      const res = await fetch('/api/claims/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken ?? ''}` },
        body: JSON.stringify({ assetId }),
      });
      const data = (await res.json()) as { success: boolean; url?: string; error?: string };
      if (data.success && data.url) {
        setTickets((prev) => prev.map((t) => t.assetId === assetId ? { ...t, claimUrl: data.url! } : t));
        setShareModal({ assetId, url: data.url });
      } else if (data.error === 'not_delegated') {
        setActionError({ assetId, at, message: 'Dieses Ticket wurde gekauft, bevor Weitergabe unterstützt wurde, und kann nicht geteilt werden.' });
      } else {
        setActionError({ assetId, at, message: data.error ?? 'Der Link konnte nicht erstellt werden.' });
      }
    } catch {
      // Ohne diesen Zweig endete ein Netzfehler (oder eine Antwort, die kein
      // JSON ist) in einer unbehandelten Ablehnung: der Knopf hoerte auf zu
      // laden und sonst passierte nichts — der Gast steht vor einer Karte, die
      // seinen Druck quittiert und dann schweigt.
      setActionError({ assetId, at, message: 'Der Link konnte nicht erstellt werden. Bitte versuch es noch einmal.' });
    } finally {
      setSharingAssetId(null);
    }
  }

  // Das Angebot wird zweistufig bestaetigt: erst fragt die Seite den Server nach
  // dem exakten Betrag (nur die payouts-Zeile weiss, was wirklich gezahlt wurde),
  // dann bestaetigt der Verkaeufer. Ein geschaetzter Betrag im Dialog waere hier
  // besonders unschoen, weil er ueber echtes Geld entscheidet.
  async function openResale(t: Ticket) {
    setResaleError(null);
    setResaleQuote(null);
    setResaleModal(t);
    try {
      const authToken = await getAccessToken();
      const res = await fetch('/api/resale/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken ?? ''}` },
        body: JSON.stringify({ assetId: t.assetId }),
      });
      const data = (await res.json()) as {
        success: boolean; error?: string;
        paidCents?: number; returnFeeCents?: number; refundCents?: number; backupIssued?: boolean;
      };
      if (data.success && data.refundCents != null) {
        setResaleQuote({
          paidCents: data.paidCents ?? 0,
          returnFeeCents: data.returnFeeCents ?? 0,
          refundCents: data.refundCents,
          backupIssued: data.backupIssued === true,
        });
      } else {
        setResaleError(data.error ?? 'Die Rückgabe ist für dieses Ticket nicht möglich.');
      }
    } catch {
      setResaleError('Die Rückgabe konnte nicht geprüft werden.');
    }
  }

  async function submitResale() {
    if (!resaleModal || resaleBusy) return;
    setResaleBusy(true);
    setResaleError(null);
    try {
      const authToken = await getAccessToken();
      const res = await fetch('/api/resale/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken ?? ''}` },
        body: JSON.stringify({ assetId: resaleModal.assetId, confirm: true }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        setResaleModal(null);
        setLoaded(false); // neu laden, das Ticket wechselt in den Zustand "angeboten"
      } else {
        setResaleError(data.error ?? 'Die Rückgabe konnte nicht angelegt werden.');
      }
    } catch {
      setResaleError('Die Rückgabe konnte nicht angelegt werden. Bitte versuch es noch einmal.');
    } finally {
      setResaleBusy(false);
    }
  }

  /**
   * `assetId` nur fuer die Rueckmeldung: der Fehler erschien vorher unter dem
   * Teilen-Banner am Seitenkopf, weil diese Funktion in `setShareError`
   * schrieb — ein fehlgeschlagenes Zurueckholen las sich damit als
   * Teilen-Fehler an einem ganz anderen Ticket.
   */
  async function withdrawResale(offerId: string, assetId: string, at: 'front' | 'stub' = 'stub') {
    if (cancelBusyId) return;
    setCancelBusyId(offerId);
    setActionError(null);
    try {
      const authToken = await getAccessToken();
      const res = await fetch('/api/resale/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken ?? ''}` },
        body: JSON.stringify({ offerId }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        setLoaded(false);
      } else {
        setActionError({ assetId, at, message: data.error ?? 'Das Angebot konnte nicht zurückgezogen werden.' });
      }
    } catch {
      setActionError({ assetId, at, message: 'Das Angebot konnte nicht zurückgezogen werden. Bitte versuch es noch einmal.' });
    } finally {
      setCancelBusyId(null);
    }
  }

  async function handleClaimBenefit(programId: string) {
    if (!signedIn || claimingProgramId) return;
    setClaimingProgramId(programId);
    try {
      const authToken = await getAccessToken();
      const res = await fetch('/api/loyalty/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken ?? ''}` },
        body: JSON.stringify({ programId }),
      });
      const data = (await res.json()) as { success: boolean; code?: string; redeemedAt?: string | null };
      if (data.success && data.code) {
        setLoyalty((prev) => prev.map((p) =>
          p.programId === programId ? { ...p, claim: { code: data.code!, redeemedAt: data.redeemedAt ?? null } } : p,
        ));
      }
    } finally {
      setClaimingProgramId(null);
    }
  }

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopyConfirmed(true);
    setTimeout(() => setCopyConfirmed(false), 2000);
  }

  const upcoming = useMemo(
    () => tickets.filter((t) => isUpcoming(t.eventDate)).sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
    [tickets],
  );
  const past = useMemo(
    () => tickets.filter((t) => !isUpcoming(t.eventDate)).sort((a, b) => b.eventDate.localeCompare(a.eventDate)),
    [tickets],
  );

  const matches = useCallback((t: Ticket) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${t.eventName} ${t.venue ?? ''} ${t.tierName ?? ''} ${ticketCode(t.eventName, t.assetId)}`.toLowerCase().includes(q);
  }, [query]);

  const searching = query.trim().length > 0;
  const upcomingFiltered = useMemo(() => upcoming.filter(matches), [upcoming, matches]);
  const pastFiltered = useMemo(() => past.filter(matches), [past, matches]);

  // Brieftaschen-Stapel: das ausgewählte Ticket liegt vorn, der Rest nach Datum.
  const stackOrder = useMemo(() => {
    const front = upcoming.find((t) => t.assetId === frontId);
    if (!front) return upcoming;
    return [front, ...upcoming.filter((t) => t.assetId !== frontId)];
  }, [upcoming, frontId]);

  const stackGeometry = useMemo(() => {
    const n = stackOrder.length;
    const availW = Math.max(300, stackWidth);
    const gaps = Math.max(1, n - 1);
    // Gefächert wird nur, wenn von jeder Karte noch der volle 62px-Kopf sichtbar bleibt.
    const canFan = n > 1 && availW - 44 - gaps * 62 >= 260;
    const cardW = canFan
      ? Math.max(260, Math.min(352, availW - gaps * 62 - 44))
      : Math.max(260, Math.min(352, availW - 8));
    const fanStep = Math.max(62, Math.min(78, (availW - cardW - 44) / gaps));
    return { n, availW, gaps, canFan, cardW, fanStep, fan: fanned && canFan };
  }, [stackOrder.length, stackWidth, fanned]);

  const { canFan, cardW, fanStep, fan, n: stackCount } = stackGeometry;
  // Eingeklappt bleibt die Spalte in der Höhe des Info-Panels: Front + 3 Kanten.
  const visibleStack = fan ? stackOrder : stackOrder.slice(0, 4);
  const restCount = stackOrder.length - visibleStack.length;
  // Gefächert bestimmt der tiefste Bogenpunkt die Höhe (die Karten hängen nach
  // außen durch), eingeklappt die Kette aus Frontkarte + 48px-Kanten.
  const stackHeight = fan
    ? Math.max(420, Math.round(FAN_TOP + Math.pow((stackCount - 1) / 2, 2) * FAN_ARC) + CARD_H + 20)
    : visibleStack.length < 2
      ? CARD_H + 4
      : CARD_H + 4 + (visibleStack.length - 2) * COLLAPSED_EDGE + CARD_H;

  const frontTicket = stackOrder[0] ?? null;

  /**
   * Lage jeder sichtbaren Karte. Dieselbe Geometrie wie vorher, nur nicht mehr
   * als `top`/`left` im Stil, sondern als Zahlen fuer die Federn — die Karten
   * bewegen sich damit ueber `transform` und nicht mehr ueber das Layout.
   */
  const stackTargets = useMemo(() => {
    const out: Record<string, CardTarget> = {};
    const center = (stackCount - 1) / 2;
    visibleStack.forEach((t, i) => {
      const slot = fan ? (i === 0 ? stackCount - 1 : i - 1) : i;
      out[t.assetId] = fan
        ? {
            x: Math.round(20 + slot * fanStep),
            y: Math.round(FAN_TOP + Math.pow(slot - center, 2) * FAN_ARC + (i === 0 ? -14 : 0)),
            tilt: (slot - center) * (stackGeometry.availW < 660 ? 0 : 2.6),
            z: 10 + slot,
          }
        : {
            x: 0,
            y: i === 0 ? 0 : CARD_H + 4 + (i - 1) * COLLAPSED_EDGE,
            tilt: 0,
            z: i === 0 ? 5 : 10 + i,
          };
    });
    return out;
  }, [visibleStack, fan, fanStep, stackCount, stackGeometry.availW]);

  const reducedMotion = useReducedMotion();

  const stackMotion = useStackMotion({
    order: visibleStack.map((t) => t.assetId),
    targets: stackTargets,
    cardWidth: cardW,
    // Wegwischen setzt voraus, dass ueberhaupt etwas nachruecken kann.
    canAdvance: stackOrder.length > 1,
    onAdvance: () => {
      const next = stackOrder[1];
      if (next) setFrontId(next.assetId);
    },
    onTap: (assetId) => {
      const i = visibleStack.findIndex((t) => t.assetId === assetId);
      // Eingeklappt holt ein Tippen auf eine Kante das Ticket nach vorn;
      // gefaechert und auf der Frontkarte oeffnet es.
      if (!fan && i > 0) setFrontId(assetId);
      else router.push(`/tickets/${assetId}`);
    },
    reducedMotion,
  });

  // Gruppen der Bevorstehend-Liste: „Diese Woche" bzw. „Im <Monat>"
  const groups = useMemo(() => {
    const out: { label: string; items: Ticket[] }[] = [];
    for (const t of upcomingFiltered) {
      const label = daysUntil(t.eventDate) <= 7
        ? 'Diese Woche'
        : `Im ${MONTHS_FULL[new Date(t.eventDate + 'T00:00:00').getMonth()]}`;
      let g = out.find((x) => x.label === label);
      if (!g) { g = { label, items: [] }; out.push(g); }
      g.items.push(t);
    }
    return out;
  }, [upcomingFiltered]);

  /**
   * Monate der Sammlung, absteigend. `gapBefore` zaehlt die uebersprungenen
   * Monate seit dem vorherigen Eintrag: ein Zeitstrahl, der die Luecken
   * weglaesst, behauptet eine Dichte, die es nicht gab — und die Pause ist bei
   * einem Besuchsarchiv eine Aussage. Die leeren Monate werden gezaehlt und
   * nicht ausgeschrieben, sonst stehen zwischen zwei Jahren dreissig leere
   * Zeilen.
   */
  const collectionMonths = useMemo(() => {
    const out: { label: string; items: Ticket[]; key: number; gapBefore: number }[] = [];
    for (const t of pastFiltered) {
      const d = new Date(t.eventDate + 'T00:00:00');
      const key = d.getFullYear() * 12 + d.getMonth();
      let m = out.find((x) => x.key === key);
      if (!m) {
        m = { label: `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`, items: [], key, gapBefore: 0 };
        out.push(m);
      }
      m.items.push(t);
    }
    for (let i = 1; i < out.length; i++) out[i].gapBefore = out[i - 1].key - out[i].key - 1;
    return out;
  }, [pastFiltered]);

  const cityCount = useMemo(
    () => new Set(past.map((t) => cityOf(t.venue)).filter(Boolean)).size,
    [past],
  );

  if (!ready) return null;

  // Signed out and the login modal was dismissed: show an explicit sign-in
  // state instead of a blank page or a silent bounce to the landing page.
  if (!authenticated) {
    return (
      <div className="app">
        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <SiteNav active="tickets" />
          </div>
        </div>
        <div className="main">
          <div className="container" style={{ maxWidth: 480 }}>
            <div className="card" style={{ padding: 32, textAlign: 'center', marginTop: 48 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-wash)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', margin: '0 auto 14px', color: 'var(--accent)' }}>
                <Icon name="ticket" size={20} />
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.015em' }}>Deine Tickets warten hier.</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.6 }}>
                Melde dich mit deiner E-Mail-Adresse an. Ohne Passwort, ein Code genügt.
              </div>
              <button className="btn primary" style={{ marginTop: 18 }} onClick={() => login()}>
                Anmelden
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const email = user?.email ?? '';
  const loading = signedIn && !loaded;
  const isAllEmpty = loaded && tickets.length === 0 && badges.length === 0;

  /** VIP > Rand-Preset des Veranstalters; identische Rangfolge wie auf /events. */
  const decorClass = (t: Ticket) => isVipTier(t) ? ' vip' : t.borderStyle ? ` border-${t.borderStyle}` : '';

  /** Fehler der letzten Aktion — steht direkt unter dem ausloesenden Knopf. */
  const actionErrorFor = (assetId: string, at: 'front' | 'stub') =>
    actionError?.assetId === assetId && actionError.at === at
      ? <div className="tk-action-error" role="status">{actionError.message}</div>
      : null;

  /** Aktionen auf einem bevorstehenden Ticket (Teilen / Verkaufen / Zurückziehen). */
  const ticketActions = (t: Ticket) => {
    if (t.returnOffer) {
      // Verkauft, aber noch nicht erstattet: zurueckziehen geht nicht mehr.
      const sold = t.returnOffer.status === 'sold';
      return (
        <div className="tk-stub-actions">
          <span className="chip accent" style={{ whiteSpace: 'nowrap' }}>
            <span className="d" />{sold ? 'verkauft' : euro(t.returnOffer.refundCents)}
          </span>
          {!sold && (
            <button
              className="tk-stub-action"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); void withdrawResale(t.returnOffer!.id, t.assetId); }}
              disabled={cancelBusyId === t.returnOffer.id}
            >
              <Icon name="x" size={13} />{cancelBusyId === t.returnOffer.id ? '…' : 'Zurückholen'}
            </button>
          )}
          {actionErrorFor(t.assetId, 'stub')}
        </div>
      );
    }
    return (
      <div className="tk-stub-actions">
        <button
          className="tk-stub-action"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleShare(t.assetId, t.claimUrl); }}
          disabled={sharingAssetId === t.assetId}
        >
          <Icon name="share" size={13} />
          {sharingAssetId === t.assetId ? '…' : t.claimUrl ? 'Link kopieren' : 'Teilen'}
        </button>
        {t.returnEnabled && (
          <button
            className="tk-stub-action"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); void openResale(t); }}
          >
            <Icon name="euro" size={13} />Zurückgeben
          </button>
        )}
        <Link href={`/tickets/${t.assetId}`} className="tk-stub-action">
          <Icon name="qr" size={13} />Vorzeigen
        </Link>
        {actionErrorFor(t.assetId, 'stub')}
      </div>
    );
  };

  /** Ticket-Stub der Bevorstehend-Liste. */
  const upcomingStub = (t: Ticket) => {
    const hue = hueOf(t);
    const vip = isVipTier(t);
    const isFresh = freshAssetIds.has(t.assetId);
    const freshIndex = isFresh ? [...freshAssetIds].indexOf(t.assetId) : 0;
    const style: React.CSSProperties = { '--hue': hue } as React.CSSProperties;
    if (isFresh) (style as Record<string, string | number>)['--fresh-delay'] = `${freshIndex * 120}ms`;
    return (
      <div key={t.assetId} className={`tk-stub${decorClass(t)}${isFresh ? ' is-fresh' : ''}`} style={style}>
        <Link href={`/tickets/${t.assetId}`} className="tk-stub-link" aria-label={`Ticket öffnen: ${t.eventName}`} />
        <div className="tk-motif" style={motifStyle(t, hue, false)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="tk-motif-kicker">EINTRITTSKARTE · PASSLY</span>
            {vip && <span className="tk-motif-vip">VIP</span>}
          </div>
          <div className="tk-motif-title">{t.eventName}</div>
          <div className="tk-motif-venue">{t.venue ?? 'Ort wird bekannt gegeben'}</div>
          <div className="tk-motif-facts">
            <div>
              <div className="tk-motif-k">DATUM</div>
              <div className="tk-motif-v">{formatDateShort(t.eventDate)}</div>
            </div>
            {t.startTime && (
              <div>
                <div className="tk-motif-k">EINLASS</div>
                <div className="tk-motif-v">{t.startTime.slice(0, 5)}</div>
              </div>
            )}
            {t.tierName && (
              <div>
                <div className="tk-motif-k">PLATZ</div>
                <div className="tk-motif-v">{t.tierName}</div>
              </div>
            )}
          </div>
          <div className="tk-motif-count">
            <Icon name="clock" size={13} />{relativeDayLabel(t.eventDate)}
          </div>
        </div>
        <div className="tk-stubcol">
          <div className="tk-qrbox"><Icon name="qr" size={40} /></div>
          <div className="mono" style={{ fontSize: '0.6562rem', letterSpacing: '0.1em', color: 'var(--ink-3)' }}>
            {ticketCode(t.eventName, t.assetId)}
          </div>
          {ticketActions(t)}
        </div>
        <div className="tk-stub-notch" style={{ right: 150, top: -9 }} />
        <div className="tk-stub-notch" style={{ right: 150, bottom: -9 }} />
      </div>
    );
  };

  /** Abgerissener Stub der Sammlung. */
  const collectionStub = (t: Ticket) => {
    const hue = hueOf(t);
    const attended = !!t.redeemedAt;
    const d = new Date(t.eventDate + 'T00:00:00');
    return (
      <div key={t.assetId} className={`tk-stub${decorClass(t)}${attended ? '' : ' is-muted'}`} style={{ '--hue': hue } as React.CSSProperties}>
        <Link href={`/tickets/${t.assetId}`} className="tk-stub-link" aria-label={`Ticket öffnen: ${t.eventName}`} />
        <div className="tk-motif" style={motifStyle(t, hue, !attended)}>
          <div className="tk-motif-kicker">EINTRITTSKARTE · PASSLY</div>
          <div className="tk-motif-title">{t.eventName}</div>
          <div className="tk-motif-venue">{t.venue ?? '—'}</div>
          <div className="tk-motif-facts">
            <div>
              <div className="tk-motif-k">DATUM</div>
              <div className="tk-motif-v">{formatDateShort(t.eventDate)}</div>
            </div>
            {cityOf(t.venue) && (
              <div>
                <div className="tk-motif-k">STADT</div>
                <div className="tk-motif-v">{cityOf(t.venue)}</div>
              </div>
            )}
          </div>
        </div>
        <div className="tk-stubcol narrow">
          <div className="mono" style={{ fontSize: '0.625rem', letterSpacing: '0.14em', color: 'var(--ink-4)' }}>
            {monthShort(t.eventDate).toUpperCase()} {d.getFullYear()}
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.045em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {String(dayNum(t.eventDate)).padStart(2, '0')}
          </div>
          <span className={attended ? 'chip ok' : 'chip'} style={{ marginTop: 4, whiteSpace: 'nowrap' }}>
            <span className="d" />{attended ? 'Besucht' : 'Offen'}
          </span>
          {isVipTier(t) && <span className="chip accent">VIP</span>}
        </div>
        <div className="tk-stub-notch" style={{ right: 146, top: -9 }} />
        <div className="tk-stub-notch" style={{ right: 146, bottom: -9 }} />
      </div>
    );
  };

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="app">

        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <SiteNav active="tickets" />
            <div className="topbar-right">
              <Link href="/dashboard" className="btn subtle sm">Dashboard</Link>
              <AccountMenu email={email} walletAddress={accountWallet} onLogout={() => logout()} />
            </div>
          </div>
        </div>

        <div className="main">
          <div className="aurora" aria-hidden="true" />
          <div className="container" style={{ paddingTop: 28 }}>

            <div className="tk-head">
              <div>
                <h1 className="tk-title">Meine Tickets</h1>
                <div className="tk-subline">
                  {accountWallet && (
                    <Link href={`/collection/${accountWallet}`} style={{ fontSize: '0.8438rem', color: 'var(--accent)', fontWeight: 500 }}>
                      Öffentliches Profil ansehen →
                    </Link>
                  )}
                  {accountWallet && <span className="sep" />}
                  <span style={{ fontSize: '0.8438rem', color: 'var(--ink-3)' }}>
                    {upcoming.length} bevorstehend · {past.length} besucht · {badges.length} Abzeichen
                  </span>
                </div>
              </div>
              <Link href="/events" className="btn primary"><Icon name="search" size={15} /> Events entdecken</Link>
            </div>

            {loading && <TicketsSkeleton />}

            {!loading && isAllEmpty && (
              <div className="card">
                <div className="empty">
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-wash)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', color: 'var(--accent)' }}>
                    <Icon name="ticket" size={20} />
                  </div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)' }}>Dein erstes Ticket wartet hier.</div>
                  <div style={{ fontSize: '0.8125rem', marginTop: 4, marginBottom: 16 }}>Kauf ein Ticket, es landet automatisch in dieser Übersicht.</div>
                  <Link href="/events" className="btn primary">Events entdecken <Icon name="arrow" size={13} /></Link>
                </div>
              </div>
            )}

            {!loading && !isAllEmpty && (
              <>
                {/* ── Brieftasche + nächstes Ticket ─────────────── */}
                {frontTicket && (
                  <div className="tk-lane" style={{ marginBottom: 14 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
                        <div className="tk-lane-label">Als nächstes</div>
                        {canFan && (
                          <button
                            className="btn ghost sm"
                            style={{ borderColor: 'var(--accent-line)', background: 'var(--accent-wash)', color: 'var(--accent-ink)', fontWeight: 600 }}
                            onClick={() => setFanned((f) => !f)}
                            aria-pressed={fan}
                          >
                            <Icon name={fan ? 'chevronLeft' : 'chevronRight'} size={14} />
                            {fan ? 'Stapeln' : 'Fächern'}
                          </button>
                        )}
                      </div>
                      <div className="tk-stackarea" ref={stackRef} style={{ height: stackHeight }}>
                        {visibleStack.map((t, i) => {
                          const hue = hueOf(t);
                          const vip = isVipTier(t);
                          // Eingeklappt bringt ein Tippen auf eine Kante das Ticket
                          // nach vorn; gefächert (oder auf der Frontkarte) öffnet es.
                          const bringToFront = !fan && i > 0;
                          const isFront = i === 0;
                          return (
                            <button
                              key={t.assetId}
                              ref={(el) => stackMotion.setNode(t.assetId, el)}
                              className={`tk-wcard${decorClass(t)}${isFront ? ' is-front' : ''}`}
                              // Lage, Neigung und Stapelordnung schreibt der
                              // Bewegungslauf direkt auf den Knoten; hier steht
                              // nur noch, was sich beim Ziehen nicht aendert.
                              style={{
                                width: cardW,
                                height: CARD_H,
                                '--hue': hue,
                                boxShadow: fan || isFront ? 'var(--shadow-lg)' : '0 -6px 18px rgba(17,20,45,.07)',
                              } as React.CSSProperties}
                              onPointerDown={(e) => stackMotion.onPointerDown(e, t.assetId)}
                              onPointerMove={stackMotion.onPointerMove}
                              onPointerUp={stackMotion.onPointerUp}
                              onPointerCancel={stackMotion.onPointerUp}
                              // Die Zeigergeste erledigt das Tippen selbst (sie
                              // unterscheidet Tippen von Ziehen). onClick bleibt
                              // fuer Tastatur und Screenreader, wo es keinen
                              // Zeiger gibt — deshalb nur, wenn kein Zeiger im
                              // Spiel war.
                              onClick={(e) => {
                                if (e.detail !== 0) return;
                                if (bringToFront) setFrontId(t.assetId);
                                else router.push(`/tickets/${t.assetId}`);
                              }}
                              aria-label={bringToFront ? `${t.eventName} nach vorn holen` : `Ticket öffnen: ${t.eventName}`}
                            >
                              <div className="tk-wcard-head">
                                <div className="tk-datechip">
                                  <div className="m">{monthShort(t.eventDate).toUpperCase()}</div>
                                  <div className="d">{dayNum(t.eventDate)}</div>
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div className="tk-wcard-title">{t.eventName}</div>
                                  <div className="tk-wcard-venue">{t.venue ?? 'Ort wird bekannt gegeben'}</div>
                                </div>
                                {vip && <span className="chip accent" style={{ flex: 'none' }}>VIP</span>}
                              </div>
                              <div className="tk-cover" style={coverStyle(t, hue)}>
                                <span>{t.eventName}</span>
                              </div>
                              <div className="tk-wcard-facts">
                                <div>
                                  <div className="tk-fact-k">Einlass</div>
                                  <div className="tk-fact-v">{t.startTime ? t.startTime.slice(0, 5) : '—'}</div>
                                </div>
                                <div>
                                  <div className="tk-fact-k">Platz</div>
                                  <div className="tk-fact-v">{t.tierName ?? 'Standard'}</div>
                                </div>
                                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                                  <div className="tk-fact-k">Ticket</div>
                                  <div className="mono" style={{ fontSize: '0.75rem', marginTop: 3, color: 'var(--ink-2)' }}>
                                    {ticketCode(t.eventName, t.assetId)}
                                  </div>
                                </div>
                              </div>
                              <div className="tk-perf" />
                              <div className="tk-notch" style={{ left: -8 }} />
                              <div className="tk-notch" style={{ right: -8 }} />
                              <div className="tk-wcard-foot">
                                <span className="chip accent"><span className="d" />{relativeDayLabel(t.eventDate)}</span>
                                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.7812rem', fontWeight: 500, color: 'var(--accent)' }}>
                                  <Icon name="qr" size={15} />{bringToFront ? 'Nach vorn' : 'Vorzeigen'}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {restCount > 0 && (
                        <div style={{ marginTop: 12, fontSize: '0.7812rem', color: 'var(--ink-3)' }}>
                          {restCount === 1
                            ? 'Noch 1 weiteres Ticket unten in der Liste'
                            : `Noch ${restCount} weitere Tickets unten in der Liste`}
                        </div>
                      )}
                    </div>

                    <div className="card tk-front" style={{ padding: 22, position: 'sticky', top: 'calc(var(--topbar-h) + 1rem)' }}>
                      <div className="tk-lane-label">Dein nächstes Ticket</div>
                      <h2 style={{ fontSize: '1.375rem', fontWeight: 600, letterSpacing: '-0.028em', lineHeight: 1.2, marginTop: 12 }}>
                        {frontTicket.eventName}
                      </h2>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '0.8438rem', color: 'var(--ink-2)' }}>
                          <Icon name="calendar" size={15} />
                          <span>{formatDate(frontTicket.eventDate)}{frontTicket.startTime ? `, ${frontTicket.startTime.slice(0, 5)}` : ''}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '0.8438rem', color: 'var(--ink-2)' }}>
                          <Icon name="location" size={15} />
                          <span>{frontTicket.venue ?? 'Ort wird bekannt gegeben'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '0.8438rem', color: 'var(--ink-2)' }}>
                          <Icon name="ticket" size={15} />
                          <span>
                            {frontTicket.tierName ?? 'Standard'} · <span className="mono" style={{ fontSize: '0.7812rem' }}>{ticketCode(frontTicket.eventName, frontTicket.assetId)}</span>
                          </span>
                        </div>
                      </div>
                      <div style={{ marginTop: 18, padding: '14px 16px', borderRadius: 12, background: 'var(--accent-wash)', border: '1px solid var(--accent-line)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-ink)', fontWeight: 500 }}>Türöffnung in</div>
                        <div style={{ fontSize: '1.875rem', fontWeight: 600, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: 'var(--accent-ink)', marginTop: 2 }}>
                          {countdownLabel(eventStartMs(frontTicket), nowMs)}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
                        <Link href={`/tickets/${frontTicket.assetId}`} className="btn primary lg" style={{ justifyContent: 'center' }}>
                          <Icon name="qr" size={17} /> QR am Einlass vorzeigen
                        </Link>
                        <div className="tk-actions-2">
                          <button
                            className="btn ghost"
                            style={{ justifyContent: 'center' }}
                            onClick={() => void handleShare(frontTicket.assetId, frontTicket.claimUrl, 'front')}
                            disabled={sharingAssetId === frontTicket.assetId}
                          >
                            <Icon name="share" size={15} />
                            {sharingAssetId === frontTicket.assetId ? '…' : frontTicket.claimUrl ? 'Link' : 'Teilen'}
                          </button>
                          {frontTicket.returnOffer ? (
                            <button
                              className="btn ghost"
                              style={{ justifyContent: 'center' }}
                              onClick={() => void withdrawResale(frontTicket.returnOffer!.id, frontTicket.assetId, 'front')}
                              disabled={cancelBusyId === frontTicket.returnOffer.id || frontTicket.returnOffer.status === 'sold'}
                              title={frontTicket.returnOffer.status === 'sold' ? 'Bereits verkauft, die Erstattung ist unterwegs.' : undefined}
                            >
                              <Icon name="x" size={15} />
                              {cancelBusyId === frontTicket.returnOffer.id ? '…' : 'Zurückholen'}
                            </button>
                          ) : (
                            <button
                              className="btn ghost"
                              style={{ justifyContent: 'center' }}
                              onClick={() => void openResale(frontTicket)}
                              disabled={!frontTicket.returnEnabled}
                              title={!frontTicket.returnEnabled ? 'Der Veranstalter hat die Rückgabe für dieses Event nicht freigegeben.' : undefined}
                            >
                              <Icon name="euro" size={15} /> Zurückgeben
                            </button>
                          )}
                        </div>
                        {actionErrorFor(frontTicket.assetId, 'front')}
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)', color: 'var(--ink-3)' }}>
                        <Icon name="shield" size={15} />
                        <p style={{ fontSize: '0.7812rem', lineHeight: 1.55 }}>
                          Fälschungssicher: der QR-Code erneuert sich jede Minute. Auch offline gültig.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Vorteile + Abzeichen ──────────────────────── */}
                {(loyalty.length > 0 || badges.length > 0 || progress?.nextMilestone || progress?.topOrganizer) && (
                  <div className={`tk-rewards${loyalty.length > 0 && (badges.length > 0 || progress?.nextMilestone || progress?.topOrganizer) ? ' is-split' : ''}`}>
                    {loyalty.length > 0 && (
                      <div className="card tk-perks-card" style={{ padding: '18px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.015em' }}>Deine Vorteile</h2>
                          <span style={{ fontSize: '0.7812rem', color: 'var(--ink-3)' }}>Code am Einlass vorzeigen</span>
                        </div>
                        <div style={{ display: 'grid', gap: 10 }}>
                          {loyalty.map((p) => {
                            const remaining = Math.max(0, p.threshold - p.attendedEvents);
                            const pct = Math.min(100, Math.round((p.attendedEvents / p.threshold) * 100));
                            return (
                              <div key={p.programId} className="tk-perk">
                                <div className="tk-perk-ic"><Icon name="sparkle" size={17} /></div>
                                <div>
                                  <div style={{ fontSize: '0.8438rem', fontWeight: 600, letterSpacing: '-0.012em' }}>{p.benefitTitle}</div>
                                  <div style={{ fontSize: '0.7188rem', color: 'var(--ink-3)', marginTop: 2 }}>
                                    von {p.organizerName}
                                    {p.tierName ? ` · ${p.tierName}` : ''}
                                    {p.benefitDescription ? ` · ${p.benefitDescription}` : ''}
                                  </div>
                                  {!p.qualified && (
                                    <>
                                      <div style={{ fontSize: '0.7188rem', color: 'var(--ink-3)', marginTop: 8 }}>
                                        Noch {remaining} Event{remaining !== 1 ? 's' : ''} bis zu deinem Vorteil ({p.attendedEvents}/{p.threshold})
                                      </div>
                                      <div className="progress" style={{ marginTop: 6, maxWidth: 320 }}><span style={{ width: `${pct}%` }} /></div>
                                    </>
                                  )}
                                </div>
                                {p.qualified && (
                                  <div className="tk-perk-action">
                                    {p.claim ? (
                                      p.claim.redeemedAt ? (
                                        <span className="chip"><span className="d" />Eingelöst</span>
                                      ) : (
                                        <>
                                          <div className="tk-perk-code">{p.claim.code}</div>
                                          <div style={{ fontSize: '0.6875rem', color: 'var(--ink-3)', marginTop: 2 }}>Am Einlass vorzeigen</div>
                                        </>
                                      )
                                    ) : (
                                      <button
                                        className="btn primary sm"
                                        onClick={() => void handleClaimBenefit(p.programId)}
                                        disabled={claimingProgramId === p.programId}
                                      >
                                        {claimingProgramId === p.programId ? '…' : 'Vorteil abholen'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(badges.length > 0 || progress?.nextMilestone || progress?.topOrganizer) && (
                      <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.015em' }}>Abzeichen</h2>
                          <span style={{ fontSize: '0.7812rem', color: 'var(--ink-3)' }}>
                            {badges.length > 0 ? `${badges.length} verdient` : 'Dein erstes Abzeichen wartet'}
                          </span>
                        </div>
                        <div className="badges-row">
                          {badges.map((b, i) => {
                            const meta = badgeDisplay(b.badgeType);
                            const earned = new Date(b.earnedAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
                            const isNew = newBadgeTypes.has(b.badgeType);
                            return (
                              <div
                                key={b.badgeType}
                                role="button"
                                tabIndex={0}
                                aria-label={`${meta.name} – Details anzeigen`}
                                onClick={(e) => openBadgeDetail(b.badgeType, b.earnedAt, e.currentTarget)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openBadgeDetail(b.badgeType, b.earnedAt, e.currentTarget);
                                  }
                                }}
                                className={`badge-tile is-clickable${isNew ? ' is-new' : ''}`}
                                style={{ '--bh': meta.hue, ...(isNew ? { '--fresh-delay': `${150 + i * 100}ms` } : null) } as React.CSSProperties}
                              >
                                {isNew && <span className="badge-new-tag">Neu</span>}
                                <div className="badge-medal">{meta.symbol}</div>
                                <div className="badge-name">{meta.name}</div>
                                <div className="badge-date">{earned}</div>
                              </div>
                            );
                          })}
                          {progress?.nextMilestone && (() => {
                            const meta = badgeDisplay(progress.nextMilestone.type);
                            return (
                              <div className="badge-slot" title={`Nächstes Abzeichen: ${meta.name}`}>
                                <div className="ring"><Icon name="plus" size={16} /></div>
                                <div style={{ fontSize: '0.7188rem', marginTop: 8, color: 'var(--ink-3)', lineHeight: 1.25 }}>{meta.name}</div>
                              </div>
                            );
                          })()}
                        </div>
                        <div style={{ marginTop: 'auto', paddingTop: 16, display: 'grid', gap: 12 }}>
                          {progress?.nextMilestone && (() => {
                            const meta = badgeDisplay(progress.nextMilestone.type);
                            const remaining = progress.nextMilestone.threshold - progress.attendedCount;
                            const pct = Math.min(100, Math.round((progress.attendedCount / progress.nextMilestone.threshold) * 100));
                            return (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                                  <span style={{ fontSize: '0.7812rem', color: 'var(--ink-2)', fontWeight: 500 }}>
                                    Noch {remaining} Event{remaining !== 1 ? 's' : ''} bis „{meta.name}“
                                  </span>
                                  <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>
                                    {progress.attendedCount}/{progress.nextMilestone.threshold}
                                  </span>
                                </div>
                                <div className="progress" style={{ marginTop: 9 }}><span style={{ width: `${pct}%` }} /></div>
                              </div>
                            );
                          })()}
                          {progress?.topOrganizer && (() => {
                            const meta = badgeDisplay('loyal_organizer');
                            const remaining = progress.topOrganizer.threshold - progress.topOrganizer.attendedEvents;
                            const pct = Math.min(100, Math.round((progress.topOrganizer.attendedEvents / progress.topOrganizer.threshold) * 100));
                            return (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                                  <span style={{ fontSize: '0.7812rem', color: 'var(--ink-2)', fontWeight: 500 }}>
                                    Noch {remaining} Event{remaining !== 1 ? 's' : ''} bei {progress.topOrganizer.name} bis „{meta.name}“
                                  </span>
                                  <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>
                                    {progress.topOrganizer.attendedEvents}/{progress.topOrganizer.threshold}
                                  </span>
                                </div>
                                <div className="progress" style={{ marginTop: 9 }}><span style={{ width: `${pct}%` }} /></div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Saisonpässe ───────────────────────────────
                    Eigener Block: ein Pass hat kein einzelnes Datum und
                    passt deshalb weder in "Bevorstehend" noch in die
                    nach Monaten sortierte Sammlung. */}
                {passes.length > 0 && (
                  <div style={{ paddingTop: 26 }}>
                    <div className="tk-group-head">
                      <h2>Saisonpässe</h2>
                      <span className="n">{passes.length}</span>
                      <span className="rule" />
                    </div>
                    <div style={{ display: 'grid', gap: 12 }}>
                      {passes.map((p) => {
                        const open = p.dates.filter((d) => !d.cancelled && !d.redeemedAt);
                        const next = open[0] ?? null;
                        return (
                          <Link key={p.assetId} href={`/tickets/${p.assetId}`} className="card" style={{ display: 'grid', gap: 10, color: 'inherit' }}>
                            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-ink)' }}>
                                  Saisonpass
                                </div>
                                <div style={{ fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.015em', marginTop: 4 }}>{p.passName}</div>
                              </div>
                              {open.length > 0
                                ? <span className="chip ok" style={{ flexShrink: 0 }}><span className="d" />{open.length} offen</span>
                                : <span className="chip" style={{ flexShrink: 0 }}><span className="d" />Alle eingelöst</span>}
                            </div>
                            <div style={{ fontSize: '0.7812rem', color: 'var(--ink-3)', lineHeight: 1.55 }}>
                              {next
                                ? `Als Nächstes: ${next.eventName} · ${formatDate(next.eventDate)}${next.startTime ? `, ${next.startTime.slice(0, 5)}` : ''}`
                                : `${p.dates.length} ${p.dates.length === 1 ? 'Termin' : 'Termine'} · alle besucht`}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Filterleiste ──────────────────────────────── */}
                <div className="tk-filters">
                  <div className="seg">
                    {/* Gefiltert zeigen die Zaehler die Treffer, nicht mehr die
                        Gesamtzahl: sonst behauptet der inaktive Reiter Tickets,
                        die die Suche gerade ausgeschlossen hat. */}
                    <button className={tab === 'upcoming' ? 'active' : ''} onClick={() => setTab('upcoming')}>
                      Bevorstehend · {searching ? upcomingFiltered.length : upcoming.length}
                    </button>
                    <button className={tab === 'collection' ? 'active' : ''} onClick={() => setTab('collection')}>
                      Sammlung · {searching ? pastFiltered.length : past.length}
                    </button>
                  </div>
                  {tab === 'collection' && (
                    <div className="seg">
                      <button className={collectionLayout === 'mosaik' ? 'active' : ''} onClick={() => setCollectionLayout('mosaik')}>Mosaik</button>
                      <button className={collectionLayout === 'timeline' ? 'active' : ''} onClick={() => setCollectionLayout('timeline')}>Zeitstrahl</button>
                    </div>
                  )}
                  <div className="tk-search">
                    <span className="ic"><Icon name="search" size={15} /></span>
                    <input
                      className="input"
                      style={{ paddingLeft: 32 }}
                      aria-label="Tickets durchsuchen"
                      placeholder="Event, Ort oder Ticket-Code"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  {searching && (
                    <div className="tk-search-count" role="status">
                      {upcomingFiltered.length + pastFiltered.length === 1
                        ? '1 Treffer'
                        : `${upcomingFiltered.length + pastFiltered.length} Treffer`}
                      {' '}für „{query.trim()}“
                    </div>
                  )}
                </div>

                {/* ── Bevorstehend ──────────────────────────────── */}
                {tab === 'upcoming' && (
                  <div className="tk-panel" key="upcoming" style={{ paddingTop: 26 }}>
                    {groups.map((g) => (
                      <div key={g.label} style={{ marginBottom: 30 }}>
                        <div className="tk-group-head">
                          <h2>{g.label}</h2>
                          <span className="n">{g.items.length}</span>
                          <span className="rule" />
                        </div>
                        <div className="tk-groups-grid">
                          {g.items.map(upcomingStub)}
                        </div>
                      </div>
                    ))}
                    {groups.length === 0 && (
                      <div className="card">
                        <div className="empty">
                          {query.trim()
                            ? <>Keine Tickets für „{query}“. Probier einen anderen Suchbegriff.</>
                            : <>Keine bevorstehenden Tickets. <Link href="/events" style={{ color: 'var(--accent)', fontWeight: 500 }}>Events entdecken →</Link></>}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Sammlung ──────────────────────────────────── */}
                {tab === 'collection' && (
                  <div className="tk-panel" key="collection" style={{ paddingTop: 26 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, gap: 20, flexWrap: 'wrap' }}>
                      <div>
                        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.015em' }}>Deine Sammlung</h2>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--ink-3)', marginTop: 3 }}>
                          Abgerissene Stubs deiner besuchten Events — dein Archiv.
                        </p>
                      </div>
                      <div className="tk-stats">
                        <div><div className="tk-stat-n">{past.length}</div><div className="tk-stat-l">Events</div></div>
                        <div><div className="tk-stat-n">{cityCount}</div><div className="tk-stat-l">Städte</div></div>
                        <div><div className="tk-stat-n">{badges.length}</div><div className="tk-stat-l">Abzeichen</div></div>
                      </div>
                    </div>

                    {pastFiltered.length === 0 ? (
                      <div className="card">
                        <div className="empty">
                          {query.trim()
                            ? <>Nichts gefunden für „{query}“.</>
                            : <>Events, bei denen du warst, erscheinen hier als Erinnerung.</>}
                        </div>
                      </div>
                    ) : collectionLayout === 'mosaik' ? (
                      <div className="tk-groups-grid">
                        {pastFiltered.map(collectionStub)}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {collectionMonths.map((m) => (
                          <Fragment key={m.label}>
                          {m.gapBefore > 0 && (
                            <div className="tk-timeline-gap">
                              {m.gapBefore === 1 ? 'ein Monat ohne Event' : `${m.gapBefore} Monate ohne Event`}
                            </div>
                          )}
                          <div className="tk-timeline-row">
                            <div className="tk-timeline-label">
                              {m.label}
                              <div className="mono" style={{ fontSize: '0.6875rem', color: 'var(--ink-4)', marginTop: 3 }}>{m.items.length} Events</div>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                              {m.items.map((t) => (
                                <Link key={t.assetId} href={`/tickets/${t.assetId}`} className="tk-timeline-item">
                                  <div style={{ fontSize: '1.1875rem', fontWeight: 600, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: 'var(--ink-2)' }}>
                                    {String(dayNum(t.eventDate)).padStart(2, '0')}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '-0.01em' }}>{t.eventName}</div>
                                    <div style={{ fontSize: '0.7188rem', color: 'var(--ink-3)', marginTop: 1 }}>{t.venue ?? '—'}</div>
                                  </div>
                                  <span className={t.redeemedAt ? 'chip ok' : 'chip'} style={{ marginLeft: 6, whiteSpace: 'nowrap' }}>
                                    <span className="d" />{t.redeemedAt ? 'Dabei gewesen' : 'Nicht eingelöst'}
                                  </span>
                                </Link>
                              ))}
                            </div>
                          </div>
                          </Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <LegalLinks style={{ marginTop: 44, justifyContent: 'flex-start' }} />

          </div>
        </div>
      </div>

      {!celebration && <ProfileNudge walletAddress={accountWallet} />}

      {badgeDetail && (() => {
        const meta = badgeDisplay(badgeDetail.type);
        const full = BADGE_META[badgeDetail.type as BadgeType];
        const earned = new Date(badgeDetail.earnedAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
        return (
          <div
            ref={badgeDialogRef}
            tabIndex={-1}
            className={`badge-detail-overlay${badgeClosing ? ' is-closing' : ''}`}
            onClick={closeBadgeDetail}
            role="dialog"
            aria-modal="true"
            aria-label={`Abzeichen ${meta.name}`}
          >
            {/* Der Wachstumspunkt wird gesetzt, sobald die Karte im Dokument
                steht und ihre eigene Lage kennt — im Callback-Ref, also vor dem
                ersten Bild, sonst startet die Animation aus der Mitte und
                springt danach. */}
            <div
              className="badge-detail-card"
              ref={(el) => {
                if (!el || !badgeDetail) return;
                const r = el.getBoundingClientRect();
                el.style.setProperty('--ox', `${badgeDetail.origin.x - r.left}px`);
                el.style.setProperty('--oy', `${badgeDetail.origin.y - r.top}px`);
              }}
              style={{ '--bh': meta.hue } as React.CSSProperties}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="badge-medal">{meta.symbol}</div>
              <div className="bd-name">{meta.name}</div>
              <div className="bd-desc">{full?.description ?? 'Ein Abzeichen aus deiner Sammlung.'}</div>
              <div className="bd-meta">Verdient am {earned}</div>
              {/* Die Karte war frueher selbst ein Schliessknopf. Das machte
                  ihren Text unmarkierbar und jeden Fehlgriff zum Schliessen;
                  jetzt tut es die Flaeche daneben, und ein echter Knopf sagt
                  es auch der Tastatur. */}
              <button className="bd-close" onClick={closeBadgeDetail}>Schließen</button>
            </div>
          </div>
        );
      })()}

      {celebration && !loading && (
        <Celebration
          emoji={celebration.emoji}
          title={celebration.title}
          message={celebration.message}
          onClose={() => setCelebration(null)}
        />
      )}

      {resaleModal && (
        <div className="modal-backdrop" onClick={() => !resaleBusy && setResaleModal(null)}>
          <div
            className="modal"
            ref={resaleDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Ticket zurückgeben"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h3>Ticket zurückgeben</h3>
              <button className="close-btn" aria-label="Schließen" onClick={() => setResaleModal(null)} disabled={resaleBusy}><Icon name="x" size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.8125rem', color: 'var(--ink-3)', lineHeight: 1.55, marginBottom: 14 }}>
                <b style={{ color: 'var(--ink)' }}>{resaleModal.eventName}</b><br />
                Dein Platz geht zurück in den Verkauf. Sobald ihn jemand kauft, bekommst du dein
                Geld auf dem Weg zurück, auf dem du bezahlt hast.
              </p>

              {!resaleQuote && !resaleError && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--ink-3)' }}>Wird geprüft …</div>
              )}

              {resaleQuote && (
                <>
                  <div className="card" style={{ padding: '12px 14px', fontSize: '0.8125rem', display: 'grid', gap: 6 }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--ink-3)' }}>Du hast gezahlt</span><span>{euro(resaleQuote.paidCents)}</span>
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--ink-3)' }}>Rückgabegebühr</span><span>− {euro(resaleQuote.returnFeeCents)}</span>
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between', fontWeight: 600, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
                      <span>Du bekommst zurück</span>
                      <span style={{ color: 'var(--accent)' }}>{euro(resaleQuote.refundCents)}</span>
                    </div>
                  </div>

                  {/* Wer eine Offline-PDF gezogen hat, muss es VOR der Bestaetigung
                      erfahren: das Blatt liegt ausgedruckt irgendwo und wird wertlos. */}
                  {resaleQuote.backupIssued && (
                    <div
                      className="card"
                      style={{ padding: '12px 14px', marginTop: 12, fontSize: '0.7812rem', lineHeight: 1.55, display: 'flex', gap: 10, borderColor: 'var(--warn, var(--line))' }}
                    >
                      <Icon name="shield" size={15} />
                      <span>
                        Du hast für dieses Ticket ein Offline-Ticket erzeugt. Mit der Rückgabe
                        verliert es seine Gültigkeit — bitte vernichte den Ausdruck.
                      </span>
                    </div>
                  )}

                  <p style={{ fontSize: '0.7188rem', color: 'var(--ink-3)', lineHeight: 1.5, marginTop: 10 }}>
                    Solange dein Ticket angeboten ist, kannst du es nicht selbst nutzen. Du kannst
                    es jederzeit zurückholen, solange es niemand gekauft hat. Verkauft es sich bis
                    zum Eventtag nicht, bekommst du es automatisch zurück.
                  </p>
                </>
              )}

              {resaleError && (
                <div style={{ marginTop: 12, fontSize: '0.8125rem', color: 'var(--bad)', lineHeight: 1.5 }}>{resaleError}</div>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setResaleModal(null)} disabled={resaleBusy}>Abbrechen</button>
              <button className="btn primary" onClick={() => void submitResale()} disabled={!resaleQuote || resaleBusy}>
                {resaleBusy ? 'Wird angeboten …' : 'Zurückgeben'}
              </button>
            </div>
          </div>
        </div>
      )}

      {shareModal && (
        <div className="modal-backdrop" onClick={() => setShareModal(null)}>
          <div
            className="modal"
            ref={shareDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Ticket-Link teilen"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h3>Ticket-Link teilen</h3>
              <button className="close-btn" aria-label="Schließen" onClick={() => setShareModal(null)}><Icon name="x" size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.8125rem', color: 'var(--ink-3)', lineHeight: 1.55, marginBottom: 14 }}>
                Schicke diesen Link an eine Freundin oder einen Freund. Sobald er eingelöst wird, geht das Ticket über und der Link wird ungültig.
              </p>
              <div className="input mono" style={{ fontSize: '0.75rem', wordBreak: 'break-all', userSelect: 'all' }}>{shareModal.url}</div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShareModal(null)}>Schließen</button>
              <button className="btn primary" onClick={() => void handleCopy(shareModal.url)}>
                {copyConfirmed ? 'Kopiert!' : 'Link kopieren'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
