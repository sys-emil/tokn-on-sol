'use client';

import { useEffect, useState } from 'react';

function formatToday(): string {
  return new Date()
    .toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })
    .replace('.,', ',');
}

/**
 * Always-current date for the hero ticket mockup. The landing page is
 * statically prerendered, so a server-rendered date would freeze at build
 * time — this renders the build value first and corrects to "today" on
 * hydration (suppressHydrationWarning covers the swap).
 */
export function TodayStamp({ suffix }: { suffix?: string }) {
  const [label, setLabel] = useState(() => formatToday());
  useEffect(() => {
    // Deferred a tick: hydration first adopts the prerendered text, then the
    // stamp corrects itself to the visitor's current date.
    const timer = setTimeout(() => setLabel(formatToday()), 0);
    return () => clearTimeout(timer);
  }, []);
  return <span suppressHydrationWarning>{label}{suffix}</span>;
}
