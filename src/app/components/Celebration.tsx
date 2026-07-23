'use client';

import Link from 'next/link';
import { useState } from 'react';

interface ConfettiPiece {
  cx: number;
  cy: number;
  cr: number;
  cd: number;
  color: string;
}

const CONFETTI_COLORS = [
  'oklch(0.56 0.22 285)',
  'oklch(0.66 0.18 330)',
  'oklch(0.70 0.15 235)',
  'oklch(0.80 0.14 95)',
  'oklch(0.64 0.17 150)',
  'oklch(0.72 0.16 60)',
];

function makeConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const distance = 120 + Math.random() * 130;
    return {
      cx: Math.round(Math.cos(angle) * distance),
      cy: Math.round(Math.sin(angle) * distance * 0.8) - 40,
      cr: Math.round((Math.random() - 0.5) * 720),
      cd: Math.round(Math.random() * 250),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    };
  });
}

/**
 * Full-screen congratulation overlay with a confetti burst, shown after a
 * ticket purchase, a newly earned badge, or the Pro upgrade.
 */
export function Celebration({
  emoji,
  title,
  message,
  actionLabel,
  actionHref,
  onClose,
}: {
  emoji: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  onClose: () => void;
}) {
  const [confetti] = useState(() => makeConfetti(22));

  return (
    <div className="celebrate-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="celebrate-card" onClick={(e) => e.stopPropagation()}>
        {confetti.map((c, i) => (
          <span
            key={i}
            className="confetti"
            style={{
              '--cx': `${c.cx}px`,
              '--cy': `${c.cy}px`,
              '--cr': `${c.cr}deg`,
              '--cd': `${c.cd}ms`,
              '--cc': c.color,
            } as React.CSSProperties}
          />
        ))}
        <span className="celebrate-emoji" aria-hidden="true">{emoji}</span>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="row gap-2" style={{ justifyContent: 'center', marginTop: 22, flexWrap: 'wrap' }}>
          {actionLabel && actionHref && (
            <Link href={actionHref} className="btn primary btn-shine" onClick={onClose}>
              {actionLabel}
            </Link>
          )}
          <button className={actionLabel ? 'btn ghost' : 'btn primary'} onClick={onClose}>
            {actionLabel ? 'Schließen' : 'Alles klar'}
          </button>
        </div>
      </div>
    </div>
  );
}
