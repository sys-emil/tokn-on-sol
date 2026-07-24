'use client';

import { useState } from 'react';
import { BackupTicketModal } from '@/app/components/BackupTicketModal';

/**
 * "Offline-Ticket erstellen" action on the ticket page: opens the backup-ticket
 * flow (personalized static QR PDF for venues without connectivity). Signing
 * needs the owner's wallet, so the modal's submit stays disabled for anyone but
 * the ticket owner (same trust model as the live QR on this page).
 */
export function BackupTicketButton({ assetId }: { assetId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn ghost sm"
        style={{ justifyContent: 'center', width: '100%' }}
        onClick={() => setOpen(true)}
      >
        Offline-Ticket erstellen
      </button>
      <BackupTicketModal assetIds={[assetId]} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
