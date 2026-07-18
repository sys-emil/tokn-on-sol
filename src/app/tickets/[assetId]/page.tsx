import { notFound } from 'next/navigation';
import TicketClient from './TicketClient';
import { heliusRpcUrl } from '@/lib/solana';
import { supabaseAdmin } from '@/lib/supabase';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';

interface DasAsset {
  content?: { metadata?: { name?: string; attributes?: { trait_type: string; value: string }[] } };
  ownership?: { owner?: string };
}

async function getAsset(assetId: string): Promise<DasAsset | null> {
  const res = await fetch(heliusRpcUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'get-asset', method: 'getAsset', params: { id: assetId } }),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: DasAsset };
  return json.result ?? null;
}

interface PurchaseInfo {
  redeemedAt: string | null;
  revokedAt: string | null;
  eventId: string | null;
  eventName: string | null;
  eventDate: string | null;
  startTime: string | null;
  venue: string | null;
  tierName: string | null;
}

async function getPurchase(assetId: string): Promise<PurchaseInfo | null> {
  const { data } = await supabaseAdmin
    .from('purchases')
    .select('redeemed_at, revoked_at, event_id, events(name, date, start_time, venue), ticket_tiers(name)')
    .eq('asset_id', assetId)
    .maybeSingle();
  if (!data) return null;
  const ev = Array.isArray(data.events) ? data.events[0] : data.events;
  const tier = Array.isArray(data.ticket_tiers) ? data.ticket_tiers[0] : data.ticket_tiers;
  return {
    redeemedAt: (data.redeemed_at as string | null) ?? null,
    revokedAt: (data.revoked_at as string | null) ?? null,
    eventId: (data.event_id as string | null) ?? null,
    eventName: (ev?.name as string | undefined) ?? null,
    eventDate: (ev?.date as string | undefined) ?? null,
    startTime: (ev?.start_time as string | undefined) ?? null,
    venue: (ev?.venue as string | undefined) ?? null,
    tierName: (tier?.name as string | undefined) ?? null,
  };
}

const formatDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

const PAGE_CSS = `
  .ticket-canvas {
    min-height: 100vh;
    display: grid; place-items: center;
    padding: 40px 20px;
    background:
      radial-gradient(1000px 500px at 50% -10%, var(--accent-wash), transparent 60%),
      var(--surface-2);
  }
  .ticket-screen {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 24px;
    box-shadow: var(--shadow-lg);
    width: 380px; max-width: 100%;
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .ticket-body {
    margin: 0 18px;
    padding: 20px;
    border-radius: 18px;
    background: var(--accent-wash);
    border: 1px solid var(--accent-line);
    position: relative;
  }
  .perf {
    position: absolute;
    width: 18px; height: 18px; border-radius: 50%;
    background: var(--surface); border: 1px solid var(--accent-line);
    top: 50%; transform: translateY(-50%);
  }

  /* ── VIP: gold treatment ─────────────────────────────────────────── */
  .ticket-canvas.vip {
    background:
      radial-gradient(1000px 500px at 50% -10%, oklch(0.93 0.07 92 / 0.9), transparent 60%),
      var(--surface-2);
  }
  .ticket-screen.vip {
    border-color: oklch(0.78 0.11 92);
    box-shadow:
      0 0 0 1px oklch(0.78 0.11 92 / 0.45),
      0 20px 50px oklch(0.55 0.10 90 / 0.28),
      var(--shadow-lg);
  }
  .vip-strip {
    position: relative;
    overflow: hidden;
    background: linear-gradient(110deg,
      oklch(0.62 0.11 88), oklch(0.78 0.12 92) 30%,
      oklch(0.92 0.09 95) 50%,
      oklch(0.78 0.12 92) 70%, oklch(0.62 0.11 88));
    color: oklch(0.28 0.06 85);
    display: flex; align-items: center; justify-content: center; gap: 10px;
    padding: 8px 0;
    font-size: 12px; font-weight: 700; letter-spacing: 0.42em;
    text-indent: 0.42em; /* optically re-center tracked text */
    text-transform: uppercase;
  }
  .vip-strip::after {
    content: "";
    position: absolute; inset: 0;
    background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%);
    transform: translateX(-100%);
    animation: vipShine 3.4s ease-in-out infinite;
  }
  @keyframes vipShine {
    0% { transform: translateX(-100%); }
    45%, 100% { transform: translateX(100%); }
  }
  @media (prefers-reduced-motion: reduce) { .vip-strip::after { animation: none; } }
  .vip-strip .star { font-size: 9px; letter-spacing: 0; text-indent: 0; }
  .ticket-body.vip {
    background: linear-gradient(150deg, oklch(0.97 0.035 95), oklch(0.94 0.06 92));
    border-color: oklch(0.80 0.10 92);
  }
  .ticket-body.vip .perf { border-color: oklch(0.80 0.10 92); }
  .vip-ink { color: oklch(0.46 0.09 85) !important; }
  .vip-chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 2px 10px; border-radius: 999px;
    background: linear-gradient(110deg, oklch(0.72 0.12 90), oklch(0.85 0.11 94));
    color: oklch(0.26 0.06 85);
    font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em;
    border: 1px solid oklch(0.68 0.11 88);
  }
`;

export default async function TicketPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const [asset, purchase] = await Promise.all([getAsset(assetId), getPurchase(assetId)]);

  if (!asset && !purchase) notFound();

  const name = purchase?.eventName
    ?? asset?.content?.metadata?.name
    ?? 'Unbekanntes Event';
  const dateAttr = asset?.content?.metadata?.attributes?.find((a) => a.trait_type === 'Event Date');
  const date = purchase?.eventDate ?? dateAttr?.value ?? '';
  const venueAttr = asset?.content?.metadata?.attributes?.find((a) => a.trait_type === 'Venue');
  const venue = purchase?.venue ?? venueAttr?.value ?? null;

  const status: 'valid' | 'checked' | 'revoked' = purchase?.revokedAt
    ? 'revoked'
    : purchase?.redeemedAt
      ? 'checked'
      : 'valid';

  const serial = `PSL-${assetId.slice(-4).toUpperCase()}`;
  const tierName = purchase?.tierName ?? null;
  const isVip = /\bvip\b/i.test(tierName ?? '');

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className={`ticket-canvas${isVip ? ' vip' : ''}`}>
        <div className={`ticket-screen${isVip ? ' vip' : ''}`}>

          {isVip && (
            <div className="vip-strip" aria-hidden="true">
              <span className="star">★</span>VIP<span className="star">★</span>
            </div>
          )}

          <div style={{ padding: '18px 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <PasslyLogo height={20} />
            {isVip && <span className="vip-chip">VIP</span>}
          </div>

          <div style={{ padding: '16px 22px 14px' }}>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {isVip ? 'Dein VIP-Ticket' : 'Dein Ticket'}
            </div>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.25, marginTop: 4 }}>{name}</div>
            {date && (
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 6 }}>{formatDate(date)}</div>
            )}
          </div>

          <div className={`ticket-body${isVip ? ' vip' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              {status === 'valid' && <span className="chip ok" style={{ background: 'white' }}><span className="d" />Gültig</span>}
              {status === 'checked' && <span className="chip" style={{ background: 'white' }}><span className="d" />Eingelöst</span>}
              {status === 'revoked' && <span className="chip bad" style={{ background: 'white' }}><span className="d" />Storniert</span>}
              <span className={isVip ? 'vip-ink' : undefined} style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent-ink)' }}>#{serial}</span>
            </div>
            <div style={{ background: 'white', padding: 12, borderRadius: 12, boxShadow: '0 1px 2px rgba(17,20,45,0.06)', display: 'grid', placeItems: 'center' }}>
              <TicketClient assetId={assetId} />
            </div>
            <div className={isVip ? 'vip-ink' : undefined} style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--accent-ink)', fontWeight: 500 }}>
              {status === 'revoked' ? 'Dieses Ticket wurde storniert.' : 'Beim Einlass einscannen lassen'}
            </div>
            <div className="perf" style={{ left: -9 }} />
            <div className="perf" style={{ right: -9 }} />
          </div>

          <div style={{ padding: '16px 22px 20px', display: 'grid', gap: 8, fontSize: 12.5 }}>
            {tierName && (
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Kategorie</span>
                {isVip
                  ? <span className="vip-chip">{tierName}</span>
                  : <span style={{ fontWeight: 500 }}>{tierName}</span>}
              </div>
            )}
            {venue && (
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Ort</span>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(venue)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontWeight: 500, color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}
                >
                  {venue}
                </a>
              </div>
            )}
            {date && (
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Datum</span><span style={{ fontWeight: 500 }}>{formatDate(date)}</span>
              </div>
            )}
            {purchase?.startTime && (
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Beginn</span><span style={{ fontWeight: 500 }}>{purchase.startTime} Uhr</span>
              </div>
            )}
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">Ticket-Nr.</span><span style={{ fontWeight: 500, fontFamily: 'var(--mono)', fontSize: 11.5 }}>#{serial}</span>
            </div>
            {purchase?.eventId && status !== 'revoked' && (
              <a
                href={`/api/events/${purchase.eventId}/ics`}
                className="btn ghost sm"
                style={{ justifyContent: 'center', marginTop: 6 }}
              >
                Zum Kalender hinzufügen
              </a>
            )}
          </div>

        </div>
        <LegalLinks style={{ marginTop: 22 }} />
      </div>
    </>
  );
}
