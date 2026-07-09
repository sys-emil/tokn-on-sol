'use client';

import Link from 'next/link';
import { getAccessToken } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';

const SNOOZE_KEY = 'passly_profile_nudge_snoozed';

/**
 * One-time prompt after login for accounts that have no display name yet
 * (covers both brand-new sign-ups and existing accounts from before profiles
 * existed). Saves inline; "Später" snoozes per device.
 */
export function ProfileNudge({ walletAddress }: { walletAddress?: string }) {
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!walletAddress) return;
    try {
      if (localStorage.getItem(SNOOZE_KEY)) return;
    } catch { return; }
    let cancelled = false;
    async function check() {
      const token = await getAccessToken();
      if (!token || cancelled) return;
      const res = await fetch(`/api/profile?walletAddress=${walletAddress}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { profile: { display_name: string | null } | null };
      if (!cancelled && !data.profile?.display_name) setShow(true);
    }
    void check();
    return () => { cancelled = true; };
  }, [walletAddress]);

  function snooze() {
    try { localStorage.setItem(SNOOZE_KEY, '1'); } catch { /* private mode */ }
    setShow(false);
  }

  async function save() {
    if (!walletAddress || saving || !name.trim()) return;
    setSaving(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({ walletAddress, displayName: name }),
      });
      const data = (await res.json()) as { success: boolean };
      if (data.success) setShow(false);
    } finally {
      setSaving(false);
    }
  }

  if (!show) return null;

  return (
    <div className="modal-backdrop" onClick={snooze}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Wie dürfen wir dich nennen?</h3>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 14 }}>
            Gib deinem Konto einen Namen — er erscheint auf deinem öffentlichen Profil
            statt einer anonymen Kennung. Alles Weitere kannst du jederzeit unter{' '}
            <Link href="/account" style={{ color: 'var(--accent)', fontWeight: 500 }}>Konto &amp; Profil</Link> anpassen.
          </p>
          <input
            className="input"
            value={name}
            maxLength={40}
            placeholder="Dein Name"
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void save(); }}
          />
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={snooze}>Später</button>
          <button className="btn primary" onClick={() => void save()} disabled={saving || !name.trim()}>
            {saving ? 'Speichern …' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
