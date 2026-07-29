'use client';

import { getAccessToken, useLogout, usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AccountMenu } from '@/app/components/AccountMenu';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon, VerifiedCheck } from '@/app/components/passlyUi';
import { validateHandle } from '@/lib/organizerHandle';

interface OrganizerLink { label: string; url: string }

interface Profile {
  handle: string | null;
  public_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  links: OrganizerLink[] | null;
  accent_hue: number | null;
  featured_event_id: string | null;
  is_verified: boolean;
  verified_label: string | null;
  plan: string;
  status: string;
  name: string;
  business_name: string | null;
  type: 'private' | 'business';
}

interface EventLite { id: string; name: string; date: string }

const ACCENT_SWATCHES: { hue: number | null; name: string }[] = [
  { hue: null, name: 'Violett (Standard)' },
  { hue: 345, name: 'Rose' },
  { hue: 45, name: 'Amber' },
  { hue: 150, name: 'Smaragd' },
  { hue: 195, name: 'Türkis' },
  { hue: 230, name: 'Blau' },
];

const PAGE_CSS = `
  .pf-banner {
    height: 150px; border-radius: 14px; overflow: hidden; position: relative;
    background: linear-gradient(120deg, oklch(0.72 0.13 var(--hue)), oklch(0.58 0.19 calc(var(--hue) + 35)));
    border: 1px solid var(--line);
  }
  .pf-banner img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pf-avatar {
    width: 88px; height: 88px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
    background: linear-gradient(135deg, oklch(0.82 0.08 var(--hue)), oklch(0.66 0.17 calc(var(--hue) + 40)));
    display: grid; place-items: center; color: white; font-size: 30px; font-weight: 600;
    border: 3px solid var(--surface); box-shadow: 0 6px 18px oklch(0.52 0.20 var(--hue) / 0.28);
  }
  .pf-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .pf-linkrow { display: grid; grid-template-columns: 1fr 2fr auto; gap: 8px; align-items: center; margin-bottom: 8px; }
  @media (max-width: 560px) { .pf-linkrow { grid-template-columns: 1fr; } }
`;

export default function OrganizerProfilePage() {
  const router = useRouter();
  const { ready, authenticated, user, login } = usePrivy();
  const { logout } = useLogout({ onSuccess: () => router.push('/') });
  const { wallets } = useSolanaWallets();
  const walletAddress = wallets[0]?.address;

  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<EventLite[]>([]);

  const [handle, setHandle] = useState('');
  const [publicName, setPublicName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [links, setLinks] = useState<OrganizerLink[]>([]);
  const [accentHue, setAccentHue] = useState<number | null>(null);
  const [featuredEventId, setFeaturedEventId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'avatar' | 'banner' | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const isPro = profile?.plan === 'pro';

  useEffect(() => {
    if (ready && !authenticated) login();
  }, [ready, authenticated, login]);

  useEffect(() => {
    if (!walletAddress || loaded) return;
    async function load() {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const [profRes, evRes] = await Promise.all([
          fetch(`/api/organizer/profile?walletAddress=${walletAddress}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/api/events/list?organizerWallet=${walletAddress}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (profRes.status === 403 || profRes.status === 404) {
          router.replace('/dashboard');
          return;
        }
        if (profRes.ok) {
          const data = (await profRes.json()) as { profile: Profile };
          const p = data.profile;
          setProfile(p);
          setHandle(p.handle ?? '');
          setPublicName(p.public_name ?? (p.type === 'business' && p.business_name ? p.business_name : p.name) ?? '');
          setBio(p.bio ?? '');
          setAvatarUrl(p.avatar_url);
          setBannerUrl(p.banner_url);
          setLinks(Array.isArray(p.links) ? p.links : []);
          setAccentHue(p.accent_hue);
          setFeaturedEventId(p.featured_event_id);
        }
        if (evRes.ok) {
          const ev = (await evRes.json()) as { events: EventLite[] };
          setEvents(ev.events ?? []);
        }
      } finally {
        setLoaded(true);
      }
    }
    void load();
  }, [walletAddress, loaded, router]);

  async function uploadImage(kind: 'avatar' | 'banner', file: File) {
    if (!walletAddress) return;
    setUploading(kind);
    setMessage(null);
    try {
      const token = await getAccessToken();
      const form = new FormData();
      form.append('organizer_wallet', walletAddress);
      form.append('kind', kind);
      form.append('file', file);
      const res = await fetch('/api/organizer/profile/upload-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
        body: form,
      });
      const data = (await res.json()) as { success: boolean; url?: string; error?: string };
      if (data.success && data.url) {
        if (kind === 'avatar') setAvatarUrl(data.url);
        else setBannerUrl(data.url);
      } else {
        setMessage({ ok: false, text: data.error ?? 'Upload fehlgeschlagen.' });
      }
    } catch {
      setMessage({ ok: false, text: 'Upload fehlgeschlagen.' });
    } finally {
      setUploading(null);
    }
  }

  const handleTrimmed = handle.trim();
  const handleValid = handleTrimmed === '' || validateHandle(handleTrimmed) !== null;

  async function handleSave() {
    if (!walletAddress || saving) return;
    if (!handleValid) {
      setMessage({ ok: false, text: 'Handle: 3–30 Zeichen, Kleinbuchstaben/Zahlen/Unterstrich, Beginn mit einem Buchstaben.' });
      return;
    }
    setMessage(null);
    setSaving(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/organizer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({
          walletAddress,
          handle: handleTrimmed || null,
          publicName,
          bio,
          avatarUrl,
          bannerUrl,
          links: links.filter((l) => l.label.trim() && l.url.trim()),
          accentHue,
          featuredEventId,
        }),
      });
      const data = (await res.json()) as { success: boolean; error?: string; profile?: Profile };
      if (data.success && data.profile) {
        setProfile(data.profile);
        setMessage({ ok: true, text: 'Gespeichert.' });
      } else if (data.error === 'handle_taken') {
        setMessage({ ok: false, text: 'Dieser Handle ist bereits vergeben.' });
      } else if (data.error === 'handle_invalid') {
        setMessage({ ok: false, text: 'Handle ungültig oder reserviert.' });
      } else {
        setMessage({ ok: false, text: 'Speichern fehlgeschlagen.' });
      }
    } catch {
      setMessage({ ok: false, text: 'Speichern fehlgeschlagen.' });
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return null;
  const email = user?.email?.address ?? '';
  const avatarInitials = (publicName || 'PA').slice(0, 2).toUpperCase();

  return (
    <div className="app" style={accentHue != null ? ({ '--hue': accentHue } as React.CSSProperties) : undefined}>
      <style>{PAGE_CSS}</style>
      <div className="topbar">
        <div className="topbar-inner">
          <PasslyLogo height={24} />
          <div className="nav">
            <Link href="/dashboard">Übersicht</Link>
            <Link href="/dashboard/passes">Saisonpässe</Link>
            <Link href="/dashboard/payouts">Auszahlungen</Link>
            <Link href="/dashboard/profile" className="active">Profil</Link>
            <Link href="/events">Events</Link>
          </div>
          <div className="topbar-right">
            <AccountMenu email={email} walletAddress={walletAddress} onLogout={() => logout()} />
          </div>
        </div>
      </div>

      <div className="main">
        <div className="container" style={{ maxWidth: 720 }}>
          <div style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: 28, letterSpacing: '-0.03em', fontWeight: 600, lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: 8 }}>
                Öffentliches Profil
                {profile?.is_verified && <VerifiedCheck size={20} title={profile.verified_label ?? 'Verifiziert'} />}
              </h1>
              <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.6 }}>
                So sehen dich Gäste auf deiner Veranstalter-Seite.
              </p>
            </div>
            {handleTrimmed && handleValid && (
              <Link href={`/@${handleTrimmed}`} target="_blank" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>
                Profil ansehen <Icon name="arrow" size={12} />
              </Link>
            )}
          </div>

          {profile?.is_verified && profile.verified_label && (
            <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--accent-wash)', borderColor: 'var(--accent-line)' }}>
              <VerifiedCheck size={18} />
              <span style={{ fontSize: 13, color: 'var(--accent-ink)', fontWeight: 500 }}>
                Verifiziert von Passly · „{profile.verified_label}“
              </span>
            </div>
          )}

          {/* Banner + avatar */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            <div className="pf-banner">
              {bannerUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL
                <img src={bannerUrl} alt="" />
              )}
              <button
                className="btn ghost sm"
                onClick={() => bannerInput.current?.click()}
                disabled={uploading !== null}
                style={{ position: 'absolute', right: 12, bottom: 12, background: 'var(--surface)' }}
              >
                <Icon name="camera" size={13} /> {uploading === 'banner' ? 'Lädt …' : 'Banner'}
              </button>
              <input ref={bannerInput} type="file" accept="image/jpeg,image/png,image/webp" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage('banner', f); e.target.value = ''; }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px' }}>
              <div className="pf-avatar" style={{ marginTop: -44, zIndex: 2 }}>
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL
                  <img src={avatarUrl} alt="" />
                ) : avatarInitials}
              </div>
              <button className="btn ghost sm" onClick={() => avatarInput.current?.click()} disabled={uploading !== null}>
                <Icon name="camera" size={13} /> {uploading === 'avatar' ? 'Lädt …' : 'Profilbild'}
              </button>
              <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage('avatar', f); e.target.value = ''; }} />
              <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>JPG, PNG oder WebP, max. 4 MB.</span>
            </div>
          </div>

          {/* Identity */}
          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            <div className="field">
              <label>Anzeigename</label>
              <input className="input" value={publicName} maxLength={40} placeholder="z. B. Techno Club Berlin" onChange={(e) => setPublicName(e.target.value)} />
              <div className="hint">Name deiner Veranstalter-Seite und im Shop.</div>
            </div>
            <div className="field">
              <label>Handle</label>
              <div className="row gap-2" style={{ alignItems: 'center' }}>
                <span style={{ fontSize: 15, color: 'var(--ink-3)' }}>@</span>
                <input
                  className="input"
                  value={handle}
                  maxLength={30}
                  placeholder="technoclub"
                  onChange={(e) => setHandle(e.target.value.toLowerCase())}
                  style={!handleValid ? { borderColor: 'var(--bad)' } : undefined}
                />
              </div>
              <div className="hint">
                Deine öffentliche Adresse: getpassly.de/@{handleTrimmed || 'handle'} · Kleinbuchstaben, Zahlen, Unterstrich.
              </div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Über euch (optional)</label>
              <textarea className="textarea" value={bio} maxLength={240} placeholder="Kurz, wofür ihr steht." onChange={(e) => setBio(e.target.value)} />
            </div>
          </div>

          {/* Links (free) */}
          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Links</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14 }}>Website, Instagram und mehr, max. 5.</div>
            {links.map((l, i) => (
              <div key={i} className="pf-linkrow">
                <input className="input" placeholder="Label" value={l.label} maxLength={24}
                  onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <input className="input" placeholder="https://…" value={l.url}
                  onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                <button className="btn ghost sm" onClick={() => setLinks(links.filter((_, j) => j !== i))} aria-label="Link entfernen">
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
            {links.length < 5 && (
              <button className="btn ghost sm" onClick={() => setLinks([...links, { label: '', url: '' }])} style={{ marginTop: 4 }}>
                <Icon name="plus" size={13} /> Link hinzufügen
              </button>
            )}
          </div>

          {/* Pro customizations */}
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <div className="row gap-2" style={{ alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Design</div>
              {!isPro && <span className="chip pro" style={{ fontSize: 10, padding: '2px 7px' }}>Pro</span>}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14 }}>
              {isPro ? 'Gib deiner Seite deine Markenfarbe und hebe ein Event hervor.' : 'Mit Passly Pro: Markenfarbe und ein hervorgehobenes Event auf deiner Seite.'}
            </div>

            <div className="field">
              <label>Akzentfarbe</label>
              <div className="swatch-row" role="radiogroup" aria-label="Akzentfarbe">
                {ACCENT_SWATCHES.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    className="swatch"
                    role="radio"
                    aria-checked={accentHue === c.hue}
                    title={c.name}
                    style={{ background: `oklch(0.58 0.20 ${c.hue ?? 285})` }}
                    onClick={() => isPro && setAccentHue(c.hue)}
                    disabled={!isPro}
                  />
                ))}
              </div>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>Hervorgehobenes Event</label>
              <select
                className="input"
                value={featuredEventId ?? ''}
                onChange={(e) => setFeaturedEventId(e.target.value || null)}
                disabled={!isPro}
              >
                <option value="">Keins</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="row gap-3" style={{ alignItems: 'center' }}>
            <button className="btn primary lg" onClick={() => void handleSave()} disabled={saving || !loaded || !walletAddress}>
              {saving ? 'Speichern …' : 'Speichern'}
            </button>
            {message && (
              <span style={{ fontSize: 13, color: message.ok ? 'var(--ok)' : 'var(--bad)', fontWeight: 500 }}>{message.text}</span>
            )}
          </div>

          <LegalLinks style={{ marginTop: 56, justifyContent: 'flex-start' }} />
        </div>
      </div>
    </div>
  );
}
