'use client';

import { useLogout, usePrivy, getAccessToken } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AccountMenu } from '@/app/components/AccountMenu';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';

interface Profile {
  display_name: string | null;
  bio: string | null;
  is_private: boolean;
}

export default function AccountPage() {
  const router = useRouter();
  const { ready, authenticated, user, login } = usePrivy();
  const { logout } = useLogout({ onSuccess: () => router.push('/') });
  const { wallets: solanaWallets } = useSolanaWallets();
  const walletAddress = solanaWallets[0]?.address;

  const [loaded, setLoaded] = useState(false);
  const [hadProfile, setHadProfile] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (ready && !authenticated) login();
  }, [ready, authenticated, login]);

  useEffect(() => {
    if (!walletAddress || loaded) return;
    async function load() {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch(`/api/profile?walletAddress=${walletAddress}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = (await res.json()) as { profile: Profile | null };
          if (data.profile) {
            setHadProfile(true);
            setDisplayName(data.profile.display_name ?? '');
            setBio(data.profile.bio ?? '');
            setIsPrivate(data.profile.is_private);
          }
        }
      } finally {
        setLoaded(true);
      }
    }
    void load();
  }, [walletAddress, loaded]);

  async function handleSave() {
    if (!walletAddress || saving) return;
    setMessage(null);
    setSaving(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({ walletAddress, displayName, bio, isPrivate }),
      });
      const data = (await res.json()) as { success: boolean };
      if (data.success) {
        setHadProfile(true);
        setMessage({ ok: true, text: 'Gespeichert.' });
      } else {
        setMessage({ ok: false, text: 'Speichern fehlgeschlagen, bitte versuch es noch einmal.' });
      }
    } catch {
      setMessage({ ok: false, text: 'Speichern fehlgeschlagen, bitte versuch es noch einmal.' });
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return null;

  const email = user?.email?.address ?? '';

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-inner">
          <PasslyLogo height={24} />
          <div className="nav">
            <Link href="/events">Events</Link>
            <Link href="/my-tickets">Meine Tickets</Link>
          </div>
          <div className="topbar-right">
            <AccountMenu email={email} walletAddress={walletAddress} onLogout={() => logout()} />
          </div>
        </div>
      </div>

      <div className="main">
        <div className="container" style={{ maxWidth: 640 }}>

          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 28, letterSpacing: '-0.03em', fontWeight: 600, lineHeight: 1.1 }}>
              {hadProfile ? 'Konto & Profil' : 'Konto vervollständigen'}
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.6 }}>
              {hadProfile
                ? 'Dein Name und deine Einstellungen für das öffentliche Profil.'
                : 'Gib deinem Konto einen Namen, so erscheint dein öffentliches Profil nicht mehr als anonyme Kennung.'}
            </p>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <div className="field">
              <label>Anzeigename</label>
              <input
                className="input"
                value={displayName}
                maxLength={40}
                placeholder="z. B. Emil"
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <div className="hint">Wird auf deinem öffentlichen Profil angezeigt.</div>
            </div>
            <div className="field">
              <label>Über dich (optional)</label>
              <textarea
                className="textarea"
                value={bio}
                maxLength={240}
                placeholder="z. B. Immer vorne dabei, wenn’s laut wird."
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>E-Mail</label>
              <input className="input" value={email} disabled style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }} />
              <div className="hint">Deine Anmelde-Adresse, Tickets und Bestätigungen gehen hierhin.</div>
            </div>
          </div>

          <div className="card" style={{ padding: 24, marginTop: 16 }}>
            <div className="row gap-3" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Öffentliches Profil</div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.55 }}>
                  Deine Sammlung besuchter Events und deine Abzeichen, teilbar per Link.
                  Auf „privat“ gestellt ist die Seite für andere nicht mehr einsehbar.
                </div>
                {walletAddress && !isPrivate && (
                  <Link href={`/collection/${walletAddress}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--accent)', fontWeight: 500, marginTop: 10 }}>
                    Profil ansehen <Icon name="arrow" size={12} />
                  </Link>
                )}
              </div>
              <label className="row gap-2" style={{ fontSize: 13, alignItems: 'center', cursor: 'pointer', fontWeight: 500 }}>
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                Profil privat
              </label>
            </div>
          </div>

          <div className="row gap-3" style={{ marginTop: 20, alignItems: 'center' }}>
            <button className="btn primary lg" onClick={() => void handleSave()} disabled={saving || !walletAddress || !loaded}>
              {saving ? 'Speichern …' : 'Speichern'}
            </button>
            {message && (
              <span style={{ fontSize: 13, color: message.ok ? 'var(--ok)' : 'var(--bad)', fontWeight: 500 }}>
                {message.text}
              </span>
            )}
          </div>

          <LegalLinks style={{ marginTop: 56, justifyContent: 'flex-start' }} />
        </div>
      </div>
    </div>
  );
}
