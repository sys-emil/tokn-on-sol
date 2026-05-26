import { Epilogue, Unbounded } from 'next/font/google';
import Link from 'next/link';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { supabaseAdmin } from '@/lib/supabase';

const unbounded = Unbounded({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '600', '900'],
  display: 'swap',
});

const epilogue = Epilogue({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500'],
  display: 'swap',
});

const BADGE_DISPLAY: Record<string, { name: string; symbol: string; hue: number }> = {
  first_show:      { name: 'First Show', symbol: 'I',  hue: 48  },
  show_5:          { name: '5 Shows',    symbol: 'V',  hue: 150 },
  show_10:         { name: '10 Shows',   symbol: 'X',  hue: 220 },
  loyal_organizer: { name: 'Loyal Fan',  symbol: '♥',  hue: 340 },
};

function eventHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

function formatDateShort(iso: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day))
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

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

const CSS = `
  :root {
    --color-bg:         oklch(0.09 0.028 305);
    --color-surface:    oklch(0.15 0.024 308);
    --color-border:     oklch(0.26 0.022 305);
    --color-text:       oklch(0.96 0.008 75);
    --color-text-muted: oklch(0.56 0.012 305);
    --color-accent:     oklch(0.79 0.19 48);
  }
  html, body { margin: 0; padding: 0; background: var(--color-bg); }
  .page-root {
    font-family: var(--font-body);
    background-color: var(--color-bg);
    background-image: radial-gradient(circle, oklch(0.28 0.026 308 / 0.38) 1px, transparent 1px);
    background-size: 28px 28px;
    color: var(--color-text); min-height: 100dvh;
    display: flex; flex-direction: column;
  }
  .nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 20;
    padding: 0 48px; height: 68px;
    display: flex; align-items: center; justify-content: space-between;
    background: oklch(0.09 0.028 305 / 0.88);
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--color-border);
  }
  .nav-right { display: flex; align-items: center; gap: 12px; }
  .btn-nav {
    font-family: var(--font-display); font-size: 10px; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--color-text-muted); background: transparent;
    border: 1px solid var(--color-border); padding: 8px 16px;
    cursor: pointer; text-decoration: none; display: inline-flex; align-items: center;
    transition: color 0.15s, border-color 0.15s;
  }
  .btn-nav:hover { color: var(--color-text); border-color: oklch(0.42 0.022 305); }
  .main {
    flex: 1; max-width: 860px; width: 100%; margin: 0 auto;
    padding: 108px 48px 96px; box-sizing: border-box;
    display: flex; flex-direction: column; gap: 56px;
  }
  .page-heading { display: flex; flex-direction: column; gap: 6px; }
  .page-label {
    font-family: var(--font-body); font-size: 11px; font-weight: 500;
    letter-spacing: 0.20em; text-transform: uppercase; color: var(--color-accent);
    display: flex; align-items: center; gap: 10px;
  }
  .page-label-line { display: block; width: 24px; height: 1px; background: var(--color-accent); }
  .page-title {
    font-family: var(--font-display); font-size: clamp(24px, 3vw, 38px);
    font-weight: 900; letter-spacing: -0.02em; line-height: 1.1; color: var(--color-text); margin: 0;
  }
  .page-sub {
    font-family: var(--font-body); font-size: 12px; color: var(--color-text-muted);
    margin: 6px 0 0; font-variant-numeric: tabular-nums;
  }
  .section { display: flex; flex-direction: column; gap: 20px; }
  .section-header { display: flex; align-items: baseline; gap: 10px; }
  .section-title {
    font-family: var(--font-display); font-size: 10px; font-weight: 600;
    letter-spacing: 0.20em; text-transform: uppercase; color: var(--color-text-muted);
  }
  .section-count {
    font-family: var(--font-display); font-size: 10px; font-weight: 600;
    letter-spacing: 0.12em; color: var(--color-accent);
  }
  .card-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .ticket-card {
    background: var(--color-surface); border: 1px solid var(--color-border);
    display: flex; flex-direction: column; position: relative; overflow: hidden;
    text-decoration: none; color: inherit;
    transition: border-color 0.2s, transform 0.2s;
  }
  .ticket-card:hover { transform: translateY(-2px); border-color: oklch(0.35 0.018 305); }
  .card-art { height: 140px; position: relative; overflow: hidden; flex-shrink: 0; }
  .card-art-bg { position: absolute; inset: 0; }
  .card-art-noise {
    position: absolute; inset: 0;
    background-image: radial-gradient(circle, oklch(1 0 0 / 0.04) 1px, transparent 1px);
    background-size: 14px 14px;
  }
  .card-stamp {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center; pointer-events: none;
  }
  .card-stamp-text {
    font-family: var(--font-display); font-size: 11px; font-weight: 900;
    letter-spacing: 0.28em; text-transform: uppercase; color: var(--color-accent);
    border: 2px solid var(--color-accent); padding: 5px 10px;
    transform: rotate(-18deg); opacity: 0.88;
    box-shadow: 0 0 16px oklch(0.79 0.19 48 / 0.35);
  }
  .card-info { padding: 12px 14px; display: flex; flex-direction: column; gap: 3px; border-top: 1px solid var(--color-border); flex: 1; }
  .card-name {
    font-family: var(--font-display); font-size: 11px; font-weight: 900;
    letter-spacing: -0.01em; color: var(--color-text);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .card-date { font-family: var(--font-body); font-size: 10px; color: var(--color-text-muted); }
  .badge-grid { display: flex; flex-wrap: wrap; gap: 10px; }
  .badge-card {
    background: var(--color-surface); border: 1px solid var(--color-border);
    width: 110px; padding: 16px 12px 14px;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    box-sizing: border-box;
  }
  .badge-symbol { font-family: var(--font-display); font-size: 22px; font-weight: 900; line-height: 1; }
  .badge-name {
    font-family: var(--font-display); font-size: 8px; font-weight: 600;
    letter-spacing: 0.16em; text-transform: uppercase; color: var(--color-text); text-align: center;
  }
  .empty {
    border: 1px dashed var(--color-border); padding: 28px 24px;
    display: flex; align-items: center; justify-content: center;
  }
  .empty-text {
    font-family: var(--font-body); font-size: 13px; color: var(--color-text-muted);
    text-align: center; line-height: 1.6; margin: 0;
  }
  @media (max-width: 640px) {
    .nav { padding: 0 20px; }
    .main { padding: 96px 20px 64px; }
    .card-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .badge-card { width: calc(50% - 5px); }
  }
`;

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ walletAddress: string }>;
}) {
  const { walletAddress } = await params;
  const { attended, badges } = await getCollection(walletAddress);

  const shortWallet = `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;

  return (
    <>
      <style>{CSS}</style>
      <div className={`page-root ${unbounded.variable} ${epilogue.variable}`}>

        <nav className="nav">
          <PasslyLogo />
          <div className="nav-right">
            <Link href="/" className="btn-nav">Browse Events</Link>
          </div>
        </nav>

        <main className="main">

          <div className="page-heading">
            <div className="page-label">
              <span className="page-label-line" />
              Public Shelf
            </div>
            <h1 className="page-title">{shortWallet}</h1>
            <p className="page-sub">
              {attended.length} show{attended.length !== 1 ? 's' : ''} attended
              {badges.length > 0 ? ` · ${badges.length} badge${badges.length !== 1 ? 's' : ''}` : ''}
            </p>
          </div>

          {/* Collection */}
          <div className="section">
            <div className="section-header">
              <div className="section-title">Collection</div>
              {attended.length > 0 && <div className="section-count">{attended.length}</div>}
            </div>
            {attended.length === 0 ? (
              <div className="empty">
                <p className="empty-text">No attended events yet.</p>
              </div>
            ) : (
              <div className="card-grid">
                {attended.map((t) => {
                  const hue = eventHue(t.eventName);
                  const hue2 = (hue + 55) % 360;
                  return (
                    <div key={t.assetId} className="ticket-card">
                      <div className="card-art">
                        <div
                          className="card-art-bg"
                          style={{ background: `radial-gradient(ellipse at 35% 45%, oklch(0.30 0.18 ${hue} / 0.95), transparent 55%), radial-gradient(ellipse at 65% 60%, oklch(0.24 0.13 ${hue2} / 0.8), transparent 50%), oklch(0.13 0.06 ${hue})` }}
                        />
                        <div className="card-art-noise" />
                        <div className="card-stamp">
                          <span className="card-stamp-text">Attended</span>
                        </div>
                      </div>
                      <div className="card-info">
                        <div className="card-name">{t.eventName}</div>
                        <div className="card-date">{formatDateShort(t.eventDate)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Badges */}
          {badges.length > 0 && (
            <div className="section">
              <div className="section-header">
                <div className="section-title">Badges</div>
                <div className="section-count">{badges.length}</div>
              </div>
              <div className="badge-grid">
                {badges.map((b) => {
                  const meta = BADGE_DISPLAY[b.badge_type] ?? { name: b.badge_type, symbol: '◆', hue: 260 };
                  return (
                    <div key={b.badge_type} className="badge-card">
                      <span
                        className="badge-symbol"
                        style={{ color: `oklch(0.78 0.20 ${meta.hue})` }}
                      >
                        {meta.symbol}
                      </span>
                      <div className="badge-name">{meta.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </main>
      </div>
    </>
  );
}
