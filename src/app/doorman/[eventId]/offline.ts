import bs58 from 'bs58';

/**
 * Offline verification layer for the doorman scanner.
 *
 * While online, every scan goes to /api/tickets/verify (signature +
 * on-chain ownership + atomic redemption). In a dead spot the doorman keeps
 * working from a snapshot (/api/organizer/event/snapshot, cached in
 * localStorage): the Ed25519 signature and minute freshness are checked
 * locally, ownership against the snapshot's buyer wallet, and once-only
 * redemption against snapshot + local queue. Queued redemptions sync back
 * through /api/tickets/redeem-offline when the connection returns.
 *
 * Deliberate trade-off: two devices offline at once could both admit the
 * same ticket — the sync response reports those as conflicts instead of
 * pretending offline mode has a global lock.
 */

export interface SnapshotTicket {
  a: string; // assetId
  w: string; // owner wallet
  r: 0 | 1; // redeemed
  x: 0 | 1; // revoked
}

export interface Snapshot {
  generatedAt: string;
  cancelled: boolean;
  tickets: SnapshotTicket[];
}

export interface PendingRedemption {
  assetId: string;
  at: string;
}

export type OfflineVerdict =
  | { valid: true; assetId: string; backup?: boolean }
  | { valid: false; reason: string; redeemedAt?: string };

const snapshotKey = (eventId: string) => `passly-doorman-snapshot-${eventId}`;
const pendingKey = (eventId: string) => `passly-doorman-pending-${eventId}`;

export function loadSnapshot(eventId: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(snapshotKey(eventId));
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

export function saveSnapshot(eventId: string, snapshot: Snapshot): void {
  try {
    localStorage.setItem(snapshotKey(eventId), JSON.stringify(snapshot));
  } catch {
    // storage full/blocked — offline mode simply won't have fresh data
  }
}

export function loadPending(eventId: string): PendingRedemption[] {
  try {
    const raw = localStorage.getItem(pendingKey(eventId));
    return raw ? (JSON.parse(raw) as PendingRedemption[]) : [];
  } catch {
    return [];
  }
}

export function savePending(eventId: string, pending: PendingRedemption[]): void {
  try {
    localStorage.setItem(pendingKey(eventId), JSON.stringify(pending));
  } catch {
    // keep going — the in-memory queue still syncs while the tab lives
  }
}

/** Verify a scanned QR token entirely locally against the cached snapshot. */
export async function verifyOffline(
  rawToken: string,
  snapshot: Snapshot | null,
  locallyRedeemed: ReadonlySet<string>,
): Promise<OfflineVerdict> {
  if (!snapshot) {
    return { valid: false, reason: 'Offline und keine Ticketliste geladen' };
  }

  let payload: { a?: string; t?: number; w?: string; s?: string; b?: number };
  try {
    payload = JSON.parse(rawToken) as typeof payload;
  } catch {
    return { valid: false, reason: 'Invalid QR code' };
  }
  const { a: assetId, t, w: walletAddress, s: sigBase58 } = payload;
  const isBackup = payload.b === 1;
  if (!assetId || (!isBackup && typeof t !== 'number') || !walletAddress || !sigBase58) {
    return { valid: false, reason: 'Invalid QR code' };
  }

  // Same replay window as the server: current or previous minute. Backup
  // tickets are static by design (saved in advance for dead spots) — no
  // window; once-only redemption + printed ID personalization carry it.
  if (!isBackup) {
    const nowMinute = Math.floor(Date.now() / 60000);
    if (t !== nowMinute && t !== nowMinute - 1) {
      return { valid: false, reason: 'QR code expired' };
    }
  }

  // Ed25519 signature check — identical challenge to the server route.
  const challenge = isBackup ? `passly:backup:${assetId}` : `passly:verify:${assetId}:${t}`;
  let signatureValid: boolean;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      Uint8Array.from(bs58.decode(walletAddress)),
      'Ed25519',
      false,
      ['verify'],
    );
    signatureValid = await crypto.subtle.verify(
      'Ed25519',
      key,
      Uint8Array.from(bs58.decode(sigBase58)),
      new TextEncoder().encode(challenge),
    );
  } catch {
    return { valid: false, reason: 'Dieses Gerät kann offline nicht prüfen (Browser zu alt)' };
  }
  if (!signatureValid) {
    return { valid: false, reason: 'Invalid signature' };
  }

  const ticket = snapshot.tickets.find((x) => x.a === assetId);
  if (!ticket) {
    return { valid: false, reason: 'Ticket not found' };
  }
  if (ticket.x === 1) {
    return { valid: false, reason: 'Ticket revoked (refunded)' };
  }
  if (ticket.w !== walletAddress) {
    return { valid: false, reason: 'Wallet does not own this ticket' };
  }
  if (ticket.r === 1 || locallyRedeemed.has(assetId)) {
    return { valid: false, reason: 'Already redeemed' };
  }

  return { valid: true, assetId, backup: isBackup };
}
