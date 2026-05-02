'use client';

import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import bs58 from 'bs58';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';

export default function TicketClient({ assetId }: { assetId: string }) {
  const { wallets } = useSolanaWallets();
  const wallet = wallets[0];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'refreshing'>('loading');
  const hadQr = useRef(false);

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
        const output = await walletObj.signMessage({ message: msgBytes });
        const s = bs58.encode(Uint8Array.from(output.signature));
        const payload = JSON.stringify({ a: assetId, t, w: walletObj.address, s });

        if (!cancelled && canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, payload, {
            width: 260,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: { dark: '#1a1c26', light: '#f5f3ee' },
          });
          hadQr.current = true;
          setStatus('ready');
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
    <div style={{ position: 'relative', width: 260, height: 260 }}>
      <canvas
        ref={canvasRef}
        width={260}
        height={260}
        style={{ display: 'block', opacity: status === 'loading' ? 0 : 1 }}
      />
      {status !== 'ready' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: '#f5f3ee',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontFamily: 'inherit',
          color: '#1a1c26',
          letterSpacing: '0.08em',
        }}>
          {status === 'refreshing' ? 'refreshing…' : 'generating…'}
        </div>
      )}
    </div>
  );
}
