'use client';

import { useSignMessage, useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import bs58 from 'bs58';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/track';

export default function TicketClient({ assetId }: { assetId: string }) {
  const { wallets } = useSolanaWallets();
  const { signMessage } = useSignMessage();
  const wallet = wallets[0];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'refreshing'>('loading');
  // Bumped on every fresh signature, restarts the drain bar below the QR so
  // door staff and guests can see the code is alive and current.
  const [cycle, setCycle] = useState(0);
  const hadQr = useRef(false);

  useEffect(() => {
    track('ticket_viewed');
  }, [assetId]);

  useEffect(() => {
    if (!wallet) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function sign(): Promise<void> {
      if (cancelled) return;
      const walletObj = wallet;
      if (!walletObj) return;

      setStatus(hadQr.current ? 'refreshing' : 'loading');

      try {
        const t = Math.floor(Date.now() / 60000);
        const challenge = `passly:verify:${assetId}:${t}`;
        const msgBytes = new TextEncoder().encode(challenge);
        // Every signature is silent, the first one included. Opening your own
        // ticket IS the intent to see the code, so a confirmation dialog asks
        // a question that was already answered — and it asked it at the worst
        // possible moment, with the guest standing at the door. The per-minute
        // refreshes were silent from the start; a popup every 55 s would have
        // made the ticket unusable.
        const output = await signMessage({
          message: msgBytes,
          wallet: walletObj,
          options: { uiOptions: { showWalletUIs: false } },
        });
        const s = bs58.encode(Uint8Array.from(output.signature));
        const payload = JSON.stringify({ a: assetId, t, w: walletObj.address, s });

        if (!cancelled && canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, payload, {
            width: 240,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: { dark: '#23263c', light: '#ffffff' },
          });
          hadQr.current = true;
          setStatus('ready');
          setCycle((c) => c + 1);
        }
      } catch {
        if (!cancelled) setStatus('loading');
      }

      if (!cancelled) {
        timer = setTimeout(() => { void sign(); }, 55_000);
      }
    }

    void sign();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wallet, assetId]);

  return (
    <div style={{ width: 240 }}>
      <style>{`
        @keyframes qrDrain { from { transform: scaleX(1); } to { transform: scaleX(0); } }
        .qr-drain { transform-origin: left; animation: qrDrain 55s linear forwards; }
        @media (prefers-reduced-motion: reduce) { .qr-drain { animation: none; } }
      `}</style>
      <div style={{ position: 'relative', width: 240, height: 240 }}>
        <canvas
          ref={canvasRef}
          width={240}
          height={240}
          role="img"
          aria-label="Dein persönlicher Einlass-Code, beim Einlass einscannen lassen"
          style={{ display: 'block', opacity: status === 'loading' ? 0 : 1 }}
        />
        {status !== 'ready' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontFamily: 'inherit',
            color: '#23263c',
            letterSpacing: '0.08em',
          }}>
            {status === 'refreshing' ? 'wird aktualisiert …' : 'wird erstellt …'}
          </div>
        )}
      </div>
      {cycle > 0 && (
        <div
          aria-hidden="true"
          style={{ height: 3, borderRadius: 2, background: '#eceef6', marginTop: 10, overflow: 'hidden' }}
        >
          <div key={cycle} className="qr-drain" style={{ height: '100%', borderRadius: 2, background: '#23263c' }} />
        </div>
      )}
    </div>
  );
}
