'use client';

import { getAccessToken } from '@/lib/auth';
import { useState } from 'react';
import { useT } from '@/app/components/LangProvider';

/**
 * "Beleg herunterladen" action. Fetches the receipt PDF for the order this
 * ticket belongs to and hands it to the browser as a download.
 *
 * Two identities, one button: a signed-in buyer authenticates with their session
 * token (the route checks wallet ownership), a guest passes the order token
 * from their /order/<token> link. Orders that cost nothing — free tickets, box
 * office cash — have no receipt; the route says so and the message is shown
 * as-is rather than dressed up as a failure.
 */
export function ReceiptButton({
  assetId,
  orderToken,
  label,
}: {
  assetId?: string;
  orderToken?: string;
  label?: string;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (!orderToken) {
        const token = await getAccessToken();
        headers.Authorization = `Bearer ${token ?? ''}`;
      }

      const res = await fetch('/api/tickets/receipt', {
        method: 'POST',
        headers,
        body: JSON.stringify(orderToken ? { orderToken } : { assetId }),
      });
      const json = (await res.json()) as {
        success: boolean; receiptNo?: string; pdfBase64?: string; error?: string;
      };
      if (!json.success || !json.pdfBase64) {
        setError(json.error ?? 'Der Beleg konnte nicht erstellt werden.');
        return;
      }

      const bytes = Uint8Array.from(atob(json.pdfBase64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `passly-beleg-${json.receiptNo ?? 'bestellung'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Netzwerkfehler. Bitte erneut versuchen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn ghost sm"
        style={{ justifyContent: 'center', width: '100%' }}
        disabled={busy}
        onClick={() => void download()}
      >
        {busy ? t('ticket.receiptBusy') : label ?? t('ticket.receipt')}
      </button>
      {error && (
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5, marginTop: 6, textAlign: 'center' }}>
          {error}
        </div>
      )}
    </>
  );
}
