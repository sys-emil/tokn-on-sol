'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
// Note: Globe renders only once the ResizeObserver has reported a width
// (size.w > 0), which happens client-side after mount — no extra mount guard
// needed, and dynamic(ssr:false) already keeps react-globe.gl off the server.
import dynamic from 'next/dynamic';
import { MeshBasicMaterial } from 'three';
import type { EventLocation } from '@/app/api/admin/overview/route';

// react-globe.gl touches `window` at import time → client-only, no SSR.
const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

const ACCENT = '#7c3aed'; // Passly violet (~oklch(0.54 0.22 285))

export function GlobeCard({ locations }: { locations: EventLocation[] }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<{ controls: () => { autoRotate: boolean; autoRotateSpeed: number } } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 420 });

  // Track container width so the globe stays responsive.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setSize((s) => (Math.abs(s.w - w) > 1 ? { ...s, w } : s));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // White globe body, no earth texture.
  const globeMaterial = useMemo(() => new MeshBasicMaterial({ color: '#f5f3fb' }), []);

  const maxEvents = useMemo(
    () => Math.max(1, ...locations.map((l) => l.eventCount)),
    [locations],
  );

  useEffect(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
  }, [size.w]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: '100%',
        height: size.h,
        overflow: 'hidden',
        borderRadius: 'var(--r-2, 16px)',
        background: 'radial-gradient(1200px 600px at 50% 0%, var(--accent-wash), transparent 70%), var(--surface-2, #faf9ff)',
      }}
    >
      {size.w > 0 && (
        <Globe
          ref={globeRef as never}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={globeMaterial}
          showGraticules
          showAtmosphere
          atmosphereColor={ACCENT}
          atmosphereAltitude={0.18}
          pointsData={locations}
          pointLat={(d: object) => (d as EventLocation).lat}
          pointLng={(d: object) => (d as EventLocation).lng}
          pointColor={() => ACCENT}
          pointAltitude={(d: object) =>
            0.02 + ((d as EventLocation).eventCount / maxEvents) * 0.22
          }
          pointRadius={(d: object) =>
            0.4 + Math.sqrt((d as EventLocation).ticketsSold) * 0.12
          }
          pointResolution={16}
          pointLabel={(d: object) => {
            const l = d as EventLocation;
            return `<div style="font-family:var(--font,sans-serif);font-size:12px;padding:2px 4px;color:#1a1626">
              <strong>${escapeHtml(l.label)}</strong><br/>
              ${l.eventCount} Event${l.eventCount !== 1 ? 's' : ''} · ${l.ticketsSold} Ticket${l.ticketsSold !== 1 ? 's' : ''}
            </div>`;
          }}
        />
      )}

      {locations.length === 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            fontSize: 13,
            color: 'var(--ink-4)',
            pointerEvents: 'none',
          }}
        >
          Noch keine verortbaren Events.
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}
