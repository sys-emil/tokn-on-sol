import Link from 'next/link';
import type { Metadata } from 'next';
import { LegalLinks } from '@/app/components/LegalLinks';
import { ShareButton } from './ShareButton';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { supabaseAdmin } from '@/lib/supabase';
import { badgeDisplay } from '@/lib/badgeMeta';

function eventHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

const monthShort = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' }).replace('.', '');
const dayNum = (iso: string) => new Date(iso + 'T00:00:00').getDate();
const formatDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

const PAGE_CSS = `
  .profile-head {
    display: flex; align-items: center; gap: 18px;
    padding: 36px 0 30px; margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .profile-avatar {
    width: 72px; height: 72px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, oklch(0.82 0.08 var(--hue)), oklch(0.68 0.16 calc(var(--hue) + 40)));
    display: grid; place-items: center;
    color: white; font-size: 26px; font-weight: 600; letter-spacing: -0.02em;
    border: 2px solid var(--surface);
    box-shadow: 0 6px 20px oklch(0.52 0.20 var(--hue) / 0.30);
  }
  .memory-card { padding: 0; overflow: hidden; cursor: default; }
  .memory-card .photo {
    width: 100%; height: 140px; object-fit: cover; display: block;
    border-bottom: 1px solid var(--line);
  }
  .memory-card .body { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
`;

interface BadgeRow {
  badge_type: string;
  asset_id: string | null;
  earned_at: string;
}

interface ProfileRow {
  display_name: string | null;
  bio: string | null;
  is_private: boolean;
}

async function getCollection(walletAddress: string) {
  const [{ data: profile }, { data: purchases }, { data: badges }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('display_name, bio, is_private')
      .eq('wallet_address', walletAddress)
      .maybeSingle(),
    supabaseAdmin
      .from('purchases')
      .select('asset_id, redeemed_at, events(name, date, image_url)')
      .eq('buyer_wallet', walletAddress)
      .not('redeemed_at', 'is', null)
      .order('redeemed_at', { ascending: false }),
    supabaseAdmin
      .from('badges')
      .select('badge_type, asset_id, earned_at')
      .eq('wallet_address', walletAddress)
      .order('earned_at', { ascending: true }),
  ]);

  const attended = (purchases ?? []).map((row) => {
    const ev = Array.isArray(row.events) ? row.events[0] : row.events;
    return {
      assetId: row.asset_id as string,
      eventName: (ev?.name ?? '') as string,
      eventDate: (ev?.date ?? '') as string,
      imageUrl: (ev?.image_url ?? null) as string | null,
      redeemedAt: row.redeemed_at as string,
    };
  });

  return {
    profile: (profile as ProfileRow | null) ?? null,
    attended,
    badges: (badges ?? []) as BadgeRow[],
  };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <style>{PAGE_CSS}</style>
      <div className="topbar">
        <div className="topbar-inner">
          <PasslyLogo height={24} />
          <div className="nav">
            <Link href="/events">Events</Link>
          </div>
          <div className="topbar-right">
            <Link href="/events" className="btn ghost sm">Events entdecken</Link>
          </div>
        </div>
      </div>
      <div className="main">
        <div className="aurora" aria-hidden="true" />
        <div className="container">
          {children}
          <LegalLinks style={{ marginTop: 56, justifyContent: 'flex-start' }} />
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ walletAddress: string }>;
}): Promise<Metadata> {
  const { walletAddress } = await params;
  const [{ data: profile }, { count: attended }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('display_name, is_private')
      .eq('wallet_address', walletAddress)
      .maybeSingle(),
    supabaseAdmin
      .from('purchases')
      .select('*', { count: 'exact', head: true })
      .eq('buyer_wallet', walletAddress)
      .not('redeemed_at', 'is', null),
  ]);

  if (profile?.is_private) {
    const description =
      'Diese Sammlung auf Passly ist privat. Die Person hat ihre besuchten Events und Abzeichen nicht öffentlich geteilt — entdecke stattdessen Events auf getpassly.de.';
    return {
      title: 'Privates Profil — Eventsammlung auf Passly ansehen',
      description,
      openGraph: { title: 'Privates Profil auf Passly', description: 'Diese Sammlung ist privat — die besuchten Events und Abzeichen sind nicht öffentlich sichtbar.', siteName: 'Passly' },
    };
  }

  const name = (profile?.display_name as string | null)?.trim() || 'Konzertgänger:in';
  const count = attended ?? 0;
  const attendedText = `${count} Event${count === 1 ? '' : 's'}`;
  // SERP snippet: 120–160 chars. OG description: 80–125 chars (Discord/social cards).
  const description = `${name} hat ${attendedText} auf Passly besucht. Schau dir die gesammelten Erinnerungen und Abzeichen an — und entdecke selbst Events in deiner Nähe.`;
  const ogDescription = `${attendedText} besucht — die ganze Sammlung mit allen verdienten Abzeichen jetzt auf Passly ansehen.`;
  return {
    title: `${name} — Eventsammlung & Abzeichen auf Passly`,
    description,
    openGraph: {
      title: `${name} auf Passly`,
      description: ogDescription,
      siteName: 'Passly',
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ walletAddress: string }>;
}) {
  const { walletAddress } = await params;
  const { profile, attended, badges } = await getCollection(walletAddress);

  if (profile?.is_private) {
    return (
      <Shell>
        <div className="card" style={{ padding: 40, textAlign: 'center', maxWidth: 480, margin: '48px auto 0' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', margin: '0 auto 14px', color: 'var(--ink-3)' }}>
            <Icon name="shield" size={20} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em' }}>Dieses Profil ist privat.</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.6 }}>
            Die Person hat ihre Sammlung und Abzeichen nicht öffentlich geteilt.
          </div>
        </div>
      </Shell>
    );
  }

  const displayName = profile?.display_name?.trim() || 'Konzertgänger:in';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <Shell>
      <div className="profile-head">
        <div className="profile-avatar">{initials}</div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent-ink)', fontWeight: 500, background: 'var(--accent-wash)', border: '1px solid var(--accent-line)', padding: '3px 9px', borderRadius: 999, marginBottom: 8 }}>
            Öffentliches Profil
          </div>
          <h1 style={{ fontSize: 30, letterSpacing: '-0.03em', fontWeight: 600, lineHeight: 1.1 }}>{displayName}</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 6 }}>
            {attended.length} Event{attended.length !== 1 ? 's' : ''} besucht
            {badges.length > 0 ? ` · ${badges.length} Abzeichen` : ''}
          </p>
          {profile?.bio && (
            <p style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.6, maxWidth: 520 }}>{profile.bio}</p>
          )}
        </div>
        <ShareButton title={`${displayName} auf Passly`} />
      </div>

      <section>
        <div className="section-head">
          <div>
            <h2>Sammlung</h2>
            <div className="sub">Besuchte Events</div>
          </div>
        </div>
        {attended.length === 0 ? (
          <div className="card">
            <div className="empty">
              Noch keine besuchten Events — die Geschichte beginnt beim nächsten Mal.
              <div style={{ marginTop: 12 }}>
                <Link href="/events" style={{ color: 'var(--accent)', fontWeight: 500, fontSize: 13 }}>Events entdecken →</Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="events-grid">
            {attended.map((t) => {
              const hue = eventHue(t.eventName);
              const inner = (
                <>
                  <div className="row gap-3">
                    <div className="date-chip">
                      <div className="m" style={{ background: `oklch(0.54 0.16 ${hue})` }}>{monthShort(t.eventDate)}</div>
                      <div className="d">{dayNum(t.eventDate)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="title">{t.eventName}</div>
                      <div className="meta">
                        <Icon name="calendar" size={12} /> {formatDate(t.eventDate)}
                      </div>
                    </div>
                  </div>
                  <div className="row">
                    <span className="chip ok"><span className="d" />Dabei gewesen</span>
                  </div>
                </>
              );
              return t.imageUrl ? (
                <div key={t.assetId} className="event-card memory-card">
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage URL, sizes vary */}
                  <img className="photo" src={t.imageUrl} alt={t.eventName} loading="lazy" />
                  <div className="body">{inner}</div>
                </div>
              ) : (
                <div key={t.assetId} className="event-card" style={{ cursor: 'default' }}>
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {badges.length > 0 && (
        <section>
          <div className="section-head">
            <div>
              <h2>Abzeichen</h2>
              <div className="sub">{badges.length} verdient</div>
            </div>
          </div>
          <div className="badges-row">
            {badges.map((b) => {
              const meta = badgeDisplay(b.badge_type);
              const earned = new Date(b.earned_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
              return (
                <div key={b.badge_type} className="badge-tile" style={{ '--bh': meta.hue } as React.CSSProperties}>
                  <div className="badge-medal">{meta.symbol}</div>
                  <div className="badge-name">{meta.name}</div>
                  <div className="badge-date">{earned}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </Shell>
  );
}
