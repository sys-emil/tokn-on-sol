import Link from 'next/link';
import { after } from 'next/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { loadGuestOrder } from '@/lib/guestOrders';
import { processMintJobs } from '@/lib/mintJobs';
import { LegalLinks } from '@/app/components/LegalLinks';
import { ReceiptButton } from '@/app/components/ReceiptButton';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
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

/**
 * Guest order page: what someone sees who bought without an account.
 *
 * It deliberately shows NO scannable code. The ticket only becomes visible and
 * valid after signing in, at which point the tickets move out of operator
 * escrow into the buyer's own account and the rotating QR takes over. That
 * keeps every ticket on the strong model — a static code sitting behind a link
 * would be copyable, and the link travels through e-mail.
 *
 * The account is therefore still required; the point of guest checkout is that
 * it is required *after* paying rather than before, which is where buyers drop
 * out.
 */
/**
 * Kick the mint worker when this order's job never finished. Checking the job
 * row is exact — `guest_orders` does not carry the ordered quantity, so the
 * number of minted tickets alone cannot tell us whether any are still missing.
 */
async function kickUnfinishedMint(stripeSessionId: string): Promise<void> {
  const { data: job } = await supabaseAdmin
    .from('mint_jobs')
    .select('status')
    .eq('stripe_session_id', stripeSessionId)
    .maybeSingle();

  const status = job?.status as string | undefined;
  if (!status || status === 'done' || status === 'failed') return;

  after(async () => {
    try {
      await processMintJobs(3);
    } catch (err) {
      console.error('Mint kick from guest order page failed:', err);
    }
  });
}

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

  // A guest's mint job is queued against the OPERATOR wallet (the ticket sits
  // in escrow until they sign in), so the buyer-wallet check in /api/my-tickets
  // can never see it. This page is the only place a guest comes looking, which
  // makes it the right place to nudge a stalled mint — the daily cron would
  // otherwise be their next chance. Runs in after(), so the page still renders
  // immediately; see /api/checkout/confirm for why polling can't stampede.
  await kickUnfinishedMint(order.stripe_session_id);

  const rows = (purchases ?? []) as { asset_id: string; revoked_at: string | null; redeemed_at: string | null }[];
  const valid = rows.filter((r) => !r.revoked_at);
  const claimed = order.claimed_at !== null;
  const redeemedCount = valid.filter((r) => r.redeemed_at).length;

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="order-page">
        <div className="order-card">
          <div className="order-head">
            <PasslyLogo height={22} />
            <span className="eyebrow">{valid.length > 1 ? `${valid.length} Tickets` : 'Dein Ticket'}</span>
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

          {valid.length === 0 && !event.cancelled_at && (
            <div className="notice">
              Deine Tickets werden gerade erstellt. Lade die Seite in ein paar Sekunden neu.
            </div>
          )}

          {claimed ? (
            <>
              <div className="done-box">
                <div className="done-icon"><Icon name="check" size={16} strokeWidth={2.4} /></div>
                <div>
                  {valid.length > 1 ? 'Deine Tickets liegen' : 'Dein Ticket liegt'} in deinem Konto.
                  {redeemedCount > 0 && ` ${redeemedCount} davon wurde${redeemedCount === 1 ? '' : 'n'} bereits eingelöst.`}
                </div>
              </div>
              <Link href="/my-tickets" className="btn primary lg full">Zu meinen Tickets</Link>
            </>
          ) : valid.length > 0 ? (
            <>
              <div className="locked">
                <div className="locked-badge"><Icon name="shield" size={22} strokeWidth={1.8} /></div>
                <div className="locked-title">
                  {valid.length > 1 ? 'Tickets anzeigen' : 'Ticket anzeigen'}
                </div>
                <div className="locked-text">
                  Melde dich mit deiner E-Mail-Adresse an, dann {valid.length > 1 ? 'werden deine Tickets' : 'wird dein Ticket'} freigeschaltet.
                  Das dauert einen Moment und schützt dich: Der Einlass-Code wechselt danach jede
                  Minute und lässt sich nicht abfotografieren oder weitergeben.
                </div>
              </div>
              <ClaimTickets token={token} count={valid.length} />
            </>
          ) : null}

          {/* The receipt needs no account; the order token is the credential
              here, exactly as it is for the rest of this page. */}
          <div style={{ marginTop: 14 }}>
            <ReceiptButton orderToken={token} />
          </div>

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
  .meta { font-size: 13px; color: var(--ink-3); line-height: 1.5; margin-bottom: 20px; }
  .btn.full { width: 100%; justify-content: center; margin-top: 4px; }

  .locked {
    text-align: center; padding: 26px 16px 22px;
    border: 1px dashed var(--surface-3); border-radius: 14px;
    background: var(--surface-2); margin-bottom: 16px;
  }
  .locked-badge {
    width: 48px; height: 48px; border-radius: 999px; margin: 0 auto 12px;
    display: flex; align-items: center; justify-content: center;
    background: var(--accent-wash); color: var(--accent-ink);
  }
  .locked-title { font-size: 15px; font-weight: 650; margin-bottom: 6px; }
  .locked-text { font-size: 12.5px; color: var(--ink-3); line-height: 1.6; max-width: 300px; margin: 0 auto; }

  .done-box {
    display: flex; gap: 11px; align-items: flex-start;
    padding: 13px 14px; border-radius: 10px; margin-bottom: 14px;
    background: color-mix(in oklab, var(--ok, #157a4a) 9%, transparent);
    font-size: 13px; color: var(--ink-2); line-height: 1.5;
  }
  .done-icon {
    flex: none; width: 22px; height: 22px; border-radius: 999px;
    display: flex; align-items: center; justify-content: center;
    background: var(--ok, #157a4a); color: #fff;
  }
  .notice {
    padding: 11px 13px; border-radius: 9px; background: var(--surface-2);
    font-size: 12.5px; color: var(--ink-2); line-height: 1.5; margin-bottom: 16px;
  }
  .notice.bad { background: var(--bad-wash); color: var(--bad); border: 1px solid oklch(0.86 0.10 25); }
`;
