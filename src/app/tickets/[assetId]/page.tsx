import { Epilogue, Unbounded } from 'next/font/google';
import { notFound } from 'next/navigation';
import TicketClient from './TicketClient';

const unbounded = Unbounded({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '600', '900'],
  display: 'swap',
});

const epilogue = Epilogue({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500'],
  display: 'swap',
});

interface DasAsset {
  content?: { metadata?: { name?: string; attributes?: { trait_type: string; value: string }[] } };
  ownership?: { owner?: string };
}

async function getAsset(assetId: string): Promise<DasAsset | null> {
  const apiKey = process.env.HELIUS_API_KEY ?? '';
  const res = await fetch(`https://devnet.helius-rpc.com/?api-key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'get-asset', method: 'getAsset', params: { id: assetId } }),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: DasAsset };
  return json.result ?? null;
}

async function signQrToken(payload: object): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET ?? 'fallback-secret';
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const payloadStr = JSON.stringify(payload);
  const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadStr));
  const sigHex = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${Buffer.from(payloadStr).toString('base64')}.${sigHex}`;
}

export default async function TicketPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const asset = await getAsset(assetId);

  if (!asset) notFound();

  const name = asset.content?.metadata?.name ?? 'Unknown Event';
  const owner = asset.ownership?.owner ?? '';
  const dateAttr = asset.content?.metadata?.attributes?.find((a) => a.trait_type === 'Date');
  const date = dateAttr?.value ?? '';

  const qrPayload = { assetId, owner, exp: Date.now() + 300_000 };
  const qrToken = await signQrToken(qrPayload);

  const shortId = `#PSL-${assetId.slice(-4).toUpperCase()}`;

  return (
    <>
      <style>{`
        :root {
          --color-bg:         oklch(0.10 0.014 258);
          --color-surface:    oklch(0.14 0.014 258);
          --color-border:     oklch(0.22 0.016 258);
          --color-text:       oklch(0.96 0.008 95);
          --color-text-muted: oklch(0.48 0.012 250);
          --color-accent:     oklch(0.72 0.118 148);
        }

        html, body { margin: 0; padding: 0; background: var(--color-bg); }

        .ticket-root {
          font-family: var(--font-body);
          background-color: var(--color-bg);
          background-image: radial-gradient(circle, oklch(0.23 0.014 258 / 0.45) 1px, transparent 1px);
          background-size: 28px 28px;
          color: var(--color-text);
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          box-sizing: border-box;
        }

        .ticket-card {
          width: 100%;
          max-width: 400px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          animation: fadeUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) { .ticket-card { animation: none; } }

        .ticket-header {
          padding: 28px 32px 24px;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ticket-eyebrow {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-accent);
        }

        .ticket-name {
          font-family: var(--font-display);
          font-size: clamp(18px, 3.5vw, 22px);
          font-weight: 900;
          letter-spacing: -0.02em;
          color: var(--color-text);
          margin: 0;
        }

        .ticket-date {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-muted);
          margin-top: 2px;
        }

        .ticket-qr {
          padding: 28px 32px;
          display: flex;
          justify-content: center;
          border-bottom: 1px solid var(--color-border);
        }

        .ticket-meta {
          padding: 20px 32px 28px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .ticket-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .ticket-row-label {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        .ticket-row-value {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--color-text);
        }

        .ticket-row-value.accent { color: var(--color-accent); }

        .ticket-brand {
          margin-top: 28px;
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-text-muted);
          text-align: center;
        }

        .ticket-brand span { color: var(--color-accent); }
      `}</style>

      <div className={`ticket-root ${unbounded.variable} ${epilogue.variable}`}>
        <div className="ticket-card">
          <div className="ticket-header">
            <div className="ticket-eyebrow">Your Ticket</div>
            <h1 className="ticket-name">{name}</h1>
            {date && <div className="ticket-date">{date}</div>}
          </div>

          <div className="ticket-qr">
            <TicketClient qrToken={qrToken} />
          </div>

          <div className="ticket-meta">
            <div className="ticket-row">
              <div className="ticket-row-label">Ticket ID</div>
              <div className="ticket-row-value accent">{shortId}</div>
            </div>
            <div className="ticket-row">
              <div className="ticket-row-label">Owner</div>
              <div className="ticket-row-value">
                {owner ? `${owner.slice(0, 4)}...${owner.slice(-4)}` : '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="ticket-brand">Passly<span>.</span></div>
      </div>
    </>
  );
}
