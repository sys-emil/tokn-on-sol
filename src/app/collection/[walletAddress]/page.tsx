import Link from 'next/link';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { supabaseAdmin } from '@/lib/supabase';

const BADGE_DISPLAY: Record<string, { name: string; symbol: string; hue: number }> = {
  first_show:      { name: 'Erste Show', symbol: 'I', hue: 285 },
  show_5:          { name: '5 Shows',    symbol: 'V', hue: 150 },
  show_10:         { name: '10 Shows',   symbol: 'X', hue: 220 },
  loyal_organizer: { name: 'Treuer Fan', symbol: '♥', hue: 340 },
};

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

interface BadgeRow {
  badge_type: string;
  asset_id: string | null;
  earned_at: string;
}

async function getCollection(walletAddress: string) {
  const [{ data: purchases }, { data: badges }] = await Promise.all([
    supabaseAdmin
      .from('purchases')
      .select('asset_id, redeemed_at, events(name, date)')
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
      redeemedAt: row.redeemed_at as string,
    };
  });

  return {
    attended,
    badges: (badges ?? []) as BadgeRow[],
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ walletAddress: string }>;
}) {
  const { walletAddress } = await params;
  const { attended, badges } = await getCollection(walletAddress);

  const shortId = `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;

  return (
    <>
      <div className="app">

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

            <div className="hero" style={{ padding: '36px 0 30px', marginBottom: 8 }}>
              <div className="eyebrow"><span className="pulse" />Öffentliches Profil</div>
              <h1 style={{ fontSize: 32 }} className="mono">{shortId}</h1>
              <p className="lead" style={{ fontSize: 14.5 }}>
                {attended.length} Event{attended.length !== 1 ? 's' : ''} besucht
                {badges.length > 0 ? ` · ${badges.length} Abzeichen` : ''}
              </p>
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
                    return (
                      <div key={t.assetId} className="event-card" style={{ cursor: 'default' }}>
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
                <div className="row gap-3" style={{ flexWrap: 'wrap' }}>
                  {badges.map((b) => {
                    const meta = BADGE_DISPLAY[b.badge_type] ?? { name: b.badge_type, symbol: '◆', hue: 260 };
                    return (
                      <div key={b.badge_type} className="card" style={{ padding: '16px 20px', width: 130, textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 600, color: `oklch(0.54 0.20 ${meta.hue})`, lineHeight: 1 }}>{meta.symbol}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>{meta.name}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <LegalLinks style={{ marginTop: 56, justifyContent: 'flex-start' }} />

          </div>
        </div>
      </div>
    </>
  );
}
