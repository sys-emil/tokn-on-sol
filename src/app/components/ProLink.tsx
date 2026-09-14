'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MouseEvent, ReactNode } from 'react';
import { startProTransition } from './proTransition';

/**
 * Link in den Pro-Bereich mit dem dunklen Vorhang (siehe proTransition.ts).
 * Verhält sich sonst wie ein gewöhnlicher Link: Cmd/Ctrl-Klick, mittlere
 * Maustaste und Tastatur bleiben dem Browser überlassen.
 */
export function ProLink({ href = '/dashboard/analytics', className, children }: { href?: string; className?: string; children: ReactNode }) {
  const router = useRouter();

  function onClick(e: MouseEvent<HTMLAnchorElement>): void {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    // Tastatur-Aktivierung meldet (0, 0); dann vom Element aus statt von der Ecke.
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX || rect.left + rect.width / 2;
    const y = e.clientY || rect.top + rect.height / 2;
    router.prefetch(href);
    void startProTransition(x, y).then(() => router.push(href));
  }

  return <Link href={href} className={className} onClick={onClick}>{children}</Link>;
}
