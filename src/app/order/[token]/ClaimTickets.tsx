'use client';

import { getAccessToken, useAuth, useWallets as useSolanaWallets } from '@/lib/auth';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * The one action on a guest order page: sign in, which moves the tickets out of
 * operator escrow into the buyer's own account and makes the rotating QR
 * available. Until this happens no scannable code exists anywhere — that is
 * deliberate, see the page component.
 */
export function ClaimTickets({ token, count }: { token: string; count: number }) {
  const { ready, authenticated, login } = useAuth();
  const { wallets } = useSolanaWallets();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  const wallet = wallets[0]?.address;

  async function claim(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const authToken = await getAccessToken();
      const res = await fetch('/api/guest-order/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken ?? ''}` },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Freischalten fehlgeschlagen.');
        return;
      }
      // Straight to the ticket; the rotating QR lives there.
      router.push('/my-tickets');
    } catch {
      setError('Netzwerkfehler. Bitte versuch es erneut.');
    } finally {
      setBusy(false);
    }
  }

  // Resume automatically once the login the user just started produced a wallet.
  useEffect(() => {
    if (!pending.current || !ready || !authenticated || !wallet) return;
    pending.current = false;
    void claim();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-running on wallet arrival is the intent
  }, [ready, authenticated, wallet]);

  function handleClick(): void {
    if (!ready || busy) return;
    if (!authenticated || !wallet) {
      pending.current = true;
      if (!authenticated) login();
      return;
    }
    void claim();
  }

  const waitingForWallet = authenticated && !wallet;

  return (
    <div className="claim-box">
      <button
        type="button"
        className="btn primary lg"
        onClick={handleClick}
        disabled={busy || !ready || waitingForWallet}
      >
        {busy
          ? 'Wird freigeschaltet …'
          : waitingForWallet
          ? 'Konto wird eingerichtet …'
          : count > 1
          ? 'Anmelden und Tickets anzeigen'
          : 'Anmelden und Ticket anzeigen'}
      </button>
      <div className="claim-hint">
        Es genügt deine E-Mail-Adresse, kein Passwort. Nimm am besten die, mit der du bezahlt hast.
      </div>
      {error && <div className="claim-error">{error}</div>}

      <style>{`
        .claim-box { text-align: center; }
        .claim-box .btn { width: 100%; justify-content: center; }
        .claim-hint { font-size: 11.5px; color: var(--ink-4); line-height: 1.55; margin-top: 10px; }
        .claim-error { font-size: 12px; color: var(--bad); margin-top: 10px; line-height: 1.5; }
      `}</style>
    </div>
  );
}
