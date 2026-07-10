'use client';

import { useState } from 'react';
import { Icon } from '@/app/components/passlyUi';

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share(): Promise<void> {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // dismissed — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — nothing sensible left to do
    }
  }

  return (
    <button className="btn ghost sm" onClick={() => void share()}>
      <Icon name="share" size={13} /> {copied ? 'Link kopiert!' : 'Profil teilen'}
    </button>
  );
}
