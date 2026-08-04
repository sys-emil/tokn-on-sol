import bs58 from 'bs58';
import { backupChallenge } from '@/lib/backupChallenge';

export interface BackupPersonView {
  firstName: string;
  lastName: string;
  birthDate: string;
}

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
 * same ticket; the sync response reports those as conflicts instead of
 * pretending offline mode has a global lock.
 */

export interface SnapshotTicket {
  a: string; // assetId
  w: string; // owner wallet
  r: 0 | 1; // redeemed (for THIS event; a season pass may be used at others)
  x: 0 | 1; // revoked
  p?: 1; // season pass, admitted to this date among others
  d?: 1; // re-entry: guest is currently inside
  ls?: string; // re-entry: ISO timestamp of the last in/out scan
}

/** Per-event re-entry configuration, mirrored into the snapshot. */
export interface SnapshotReentry {
  enabled: boolean;
  cooldownSeconds: number;
}

export type ScanDirection = 'in' | 'out';

/** Offline in/out scans this device made, keyed by asset ID. */
export type LocalScanState = ReadonlyMap<string, { direction: ScanDirection; at: string }>;

/** Price categories, so the door can sell without a second request. */
export interface SnapshotTier {
  id: string;
  name: string;
  priceCents: number;
}

export interface Snapshot {
  generatedAt: string;
  cancelled: boolean;
  tickets: SnapshotTicket[];
  /** Absent in snapshots cached before the box office existed. */
  tiers?: SnapshotTier[];
  /** Absent in snapshots cached before re-entry existed; off is the default. */
  reentry?: SnapshotReentry;
}

export interface PendingRedemption {
  assetId: string;
  at: string;
  /**
   * Per-entry key. A re-entry event queues several scans of the same ticket,
   * so the asset ID stops identifying a queue entry. Absent on entries queued
   * before re-entry existed.
   */
  id?: string;
  /** Re-entry events only; absent entries are plain admissions. */
  direction?: ScanDirection;
}

export type OfflineVerdict =
  | { valid: true; assetId: string; backup?: boolean; person?: BackupPersonView; seasonPass?: boolean; direction?: ScanDirection }
  | { valid: false; reason: string; redeemedAt?: string; retryInSeconds?: number; direction?: ScanDirection };

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
    // storage full/blocked; offline mode simply won't have fresh data
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
    // keep going; the in-memory queue still syncs while the tab lives
  }
}

/**
 * Which side of the door a ticket is on, from the snapshot and this device's
 * own unsynced scans. Whichever of the two is more recent wins: the snapshot
 * may already carry another device's newer scan, our local one may be newer
 * than the last refresh.
 */
function effectiveState(
  ticket: SnapshotTicket,
  local: { direction: ScanDirection; at: string } | undefined,
): { inside: boolean; at: string | undefined } {
  const snapAt = ticket.ls;
  const useLocal = local && (!snapAt || new Date(local.at).getTime() >= new Date(snapAt).getTime());
  if (useLocal && local) return { inside: local.direction === 'in', at: local.at };
  return { inside: ticket.d === 1, at: snapAt };
}

/** How many guests are currently inside, for the doorman's counter. */
export function countInside(snapshot: Snapshot | null, localScans: LocalScanState): number {
  if (!snapshot?.reentry?.enabled) return 0;
  let n = 0;
  for (const ticket of snapshot.tickets) {
    if (ticket.x === 1) continue;
    if (effectiveState(ticket, localScans.get(ticket.a)).inside) n += 1;
  }
  return n;
}

/** Verify a scanned QR token entirely locally against the cached snapshot. */
export async function verifyOffline(
  rawToken: string,
  snapshot: Snapshot | null,
  locallyRedeemed: ReadonlySet<string>,
  localScans: LocalScanState = new Map(),
): Promise<OfflineVerdict> {
  if (!snapshot) {
    return { valid: false, reason: 'Offline und keine Ticketliste geladen' };
  }

  let payload: { a?: string; t?: number; w?: string; s?: string; b?: number; p?: { f: string; l: string; d: string } };
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
  const person = isBackup && payload.p
    ? { firstName: payload.p.f, lastName: payload.p.l, birthDate: payload.p.d }
    : undefined;

  // Same replay window as the server: current or previous minute. Backup
  // tickets are static by design (saved in advance for dead spots); no
  // window; once-only redemption + printed ID personalization carry it.
  if (!isBackup) {
    const nowMinute = Math.floor(Date.now() / 60000);
    if (t !== nowMinute && t !== nowMinute - 1) {
      return { valid: false, reason: 'QR code expired' };
    }
  }

  // Ed25519 signature check; identical challenge to the server route. For
  // backup tickets the identity (payload.p) is bound in, so editing a name
  // on a shared QR breaks the signature here too.
  const challenge = isBackup ? backupChallenge(assetId, person) : `passly:verify:${assetId}:${t}`;
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

  // Re-entry: the same scan toggles in/out instead of burning the ticket. The
  // cooldown is enforced against this device's own scans plus the snapshot's
  // last known one — the server can't help while we're offline, so a second
  // device in a dead spot is the same known trade-off as everywhere here.
  if (snapshot.reentry?.enabled) {
    const state = effectiveState(ticket, localScans.get(assetId));
    const lastAt = state.at;
    const inside = state.inside;

    if (lastAt) {
      const elapsed = (Date.now() - new Date(lastAt).getTime()) / 1000;
      if (elapsed < snapshot.reentry.cooldownSeconds) {
        return {
          valid: false,
          reason: 'Cooldown',
          redeemedAt: lastAt,
          retryInSeconds: Math.max(1, Math.ceil(snapshot.reentry.cooldownSeconds - elapsed)),
          direction: inside ? 'in' : 'out',
        };
      }
    }

    return {
      valid: true,
      assetId,
      backup: isBackup,
      person,
      seasonPass: ticket.p === 1,
      direction: inside ? 'out' : 'in',
    };
  }

  if (ticket.r === 1 || locallyRedeemed.has(assetId)) {
    return { valid: false, reason: 'Already redeemed' };
  }

  return { valid: true, assetId, backup: isBackup, person, seasonPass: ticket.p === 1 };
}
