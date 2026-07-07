'use client';

import { useEffect } from 'react';

/*
 * Progressive scroll-reveal for server-rendered pages: drop <ScrollReveal />
 * once into a page and mark elements with data-reveal (optional stagger via
 * style={{ '--reveal-delay': '120ms' }}). CSS lives in globals.css.
 *
 * Elements already in the viewport animate on load; the rest animate the
 * first time they scroll into view. After the animation finishes the element
 * is returned to its natural state so card hover transitions keep working.
 */
export function ScrollReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (els.length === 0) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach((el) => el.classList.add('reveal-in', 'reveal-done'));
      return;
    }

    const onEnd = (e: Event) => {
      const el = e.currentTarget as HTMLElement;
      el.classList.add('reveal-done');
      el.removeEventListener('animationend', onEnd);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.addEventListener('animationend', onEnd);
          el.classList.add('reveal-in');
          io.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
