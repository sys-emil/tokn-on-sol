'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { EventEditor, INITIAL_DRAFT } from '@/app/components/EventEditor';
import type { EventDraft } from '@/app/components/EventEditor';

/**
 * Veranstaltung anlegen — mit Live-Vorschau statt Blindflug.
 *
 * Die Seite selbst ist duenn: Anmeldung pruefen, Wallet und Tarif holen, den
 * Rest macht `EventEditor`, den auch die Bearbeiten-Ansicht benutzt.
 */
export default function NewEventPage() {
  const router = useRouter();
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const ownerWallet = solanaWallets[0]?.address ?? '';

  const [orgStatus, setOrgStatus] = useState<'loading' | 'none' | 'approved'>('loading');
  const [isPro, setIsPro] = useState(false);
  const [prefill, setPrefill] = useState<EventDraft | null>(null);
  const [prefillRead, setPrefillRead] = useState(false);

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  // „Event duplizieren" auf der Detailseite legt die Vorlage in sessionStorage
  // ab und navigiert hierher. Das Datum bleibt bewusst leer — eine Kopie ist
  // fast immer ein neuer Termin.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('passly_duplicate_event');
      sessionStorage.removeItem('passly_duplicate_event');
      if (raw) {
        const d = JSON.parse(raw) as {
          name?: string; startTime?: string | null; venue?: string | null; description?: string | null;
          isPrivate?: boolean; payoutHoldDays?: number; accentHue?: number | null; borderStyle?: string | null;
          resaleMaxMarkupPct?: number | null;
          tiers?: { name: string; priceEur: string; capacity: string }[];
        };
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of sessionStorage, runs once on mount
        setPrefill({
          ...INITIAL_DRAFT,
          name: d.name ?? '',
          startTime: d.startTime ?? '',
          venue: d.venue ?? '',
          description: d.description ?? '',
          isPrivate: d.isPrivate === true,
          payoutHoldDays: String(d.payoutHoldDays ?? 0),
          accentHue: d.accentHue ?? null,
          borderStyle: d.borderStyle ?? null,
          resaleEnabled: d.resaleMaxMarkupPct != null,
          resaleMaxMarkup: String(d.resaleMaxMarkupPct ?? 20),
          tiers: d.tiers && d.tiers.length > 0 ? d.tiers : INITIAL_DRAFT.tiers,
        });
      }
    } catch { /* corrupt entry, ignore */ }
    setPrefillRead(true);
  }, []);

  useEffect(() => {
    if (!ownerWallet) return;
    async function check(): Promise<void> {
      const token = await getAccessToken();
      const res = await fetch(`/api/organizers/status?walletAddress=${ownerWallet}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setOrgStatus('none'); return; }
      const data = (await res.json()) as { status: string; plan?: string };
      setOrgStatus(data.status === 'approved' ? 'approved' : 'none');
      setIsPro(data.plan === 'pro');
    }
    void check();
  }, [ownerWallet, getAccessToken]);

  const loading = !ready || !prefillRead || orgStatus === 'loading' || !ownerWallet;

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
              <Link href="/dashboard" className="back"><Icon name="chevronLeft" size={14} /> Dashboard</Link>
              <h1>Neue Veranstaltung</h1>
            </div>

            {loading ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Lädt …</div>
            ) : orgStatus !== 'approved' ? (
              <div className="card" style={{ padding: 32 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Noch nicht freigeschaltet</h3>
                <p style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                  Veranstaltungen kannst du anlegen, sobald dein Veranstalter-Konto geprüft ist.
                </p>
                <Link href="/become-organizer" className="btn primary" style={{ marginTop: 16 }}>
                  Zum Antrag <Icon name="arrow" size={13} />
                </Link>
              </div>
            ) : (
              <EventEditor
                mode="create"
                initial={prefill ?? undefined}
                ownerWallet={ownerWallet}
                isPro={isPro}
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
  @media (max-width: 780px) {
    .new-event-head h1 { font-size: 24px; }
  }
`;
