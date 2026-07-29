import Link from 'next/link';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { loadGuestOrder, guestTicketQr } from '@/lib/guestOrders';
import { getAssetOwner } from '@/lib/resale';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { ClaimTickets } from './ClaimTickets';

export const dynamic = 'force-dynamic';

// The token is a bearer credential; keep these pages out of search results.
export const metadata: Metadata = {
  title: 'Deine Tickets · Passly',
  robots: { index: false, follow: false },
};

function formatDate(iso: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

interface TicketView {
  assetId: string;
  qrDataUrl: string | null;
  claimed: boolean;
}

/**
 * Guest order page: the tickets of someone who bought without an account.
 *
 * Everything is rendered server-side because the QR is signed with the operator
 * key — it can never be produced in the browser. Once a ticket has left escrow
 * (the guest claimed it into an account) the static code is no longer valid and
 * the page points at the normal ticket page instead.
 */
export default async function GuestOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const order = await loadGuestOrder(token);
  if (!order) notFound();

  const [{ data: event }, { data: purchases }] = await Promise.all([
    supabaseAdmin
      .from('events')
      .select('id, name, date, start_time, venue, cancelled_at')
      .eq('id', order.event_id)
      .maybeSingle(),
    supabaseAdmin
      .from('purchases')
      .select('asset_id, revoked_at, redeemed_at')
      .eq('stripe_session_id', order.stripe_session_id)
      .order('created_at', { ascending: true }),
  ]);

  if (!event) notFound();

  const rows = (purchases ?? []) as { asset_id: string; revoked_at: string | null; redeemed_at: string | null }[];
  const valid = rows.filter((r) => !r.revoked_at);

  const tickets: TicketView[] = await Promise.all(
    valid.map(async (row) => {
      const owner = await getAssetOwner(row.asset_id);
      const payload = guestTicketQr(row.asset_id, owner);
      return {
        assetId: row.asset_id,
        qrDataUrl: payload
          ? await QRCode.toDataURL(payload, { width: 560, margin: 1, errorCorrectionLevel: 'M' })
          : null,
        claimed: payload === null,
      };
    }),
  );

  const allClaimed = tickets.length > 0 && tickets.every((t) => t.claimed);
  const redeemedCount = valid.filter((r) => r.redeemed_at).length;

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="order-page">
        <div className="order-card">
          <div className="order-head">
            <PasslyLogo height={22} />
            <span className="eyebrow">Deine Tickets</span>
          </div>

          <h1>{event.name as string}</h1>
          <div className="meta">
            {formatDate(event.date as string)}
            {event.start_time ? ` · ${event.start_time as string} Uhr` : ''}
            {event.venue ? ` · ${event.venue as string}` : ''}
          </div>

          {event.cancelled_at && (
            <div className="notice bad">
              Dieses Event wurde abgesagt. Der Betrag wird erstattet; du musst nichts tun.
            </div>
          )}

          {tickets.length === 0 && (
            <div className="notice">
              Deine Tickets werden gerade erstellt. Lade die Seite in ein paar Sekunden neu.
            </div>
          )}

          {redeemedCount > 0 && (
            <div className="notice">
              {redeemedCount === valid.length
                ? 'Bereits eingelöst. Dieser Code öffnet die Tür nicht noch einmal.'
                : `${redeemedCount} von ${valid.length} Tickets wurden bereits eingelöst.`}
            </div>
          )}

          {tickets.map((ticket, i) => (
            <div key={ticket.assetId} className="ticket">
              {tickets.length > 1 && <div className="ticket-label">Ticket {i + 1} von {tickets.length}</div>}
              {ticket.qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data: URL generated server-side
                <img src={ticket.qrDataUrl} alt="QR-Code für den Einlass" className="qr" />
              ) : (
                <div className="claimed-box">
                  Dieses Ticket liegt jetzt in deinem Konto.{' '}
                  <Link href={`/tickets/${ticket.assetId}`}>Zum Ticket →</Link>
                </div>
              )}
            </div>
          ))}

          {!allClaimed && tickets.length > 0 && (
            <>
              <div className="hint">
                Zeig diesen Code am Einlass. Behandle den Link wie eine Eintrittskarte: Wer ihn
                hat, kommt rein.
              </div>
              <ClaimTickets token={token} count={tickets.length} />
            </>
          )}

          <LegalLinks />
        </div>
      </div>
    </>
  );
}

const PAGE_CSS = `
  .order-page {
    min-height: 100dvh;
    padding: 32px 16px 48px;
    display: flex; justify-content: center;
    background: radial-gradient(1000px 500px at 50% -10%, var(--accent-wash), transparent 60%), var(--surface-2);
  }
  .order-card {
    width: 100%; max-width: 420px;
    background: var(--surface-1); border: 1px solid var(--surface-3);
    border-radius: 18px; padding: 22px 20px 18px; box-shadow: var(--shadow-1);
  }
  .order-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
  .order-head .eyebrow {
    font-size: 11px; font-weight: 600; color: var(--accent-ink);
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .order-card h1 { font-size: 22px; line-height: 1.25; margin: 0 0 6px; letter-spacing: -0.01em; }
  .meta { font-size: 13px; color: var(--ink-3); line-height: 1.5; margin-bottom: 18px; }
  .ticket { margin-bottom: 18px; }
  .ticket-label {
    font-size: 11.5px; color: var(--ink-4); font-weight: 500;
    text-align: center; margin-bottom: 8px;
  }
  .qr {
    width: 100%; max-width: 280px; height: auto; display: block; margin: 0 auto;
    border-radius: 10px; background: #fff; padding: 10px;
    border: 1px solid var(--surface-3);
  }
  .claimed-box {
    padding: 14px; border-radius: 9px; background: var(--surface-2);
    font-size: 13px; color: var(--ink-2); line-height: 1.5; text-align: center;
  }
  .claimed-box a { color: var(--accent-ink); font-weight: 600; text-decoration: none; }
  .hint { font-size: 12px; color: var(--ink-4); line-height: 1.55; text-align: center; margin: 4px 0 16px; }
  .notice {
    padding: 11px 13px; border-radius: 9px; background: var(--surface-2);
    font-size: 12.5px; color: var(--ink-2); line-height: 1.5; margin-bottom: 16px;
  }
  .notice.bad { background: var(--bad-wash); color: var(--bad); border: 1px solid oklch(0.86 0.10 25); }
`;
