'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { EventEditor, EventEditorSkeleton, INITIAL_DRAFT } from '@/app/components/EventEditor';
import type { EventDraft } from '@/app/components/EventEditor';
import { isFeePayer, type FeePayer } from '@/lib/fees';

/**
 * Veranstaltung bearbeiten — derselbe Editor wie beim Anlegen, nur mit den
 * echten Werten vorbefuellt. Eigene Route statt Schublade, weil die
 * Live-Vorschau die Breite braucht; beim Bearbeiten ist sie sogar
 * nuetzlicher, weil man sieht, was man kaputtmacht.
 */
export default function EditEventPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const eventId = params?.id ?? '';
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const ownerWallet = solanaWallets[0]?.address ?? '';

  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (!ownerWallet || !eventId) return;
    async function load(): Promise<void> {
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token ?? ''}` };
      const [evRes, orgRes] = await Promise.all([
        fetch(`/api/organizer/event?id=${eventId}`, { headers }),
        fetch(`/api/organizers/status?walletAddress=${ownerWallet}`, { headers }),
      ]);
      if (!evRes.ok) { setError('Event nicht gefunden.'); return; }
      const data = (await evRes.json()) as {
        event: {
          name: string; date: string; start_time: string | null; venue: string | null;
          description: string | null; long_description: string | null;
          image_url: string | null; gallery_urls: string[] | null;
          accent_hue: number | null; border_style: string | null;
          is_private: boolean; payout_hold_days: number; resale_max_markup_pct: number | null;
          fee_payer: FeePayer | null;
          guest_checkout_enabled: boolean; queue_enabled: boolean; queue_slots: number;
          reentry_enabled: boolean; reentry_cooldown_seconds: number;
          tickets_sold: number; cancelled_at: string | null;
        };
        tiers: { id: string; name: string; price_eur: number; capacity: number; tickets_sold: number; tickets_reserved: number }[];
      };
      if (data.event.cancelled_at) { setError('Ein abgesagtes Event kann nicht mehr bearbeitet werden.'); return; }

      if (orgRes.ok) {
        const org = (await orgRes.json()) as { plan?: string };
        setIsPro(org.plan === 'pro');
      }

      const e = data.event;
      setDraft({
        ...INITIAL_DRAFT,
        name: e.name,
        date: e.date,
        startTime: e.start_time ?? '',
        venue: e.venue ?? '',
        description: e.description ?? '',
        longDescription: e.long_description ?? '',
        imageUrl: e.image_url,
        galleryUrls: e.gallery_urls ?? [],
        accentHue: e.accent_hue,
        borderStyle: e.border_style,
        isPrivate: e.is_private,
        payoutHoldDays: String(e.payout_hold_days ?? 0),
        feePayer: isFeePayer(e.fee_payer) ? e.fee_payer : 'buyer',
        resaleEnabled: e.resale_max_markup_pct != null,
        resaleMaxMarkup: String(e.resale_max_markup_pct ?? 20),
        guestCheckout: e.guest_checkout_enabled !== false,
        queueEnabled: e.queue_enabled === true,
        queueSlots: String(e.queue_slots ?? 50),
        reentryEnabled: e.reentry_enabled === true,
        reentryCooldownMinutes: String(Math.round((e.reentry_cooldown_seconds ?? 120) / 60)),
        ticketsSold: e.tickets_sold,
        tiers: data.tiers.map((t) => ({
          id: t.id,
          name: t.name,
          priceEur: String(t.price_eur / 100),
          capacity: String(t.capacity),
          committed: t.tickets_sold + t.tickets_reserved,
        })),
      });
    }
    void load();
  }, [ownerWallet, eventId, getAccessToken]);

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="app">
        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <div className="nav">
              <Link href="/dashboard">Übersicht</Link>
            </div>
          </div>
        </div>

        <div className="main">
          <div className="container new-event">
            <div className="new-event-head">
              <Link href={`/dashboard/events/${eventId}`} className="back"><Icon name="chevronLeft" size={14} /> Zurück zum Event</Link>
              <h1>Veranstaltung bearbeiten</h1>
              <p>Links siehst du sofort, wie sich die Änderung bei den Gästen auswirkt.</p>
            </div>

            {error ? (
              <div className="card" style={{ padding: 32 }}>
                <p style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>{error}</p>
                <Link href={`/dashboard/events/${eventId}`} className="btn ghost" style={{ marginTop: 16 }}>Zurück</Link>
              </div>
            ) : !draft || !ownerWallet ? (
              <EventEditorSkeleton />
            ) : (
              <EventEditor
                mode="edit"
                initial={draft}
                eventId={eventId}
                ownerWallet={ownerWallet}
                isPro={isPro}
                onSaved={() => router.push(`/dashboard/events/${eventId}`)}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const PAGE_CSS = `
  .new-event { max-width: 1440px; padding-top: 28px; }
  .new-event-head { margin-bottom: 22px; }
  .new-event-head .back {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 13px; color: var(--ink-3); margin-bottom: 12px;
  }
  .new-event-head .back:hover { color: var(--ink); }
  .new-event-head h1 { font-size: 30px; font-weight: 620; letter-spacing: -0.03em; }
  .new-event-head p { margin-top: 6px; font-size: 14px; color: var(--ink-3); }
  @media (max-width: 780px) { .new-event-head h1 { font-size: 24px; } }
`;
