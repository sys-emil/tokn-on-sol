'use client';

import { useRef } from 'react';
import { TodayStamp } from '@/app/components/TodayStamp';

/**
 * Hero ticket mockup — 1:1 aus passly-hero.html übernommen.
 *
 * Client component, weil die Kippbewegung am Zeiger hängt: der Zeiger-Offset
 * zur Kartenmitte wird direkt auf rotateY/rotateX gelegt, beim Verlassen
 * federt die Karte in ihre Ruhelage zurück. Das Datum kommt weiterhin aus
 * <TodayStamp>, damit im Mockup nicht irgendwann ein Datum von gestern steht.
 */

const REST_TRANSFORM = 'rotateY(-8deg) rotateX(4deg) rotate(1.5deg)';

export function HeroTicket() {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(ev: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (ev.clientX - r.left) / r.width - 0.5;
    const dy = (ev.clientY - r.top) / r.height - 0.5;
    el.style.transition = 'transform 120ms cubic-bezier(.22,.61,.36,1)';
    el.style.transform =
      `rotateY(${-8 + dx * 22}deg) rotateX(${4 - dy * 18}deg) rotate(1.5deg) translateZ(14px)`;
  }

  function handleLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transition = 'transform 700ms cubic-bezier(.16,1,.3,1)';
    el.style.transform = REST_TRANSFORM;
  }

  return (
    <div className="hero-v2-mock" aria-hidden="true">
      <div
        ref={ref}
        className="hero-v2-ticket"
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{
          position: 'relative',
          flex: 'none',
          width: 352,
          borderRadius: 24,
          overflow: 'hidden',
          // Kein backdrop-filter: die Kinder decken die Flaeche vollstaendig ab,
          // der Blur war unsichtbar — kostete aber pro Shimmer-Frame ein
          // Neuberechnen des Hintergrunds und war die Ursache des Ruckelns.
          background: 'rgba(255,255,255,.72)',
          border: '1px solid rgba(255,255,255,.85)',
          boxShadow:
            '0 44px 90px -30px rgba(40,20,90,.45), 0 10px 26px rgba(17,20,45,.10), inset 0 1px 0 rgba(255,255,255,.9)',
          transform: REST_TRANSFORM,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', borderRadius: 24 }}>
          {/* Breite relativ zur Karte, sonst endet der Sweep bei fester px-Breite
              je nach Kartenbreite an einer anderen Stelle. top/bottom ziehen den
              Streifen über den Rand hinaus, damit die Schräge oben und unten
              nicht als Ecke sichtbar wird. */}
          <div
            className="hero-v2-shimmer"
            style={{
              position: 'absolute',
              top: '-20%',
              bottom: '-20%',
              left: 0,
              width: '22%',
              background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent)',
              transform: 'translateX(-140%) skewX(-18deg)',
              willChange: 'transform',
              animation: 'shimmerSweep 6s linear infinite',
            }}
          />
        </div>

        <div
          style={{
            padding: '22px 22px 26px',
            background: 'linear-gradient(150deg, oklch(0.34 0.16 288), oklch(0.26 0.12 300) 62%, oklch(0.30 0.14 260))',
            color: '#fff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                font: '500 10px var(--font)',
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,.62)',
              }}
            >
              Eintritt · 1 Person
            </span>
          </div>
          <div style={{ marginTop: 16, font: '600 21px/1.2 var(--font)', letterSpacing: '-0.03em' }}>
            Die beste Nacht des Jahres
          </div>
          <div style={{ marginTop: 7, font: '400 12.5px var(--font)', color: 'rgba(255,255,255,.66)' }}>
            <TodayStamp suffix=" · Einlass 20:00 · Halle 7" />
          </div>
        </div>

        <div style={{ position: 'relative', height: 22, background: '#fff' }}>
          <div style={{ position: 'absolute', left: -11, top: -11, width: 22, height: 22, borderRadius: '50%', background: 'oklch(0.90 0.06 300)' }} />
          <div style={{ position: 'absolute', right: -11, top: -11, width: 22, height: 22, borderRadius: '50%', background: 'oklch(0.90 0.06 300)' }} />
          <div style={{ position: 'absolute', left: 20, right: 20, top: 10, borderTop: '2px dashed var(--line-2)' }} />
        </div>

        <div style={{ background: '#fff', padding: '8px 24px 24px', display: 'grid', placeItems: 'center' }}>
          <div
            style={{
              width: 206,
              height: 206,
              borderRadius: 20,
              background: 'linear-gradient(180deg,var(--accent-wash),#fff)',
              border: '1px solid var(--accent-line)',
              boxShadow: 'inset 0 1px 0 #fff,0 2px 10px rgba(17,20,45,.06)',
              color: 'var(--accent)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <svg width="158" height="158" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3z" />
              <path d="M19 14h2" />
              <path d="M14 19h3" />
              <path d="M19 19v2" />
            </svg>
          </div>
          <div
            style={{
              marginTop: 14,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 14,
              borderTop: '1px solid var(--line)',
            }}
          >
            <div>
              <div style={{ font: '500 9.5px var(--font)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>Ticket</div>
              <div style={{ marginTop: 3, font: '500 12.5px var(--mono)', color: 'var(--ink)' }}>#PSL-K4X2</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ font: '500 9.5px var(--font)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>Block · Reihe · Platz</div>
              <div style={{ marginTop: 3, font: '500 12.5px var(--mono)', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>A · 12 · 08</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
