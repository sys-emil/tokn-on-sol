'use client';

import { getAccessToken, usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Optional upgrade path off the guest order page: sign in and pull every ticket
 * of the order out of escrow into a real account. After that the account's
 * rotating QR replaces the static one, so this also removes the copyable-code
 * trade-off for buyers who care.
 */
export function ClaimTickets({ token, count }: { token: string; count: number }) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useSolanaWallets();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  const wallet = wallets[0]?.address;

  async function claim(walletAddress: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const authToken = await getAccessToken();
      const res = await fetch('/api/guest-order/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken ?? ''}` },
        body: JSON.stringify({ token, claimerWallet: walletAddress }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Übernahme fehlgeschlagen.');
        return;
      }
      // The page recomputes owners and QR codes server-side.
      router.refresh();
    } catch {
      setError('Netzwerkfehler. Bitte versuch es erneut.');
    } finally {
      setBusy(false);
    }
  }

  // Resume automatically once the login the user just started has produced a wallet.
  useEffect(() => {
    if (!pending.current || !ready || !authenticated || !wallet) return;
    pending.current = false;
    void claim(wallet);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- claim is stable enough; re-running on wallet change is the intent
  }, [ready, authenticated, wallet]);

  function handleClick(): void {
    if (!ready || busy) return;
    if (!authenticated || !wallet) {
      pending.current = true;
      if (!authenticated) login();
      return;
    }
    void claim(wallet);
  }

  return (
    <div className="claim-box">
      <button type="button" className="btn ghost sm" onClick={handleClick} disabled={busy || !ready}>
        {busy ? 'Wird übernommen …' : count > 1 ? 'Tickets in mein Konto übernehmen' : 'Ticket in mein Konto übernehmen'}
      </button>
      <div className="claim-hint">
        Optional. Im Konto bekommst du einen QR, der sich jede Minute erneuert, und findest deine
        Tickets ohne diesen Link wieder.
      </div>
      {error && <div className="claim-error">{error}</div>}

      <style>{`
        .claim-box { border-top: 1px solid var(--surface-3); padding-top: 16px; margin-top: 4px; text-align: center; }
        .claim-box .btn { width: 100%; justify-content: center; }
        .claim-hint { font-size: 11.5px; color: var(--ink-4); line-height: 1.55; margin-top: 9px; }
        .claim-error { font-size: 12px; color: var(--bad); margin-top: 9px; line-height: 1.5; }
      `}</style>
    </div>
  );
}
