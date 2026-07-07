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
  eventName: string | null;
  eventDate: string | null;
  venue: string | null;
  priceEur: number | null;
}

async function getPurchase(assetId: string): Promise<PurchaseInfo | null> {
  const { data } = await supabaseAdmin
    .from('purchases')
    .select('redeemed_at, revoked_at, events(name, date, venue, price_eur)')
    .eq('asset_id', assetId)
    .maybeSingle();
  if (!data) return null;
  const ev = Array.isArray(data.events) ? data.events[0] : data.events;
  return {
    redeemedAt: (data.redeemed_at as string | null) ?? null,
    revokedAt: (data.revoked_at as string | null) ?? null,
    eventName: (ev?.name as string | undefined) ?? null,
    eventDate: (ev?.date as string | undefined) ?? null,
    venue: (ev?.venue as string | undefined) ?? null,
    priceEur: (ev?.price_eur as number | undefined) ?? null,
  };
}

const formatDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
const eur = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

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

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="ticket-canvas">
        <div className="ticket-screen">

          <div style={{ padding: '18px 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <PasslyLogo height={20} />
          </div>

          <div style={{ padding: '16px 22px 14px' }}>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Dein Ticket</div>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.25, marginTop: 4 }}>{name}</div>
            {date && (
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 6 }}>{formatDate(date)}</div>
            )}
          </div>

          <div className="ticket-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              {status === 'valid' && <span className="chip ok" style={{ background: 'white' }}><span className="d" />Gültig</span>}
              {status === 'checked' && <span className="chip" style={{ background: 'white' }}><span className="d" />Eingelöst</span>}
              {status === 'revoked' && <span className="chip bad" style={{ background: 'white' }}><span className="d" />Storniert</span>}
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent-ink)' }}>#{serial}</span>
            </div>
            <div style={{ background: 'white', padding: 12, borderRadius: 12, boxShadow: '0 1px 2px rgba(17,20,45,0.06)', display: 'grid', placeItems: 'center' }}>
              <TicketClient assetId={assetId} />
            </div>
            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--accent-ink)', fontWeight: 500 }}>
              {status === 'revoked' ? 'Dieses Ticket wurde storniert.' : 'Beim Einlass einscannen lassen'}
            </div>
            <div className="perf" style={{ left: -9 }} />
            <div className="perf" style={{ right: -9 }} />
          </div>

          <div style={{ padding: '16px 22px 20px', display: 'grid', gap: 8, fontSize: 12.5 }}>
            {venue && (
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Ort</span><span style={{ fontWeight: 500 }}>{venue}</span>
              </div>
            )}
            {date && (
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Datum</span><span style={{ fontWeight: 500 }}>{formatDate(date)}</span>
              </div>
            )}
            {purchase?.priceEur != null && (
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Preis</span><span style={{ fontWeight: 500 }}>{purchase.priceEur === 0 ? 'Kostenlos' : eur(purchase.priceEur)}</span>
              </div>
            )}
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">Ticket-Nr.</span><span style={{ fontWeight: 500, fontFamily: 'var(--mono)', fontSize: 11.5 }}>#{serial}</span>
            </div>
          </div>

        </div>
        <LegalLinks style={{ marginTop: 22 }} />
      </div>
    </>
  );
}
