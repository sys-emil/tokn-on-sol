'use client';

import jsQR from 'jsqr';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/app/components/passlyUi';
import { LegalLinks } from '@/app/components/LegalLinks';
import { BoxOffice } from './BoxOffice';
import type { FeePayer } from '@/lib/fees';
import {
  countInside,
  loadPending,
  loadSnapshot,
  savePending,
  saveSnapshot,
  verifyOffline,
  type BackupPersonView,
  type LocalScanState,
  type PendingRedemption,
  type ScanDirection,
  type Snapshot,
  type SnapshotTier,
} from './offline';

interface EventData {
  id: string;
  name: string;
  date: string;
  organizer_wallet: string;
}

type Phase =
  | { tag: 'loading' }
  | { tag: 'denied' }
  | { tag: 'camera-error'; message: string }
  | { tag: 'scanning' }
  | { tag: 'verifying' }
  | { tag: 'result-valid'; assetId: string; eventName: string; redeemedAt: string; offline?: boolean; backup?: boolean; person?: BackupPersonView; awaitConfirm?: boolean; seasonPass?: boolean; direction?: ScanDirection }
  | { tag: 'result-used'; redeemedAt: string }
  | { tag: 'result-cooldown'; direction: ScanDirection; retryInSeconds: number; lastScanAt?: string }
  | { tag: 'result-invalid'; reason: string };

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// One key per queued scan; re-entry queues several scans of the same ticket.
function newScanId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function shortId(assetId: string): string {
  return `#PSL-${assetId.slice(-4).toUpperCase()}`;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
}

function agoLabel(iso: string, nowTs: number): string {
  const sec = Math.max(0, Math.floor((nowTs - new Date(iso).getTime()) / 1000));
  if (sec < 10) return 'gerade eben';
  if (sec < 60) return `vor ${sec} s`;
  return `vor ${Math.floor(sec / 60)} min`;
}

function formatCooldown(seconds: number): string {
  if (seconds < 60) return `${seconds} Sekunden`;
  const min = Math.round(seconds / 60);
  return `${min} Minute${min === 1 ? '' : 'n'}`;
}

// The verify API returns English reason strings, translate the ones the
// doorman needs to act on differently; everything else is a generic reject.
function reasonDe(reason: string): string {
  switch (reason) {
    case 'QR code expired': return 'Der QR-Code ist abgelaufen. Gast soll die Ticketseite neu laden.';
    case 'Ticket revoked (refunded)': return 'Dieses Ticket wurde storniert (Kauf erstattet).';
    case 'Wallet does not own this ticket': return 'Das Ticket gehört einem anderen Konto.';
    case 'Ticket not found': return 'Kein passendes Ticket gefunden.';
    case 'Netzwerkfehler. Bitte erneut versuchen.': return reason;
    default: return 'Kein gültiges Ticket erkannt.';
  }
}

const PAGE_CSS = `
  .door-root {
    min-height: 100dvh;
    display: flex; flex-direction: column;
    background: var(--surface-2);
  }

  .door-header {
    background: color-mix(in oklab, var(--surface) 92%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--line);
    padding: 14px 20px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    flex-shrink: 0; z-index: 10;
  }

  .door-counters {
    padding: 12px 20px 0;
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
    flex-shrink: 0;
  }
  .door-counter {
    padding: 10px 12px;
    background: var(--surface);
    border-radius: 10px;
    border: 1px solid var(--line);
  }
  .door-counter .l {
    font-size: 10.5px; color: var(--ink-3);
    letter-spacing: 0.04em; text-transform: uppercase;
  }
  .door-counter .v {
    font-size: 18px; font-weight: 600; letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  .scanner-wrap {
    flex: 1;
    margin: 14px 20px;
    position: relative;
    background: oklch(0.24 0.02 275);
    overflow: hidden;
    min-height: 0;
    border-radius: 18px;
  }

  .scanner-video {
    width: 100%; height: 100%;
    object-fit: cover; display: block;
    position: absolute; inset: 0;
  }

  .corners span {
    position: absolute; width: 30px; height: 30px;
    border: 3px solid white; border-radius: 6px;
    z-index: 3;
  }
  .corners .tl { top: 14%; left: 14%; border-right: none; border-bottom: none; }
  .corners .tr { top: 14%; right: 14%; border-left: none; border-bottom: none; }
  .corners .bl { bottom: 14%; left: 14%; border-right: none; border-top: none; }
  .corners .br { bottom: 14%; right: 14%; border-left: none; border-top: none; }

  .beam {
    position: absolute; left: 14%; right: 14%; top: 14%; bottom: 14%;
    overflow: hidden; border-radius: 6px; z-index: 3;
  }
  .beam::after {
    content: "";
    position: absolute; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, oklch(0.9 0.2 var(--hue)), transparent);
    box-shadow: 0 0 14px oklch(0.7 0.2 var(--hue));
    animation: sweep 2.2s ease-in-out infinite;
    top: 0;
  }
  @keyframes sweep {
    0% { top: 0; }
    50% { top: calc(100% - 2px); }
    100% { top: 0; }
  }
  @media (prefers-reduced-motion: reduce) { .beam::after { animation: none; top: 50%; } }

  .result-overlay {
    position: absolute; inset: 0; z-index: 5;
    display: grid; place-items: center;
    color: white;
    animation: fadeIn 0.2s;
    text-align: center;
    padding: 16px;
  }
  .result-circle {
    width: 72px; height: 72px; border-radius: 50%;
    background: white;
    display: grid; place-items: center;
    margin: 0 auto 10px;
  }

  .id-card {
    margin: 14px 0 4px;
    padding: 18px 16px;
    border-radius: 14px;
    background: rgba(255,255,255,0.14);
    border: 1px solid rgba(255,255,255,0.28);
  }
  .id-label {
    font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase;
    opacity: 0.72;
  }
  .id-name {
    font-size: 26px; font-weight: 700; letter-spacing: -0.02em;
    line-height: 1.15; margin-top: 3px;
  }
  .id-bday {
    font-size: 18px; font-weight: 600; margin-top: 2px;
    font-variant-numeric: tabular-nums;
  }
  .id-confirm {
    margin-top: 16px;
    width: 100%;
    padding: 15px;
    border: none; border-radius: 12px;
    background: white; color: oklch(0.40 0.14 150);
    font-size: 16px; font-weight: 700; font-family: inherit;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(0,0,0,0.22);
  }
  .id-confirm:active { transform: translateY(1px); }

  .spinner {
    width: 32px; height: 32px;
    border: 2.5px solid var(--line-2);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .door-foot {
    padding: 0 20px 18px;
    text-align: center;
    color: var(--ink-3);
    font-size: 12.5px;
    flex-shrink: 0;
  }

  .center-screen {
    min-height: 100dvh;
    display: grid; place-items: center;
    padding: 40px 20px;
    background:
      radial-gradient(1000px 500px at 50% -10%, var(--accent-wash), transparent 60%),
      var(--surface-2);
  }
`;

export default function DoormanPage() {
  const params = useParams();
  const eventId = typeof params.eventId === 'string' ? params.eventId : '';

  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const { wallets: solanaWallets } = useWallets();
  const walletAddress = solanaWallets[0]?.address;

  // Door access link (?key=…): venue staff scan without the organizer's
  // login. Read once via window; the key never appears in rendered output,
  // so the SSR/client difference can't cause a hydration mismatch.
  const [doorKey] = useState(() =>
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('key') ?? '',
  );
  const [keyStatus, setKeyStatus] = useState<'none' | 'checking' | 'granted'>(doorKey ? 'checking' : 'none');

  const [event, setEvent] = useState<EventData | null>(null);
  const [phase, setPhase] = useState<Phase>({ tag: 'loading' });
  const [scannedToday, setScannedToday] = useState(0);
  const [lastScan, setLastScan] = useState<string | null>(null);
  // Re-entry: guests may leave and come back, so the interesting number is
  // how many are inside right now, not how often we scanned.
  const [reentry, setReentry] = useState<{ enabled: boolean; cooldownSeconds: number } | null>(null);
  const [insideCount, setInsideCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processingRef = useRef(false);
  const loginPromptedRef = useRef(false);

  // ── Offline buffer ───────────────────────────────────────────────────
  // Snapshot + pending queue live in refs (and localStorage) so the scan
  // loop never re-renders; `online`/`pendingCount` drive the UI.
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [pendingCount, setPendingCount] = useState(0);
  const [snapshotReady, setSnapshotReady] = useState(false);
  // Kept in state, not read off the ref: the box office has to re-render when
  // the snapshot brings new price categories.
  const [tiers, setTiers] = useState<SnapshotTier[]>([]);
  const [feePayer, setFeePayer] = useState<FeePayer>('buyer');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [conflictCount, setConflictCount] = useState(0);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const snapshotRef = useRef<Snapshot | null>(null);
  const pendingRef = useRef<PendingRedemption[]>([]);
  const locallyRedeemedRef = useRef<Set<string>>(new Set());
  // Latest in/out scan this device made per ticket; overlays the snapshot so
  // the door state stays right between two 60 s refreshes and offline.
  const localScansRef = useRef<Map<string, { direction: ScanDirection; at: string }>>(new Map());
  const syncingRef = useRef(false);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Drives the "zuletzt synchronisiert vor X s" label; 5 s granularity is
  // enough and keeps re-renders away from the rAF scan loop.
  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);

  // Restore snapshot + queue from the last session (page reload in a dead spot).
  useEffect(() => {
    if (!eventId) return;
    snapshotRef.current = loadSnapshot(eventId);
    pendingRef.current = loadPending(eventId);
    locallyRedeemedRef.current = new Set(pendingRef.current.map((p) => p.assetId));
    // The queue is in scan order, so replaying it leaves the latest direction
    // per ticket — the door state this device had before the reload.
    localScansRef.current = new Map();
    for (const p of pendingRef.current) {
      if (p.direction) localScansRef.current.set(p.assetId, { direction: p.direction, at: p.at });
    }
    if (snapshotRef.current) {
      setSnapshotReady(true);
      // Snapshots cached before the box office existed carry no tiers; the
      // next online refresh fills them in.
      setTiers(snapshotRef.current.tiers ?? []);
      setFeePayer(snapshotRef.current.feePayer ?? 'buyer');
      setReentry(snapshotRef.current.reentry ?? null);
      setInsideCount(countInside(snapshotRef.current, localScansRef.current));
    }
    setPendingCount(pendingRef.current.length);
  }, [eventId]);

  const isOrganizer = Boolean(event && walletAddress && walletAddress === event.organizer_wallet);
  const hasDoorAccess = isOrganizer || keyStatus === 'granted';

  // Auth for the door APIs: the link token when present, the organizer's
  // Privy session otherwise.
  const doorAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (doorKey) return { 'x-door-token': doorKey };
    const token = await getAccessToken();
    return { Authorization: `Bearer ${token ?? ''}` };
  }, [doorKey, getAccessToken]);

  // One place where a freshly fetched snapshot becomes the live state, so the
  // key-check and the 60 s refresh can't drift apart.
  const adoptSnapshot = useCallback((snap: Snapshot) => {
    snapshotRef.current = snap;
    saveSnapshot(eventId, snap);
    setTiers(snap.tiers ?? []);
    setFeePayer(snap.feePayer ?? 'buyer');
    setSnapshotReady(true);
    setReentry(snap.reentry ?? null);
    setInsideCount(countInside(snap, localScansRef.current));
    setLastSyncAt(new Date().toISOString());
  }, [eventId]);

  // Key mode: validate the link by fetching the snapshot with it. 401 means
  // revoked/expired/wrong event → denied; success doubles as the first
  // snapshot load. Network failure falls back to a cached snapshot (reload
  // in a dead spot), otherwise the next attempt retries.
  useEffect(() => {
    if (!doorKey || !eventId || keyStatus !== 'checking') return;
    let cancelled = false;
    async function check(): Promise<void> {
      try {
        const res = await fetch(`/api/organizer/event/snapshot?id=${eventId}`, {
          headers: { 'x-door-token': doorKey },
        });
        if (cancelled) return;
        if (res.ok) {
          adoptSnapshot((await res.json()) as Snapshot);
          setKeyStatus('granted');
          setPhase((p) => (p.tag === 'loading' ? { tag: 'scanning' } : p));
        } else {
          setPhase({ tag: 'denied' });
        }
      } catch {
        if (cancelled) return;
        if (snapshotRef.current) {
          setKeyStatus('granted');
          setPhase((p) => (p.tag === 'loading' ? { tag: 'scanning' } : p));
        } else {
          setTimeout(() => { if (!cancelled) void check(); }, 3000);
        }
      }
    }
    void check();
    return () => { cancelled = true; };
  }, [doorKey, eventId, keyStatus, adoptSnapshot]);

  // Refresh the snapshot every 60 s while online; the cache the doorman
  // falls back to is at most a minute old when the connection drops.
  const refreshSnapshot = useCallback(async (): Promise<void> => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/organizer/event/snapshot?id=${eventId}`, {
        headers: await doorAuthHeaders(),
      });
      if (!res.ok) return;
      adoptSnapshot((await res.json()) as Snapshot);
    } catch {
      // offline or flaky; the cached snapshot keeps working
    }
  }, [eventId, doorAuthHeaders, adoptSnapshot]);

  useEffect(() => {
    if (!hasDoorAccess || !online || !eventId) return;
    // Deferred past the effect body so the first state update inside doesn't
    // trip react-hooks/set-state-in-effect.
    queueMicrotask(() => void refreshSnapshot());
    const timer = setInterval(() => void refreshSnapshot(), 60_000);
    return () => clearInterval(timer);
  }, [hasDoorAccess, online, eventId, refreshSnapshot]);

  // Push queued offline redemptions once the connection is back.
  useEffect(() => {
    if (!hasDoorAccess || !online || !eventId || pendingCount === 0 || syncingRef.current) return;
    async function sync(): Promise<void> {
      syncingRef.current = true;
      try {
        const res = await fetch('/api/tickets/redeem-offline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await doorAuthHeaders()) },
          body: JSON.stringify({ eventId, redemptions: pendingRef.current }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          synced: string[];
          conflicts: { key?: string; assetId: string; reason: string }[];
        };
        // Keyed per queue entry, not per ticket: a re-entry event queues
        // several scans of the same ticket and only the applied ones go.
        const handled = new Set([...data.synced, ...data.conflicts.map((c) => c.key ?? c.assetId)]);
        pendingRef.current = pendingRef.current.filter((p) => !handled.has(p.id ?? p.assetId));
        savePending(eventId, pendingRef.current);
        setPendingCount(pendingRef.current.length);
        setLastSyncAt(new Date().toISOString());
        if (data.conflicts.length > 0) {
          setConflictCount((n) => n + data.conflicts.length);
          console.warn('Offline-Scans mit Konflikt (an anderem Gerät bereits eingelöst?):', data.conflicts);
        }
      } catch {
        // still offline; retried on the next online tick
      } finally {
        syncingRef.current = false;
      }
    }
    void sync();
  }, [hasDoorAccess, online, eventId, pendingCount, doorAuthHeaders]);

  // Fetch event
  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/events/${eventId}`)
      .then((r) => r.json())
      .then((data: EventData) => setEvent(data))
      .catch(() => setEvent(null));
  }, [eventId]);

  // Auth + access check. login() may only fire once; this effect re-runs
  // when the event fetch resolves, and re-invoking login() mid-flow resets
  // the Privy modal so the e-mail code step never appears. In key mode the
  // access link replaces the login entirely (validated above).
  useEffect(() => {
    if (doorKey) return;
    if (!ready) return;
    if (!authenticated) {
      if (!loginPromptedRef.current) {
        loginPromptedRef.current = true;
        login();
      }
      return;
    }
    if (!event) return;
    if (!walletAddress) return;

    if (walletAddress !== event.organizer_wallet) {
      setTimeout(() => setPhase({ tag: 'denied' }), 0);
      return;
    }

    if (phase.tag === 'loading') {
      setTimeout(() => setPhase({ tag: 'scanning' }), 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doorKey, ready, authenticated, walletAddress, event]);

  // Records this device's view of a scan so the "aktuell drin" counter and
  // the offline cooldown are right before the next snapshot refresh lands.
  const noteScan = useCallback((assetId: string, direction: ScanDirection | undefined, at: string) => {
    if (!direction) return;
    localScansRef.current.set(assetId, { direction, at });
    setInsideCount(countInside(snapshotRef.current, localScansRef.current as LocalScanState));
  }, []);

  const handleQrResult = useCallback(async (raw: string) => {
    if (processingRef.current) return;
    processingRef.current = true;

    setPhase({ tag: 'verifying' });

    // Backup tickets pause on the result until the doorman confirms the ID
    // check (see confirmAndResume); everything else auto-advances after 3 s.
    let awaitConfirm = false;

    try {
      // 5 s budget for the live check; at the door a hanging request is
      // worse than falling back to the offline snapshot.
      const res = await fetch('/api/tickets/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await doorAuthHeaders()) },
        body: JSON.stringify({ token: raw, eventId }),
        signal: AbortSignal.timeout(5000),
      });
      const data = (await res.json()) as
        | { valid: true; assetId: string; eventName: string; redeemedAt: string; backup?: boolean; person?: BackupPersonView; seasonPass?: boolean; direction?: ScanDirection }
        | { valid: false; reason: string; redeemedAt?: string; direction?: ScanDirection; retryInSeconds?: number };

      if (data.valid) {
        locallyRedeemedRef.current.add(data.assetId);
        noteScan(data.assetId, data.direction, data.redeemedAt);
        // On a re-entry event only the arrivals are "eingelassen"; an exit is
        // a scan too, but counting it would inflate the head count.
        if (data.direction !== 'out') setScannedToday((n) => n + 1);
        setLastScan(new Date().toISOString());
        awaitConfirm = Boolean(data.backup);
        setPhase({ tag: 'result-valid', assetId: data.assetId, eventName: data.eventName, redeemedAt: data.redeemedAt, backup: data.backup, person: data.person, awaitConfirm, seasonPass: data.seasonPass, direction: data.direction });
      } else if (data.reason === 'Cooldown') {
        setPhase({
          tag: 'result-cooldown',
          direction: data.direction === 'out' ? 'out' : 'in',
          retryInSeconds: data.retryInSeconds ?? 0,
          lastScanAt: data.redeemedAt,
        });
      } else if (data.reason === 'Already redeemed') {
        setPhase({ tag: 'result-used', redeemedAt: data.redeemedAt ?? '' });
      } else {
        setPhase({ tag: 'result-invalid', reason: data.reason });
      }
    } catch {
      // Network gone; verify against the cached snapshot instead.
      setOnline(false);
      const verdict = await verifyOffline(raw, snapshotRef.current, locallyRedeemedRef.current, localScansRef.current);
      if (verdict.valid) {
        const at = new Date().toISOString();
        locallyRedeemedRef.current.add(verdict.assetId);
        pendingRef.current = [...pendingRef.current, {
          assetId: verdict.assetId,
          at,
          id: newScanId(),
          ...(verdict.direction ? { direction: verdict.direction } : {}),
        }];
        if (eventId) savePending(eventId, pendingRef.current);
        setPendingCount(pendingRef.current.length);
        noteScan(verdict.assetId, verdict.direction, at);
        if (verdict.direction !== 'out') setScannedToday((n) => n + 1);
        setLastScan(at);
        awaitConfirm = Boolean(verdict.backup);
        setPhase({ tag: 'result-valid', assetId: verdict.assetId, eventName: event?.name ?? '', redeemedAt: at, offline: true, backup: verdict.backup, person: verdict.person, awaitConfirm, seasonPass: verdict.seasonPass, direction: verdict.direction });
      } else if (verdict.reason === 'Cooldown') {
        setPhase({
          tag: 'result-cooldown',
          direction: verdict.direction === 'out' ? 'out' : 'in',
          retryInSeconds: verdict.retryInSeconds ?? 0,
          lastScanAt: verdict.redeemedAt,
        });
      } else if (verdict.reason === 'Already redeemed') {
        setPhase({ tag: 'result-used', redeemedAt: verdict.redeemedAt ?? '' });
      } else {
        setPhase({ tag: 'result-invalid', reason: verdict.reason });
      }
    }

    // Backup scans stay on screen (ID check) until the doorman taps "Weiter";
    // confirmAndResume clears processingRef and restarts the scanner.
    if (awaitConfirm) return;
    setTimeout(() => {
      processingRef.current = false;
      setPhase({ tag: 'scanning' });
    }, 3000);
  }, [eventId, event?.name, doorAuthHeaders, noteScan]);

  // Resume scanning after the doorman confirms a backup ticket's ID check.
  const confirmAndResume = useCallback(() => {
    processingRef.current = false;
    setPhase({ tag: 'scanning' });
  }, []);

  // Start / stop camera based on phase
  useEffect(() => {
    if (phase.tag !== 'scanning') return;

    const abortController = new AbortController();
    let stream: MediaStream | null = null;

    async function start() {
      if (!videoRef.current || !canvasRef.current) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();

        const canvas = canvasRef.current;
        const ctxOrNull = canvas.getContext('2d');
        if (!ctxOrNull) return;
        const ctx = ctxOrNull;

        let lastScanTs = 0;

        function scanFrame(now: number) {
          if (abortController.signal.aborted) return;
          const video = videoRef.current;
          if (!video || video.readyState < 2) {
            requestAnimationFrame(scanFrame);
            return;
          }
          // Throttle jsQR work to ~10fps; rAF keeps the preview smooth
          if (now - lastScanTs < 100) {
            requestAnimationFrame(scanFrame);
            return;
          }
          lastScanTs = now;

          // Downscale to ≤640px on long edge for faster processing
          const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
          const w = Math.round(video.videoWidth * scale);
          const h = Math.round(video.videoHeight * scale);
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(video, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (code?.data && !abortController.signal.aborted) {
            handleQrResult(code.data);
            return;
          }
          requestAnimationFrame(scanFrame);
        }
        requestAnimationFrame(scanFrame);
      } catch (err) {
        if (!abortController.signal.aborted) {
          const msg = err instanceof Error ? err.message : 'Kamera nicht verfügbar';
          setPhase({ tag: 'camera-error', message: msg });
        }
      }
    }

    void start();

    return () => {
      abortController.abort();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [phase.tag, handleQrResult]);

  const isResult = phase.tag === 'result-valid' || phase.tag === 'result-used'
    || phase.tag === 'result-invalid' || phase.tag === 'result-cooldown';

  return (
    <>
      <style>{PAGE_CSS}</style>

      {/* Loading / auth / access denied states */}
      {(phase.tag === 'loading' || !event) && phase.tag !== 'denied' && phase.tag !== 'camera-error' && (
        <div className="center-screen">
          <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 340 }}>
            <div className="spinner" style={{ margin: '0 auto 14px' }} />
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Einlass</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>Wird geladen …</div>
          </div>
        </div>
      )}

      {phase.tag === 'denied' && (
        <div className="center-screen">
          <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 380 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--bad-wash)', border: '1px solid oklch(0.86 0.10 25)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', color: 'var(--bad)' }}>
              <Icon name="x" size={20} />
            </div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>Kein Zugriff</div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.55, marginTop: 8 }}>
              {doorKey
                ? 'Dieser Einlass-Link ist abgelaufen oder wurde widerrufen. Bitte frag den Veranstalter nach einem neuen Link.'
                : 'Dieses Konto ist nicht der Veranstalter dieses Events. Melde dich mit dem Veranstalter-Konto an, um den Einlass-Modus zu öffnen.'}
            </p>
          </div>
        </div>
      )}

      {phase.tag === 'camera-error' && (
        <div className="center-screen">
          <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 380 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--warn-wash)', border: '1px solid oklch(0.86 0.09 70)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', color: 'var(--warn)' }}>
              <Icon name="camera" size={20} />
            </div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>Kamera nicht verfügbar</div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.55, marginTop: 8 }}>{phase.message}</p>
          </div>
        </div>
      )}

      {/* Main scanner UI */}
      {event && phase.tag !== 'denied' && phase.tag !== 'camera-error' && phase.tag !== 'loading' && (
        <div className="door-root">
          <header className="door-header">
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Einlass</div>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{event.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{formatDate(event.date)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              {online ? (
                <span className="chip ok"><span className="d" />Online</span>
              ) : (
                <span className="chip warn"><span className="d" />Offline{snapshotReady ? '' : ' · keine Liste'}</span>
              )}
              <span style={{ fontSize: 10.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                {online
                  ? lastSyncAt
                    ? `Synchronisiert ${agoLabel(lastSyncAt, nowTs)}`
                    : 'Synchronisiert …'
                  : pendingCount > 0
                  ? `${pendingCount} Scan${pendingCount === 1 ? '' : 's'} in Warteschlange`
                  : snapshotReady
                  ? 'Prüfung läuft lokal weiter'
                  : 'Scans nicht möglich'}
              </span>
              {online && pendingCount > 0 && (
                <span className="chip" title="Offline gescannte Tickets, die noch synchronisiert werden">
                  {pendingCount} wird synchronisiert …
                </span>
              )}
              {conflictCount > 0 && (
                <span className="chip warn" title="Diese Gäste wurden an einem anderen Gerät bereits eingelassen">
                  {conflictCount} Konflikt{conflictCount === 1 ? '' : 'e'}
                </span>
              )}
            </div>
          </header>

          <div className="door-counters" style={reentry?.enabled ? { gridTemplateColumns: '1fr 1fr 1fr' } : undefined}>
            <div className="door-counter">
              <div className="l">Eingelassen</div>
              <div className="v">{scannedToday}</div>
            </div>
            {reentry?.enabled && (
              <div className="door-counter">
                <div className="l">Aktuell drin</div>
                <div className="v">{insideCount}</div>
              </div>
            )}
            <div className="door-counter">
              <div className="l">Letzter Scan</div>
              <div className="v">{lastScan ? formatTime(lastScan) : 'noch keiner'}</div>
            </div>
          </div>

          {reentry?.enabled && (
            <div style={{ padding: '10px 20px 0', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
              <b style={{ color: 'var(--ink-2)' }}>Re-Entry ist an.</b> Wer rausgeht, lässt seinen QR-Code
              hier scannen und wird ausgecheckt. Beim Zurückkommen einfach wieder anstellen und neu scannen.
              {reentry.cooldownSeconds > 0 && ` Zwischen zwei Scans desselben Tickets liegen mindestens ${formatCooldown(reentry.cooldownSeconds)}.`}
            </div>
          )}

          {hasDoorAccess && online && snapshotReady && (
            <BoxOffice
              eventId={eventId}
              tiers={tiers}
              feePayer={feePayer}
              authHeaders={doorAuthHeaders}
              onSold={() => { void refreshSnapshot(); }}
            />
          )}

          <div className="scanner-wrap" role="status" aria-live="assertive">
            <video ref={videoRef} className="scanner-video" muted playsInline />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {phase.tag === 'scanning' && (
              <>
                <div className="corners">
                  <span className="tl" /><span className="tr" /><span className="bl" /><span className="br" />
                </div>
                <div className="beam" />
              </>
            )}

            {phase.tag === 'verifying' && (
              <div className="result-overlay" style={{ background: 'color-mix(in oklab, var(--ink) 55%, transparent)', backdropFilter: 'blur(6px)' }}>
                <div>
                  <div className="spinner" style={{ margin: '0 auto 12px', borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Wird geprüft …</div>
                </div>
              </div>
            )}

            {phase.tag === 'result-valid' && phase.awaitConfirm && (
              <div className="result-overlay" style={{ background: 'oklch(0.40 0.14 150)', placeItems: 'stretch', padding: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 360, margin: 'auto', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.85 }}>
                    Backup-Ticket · Ausweis abgleichen
                  </div>
                  <div className="id-card">
                    {phase.person ? (
                      <>
                        <div className="id-label">Name</div>
                        <div className="id-name">{phase.person.firstName} {phase.person.lastName}</div>
                        <div className="id-label" style={{ marginTop: 10 }}>Geburtsdatum</div>
                        <div className="id-bday">{formatDate(phase.person.birthDate)}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                        Ältere PDF-Version: Name und Geburtsdatum auf dem ausgedruckten Ticket mit dem Ausweis abgleichen.
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 10 }}>
                    {phase.eventName} · {shortId(phase.assetId)}
                    {phase.offline ? ' · offline geprüft' : ''}
                  </div>
                  <button className="id-confirm" onClick={confirmAndResume}>
                    <Icon name="check" size={18} strokeWidth={3} />
                    Ausweis passt, Einlass
                  </button>
                </div>
              </div>
            )}

            {phase.tag === 'result-valid' && !phase.awaitConfirm && (
              <div className="result-overlay" style={{ background: phase.direction === 'out' ? 'oklch(0.42 0.11 250)' : 'oklch(0.40 0.14 150)' }}>
                <div>
                  <div className="result-circle" style={{ color: phase.direction === 'out' ? 'oklch(0.52 0.14 250)' : 'var(--ok)' }}>
                    <Icon name={phase.direction === 'out' ? 'arrow' : 'check'} size={40} strokeWidth={3} />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>
                    {phase.direction === 'out' ? 'Ausgecheckt' : 'Willkommen!'}
                  </div>
                  {phase.direction === 'out' && (
                    <div style={{ fontSize: 12.5, marginTop: 4, opacity: 0.9 }}>
                      Gleicher QR-Code beim Zurückkommen.
                    </div>
                  )}
                  {phase.direction === 'in' && (
                    <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.85 }}>
                      Einlass
                    </div>
                  )}
                  <div style={{ fontSize: 13, marginTop: 4, opacity: 0.85 }}>{phase.eventName} · {shortId(phase.assetId)}</div>
                  {phase.seasonPass && (
                    <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Saisonpass · gilt heute</div>
                  )}
                  {phase.offline && (
                    <div style={{ fontSize: 11.5, marginTop: 6, opacity: 0.75 }}>Offline geprüft, wird später synchronisiert</div>
                  )}
                </div>
              </div>
            )}

            {phase.tag === 'result-used' && (
              <div className="result-overlay" style={{ background: 'oklch(0.48 0.14 70)' }}>
                <div>
                  <div className="result-circle" style={{ color: 'var(--warn)' }}>
                    <Icon name="clock" size={36} strokeWidth={2.5} />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 600 }}>Bereits eingelöst</div>
                  <div style={{ fontSize: 12.5, marginTop: 4, opacity: 0.88 }}>
                    Dieses Ticket wurde schon gescannt{phase.redeemedAt ? `, um ${formatTime(phase.redeemedAt)} Uhr` : ''}.
                  </div>
                </div>
              </div>
            )}

            {phase.tag === 'result-cooldown' && (
              <div className="result-overlay" style={{ background: 'oklch(0.48 0.14 70)' }}>
                <div>
                  <div className="result-circle" style={{ color: 'var(--warn)' }}>
                    <Icon name="clock" size={36} strokeWidth={2.5} />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 600 }}>Noch kurz warten</div>
                  <div style={{ fontSize: 12.5, marginTop: 4, opacity: 0.88, maxWidth: 260 }}>
                    {phase.direction === 'in'
                      ? 'Dieses Ticket wurde gerade erst eingelassen.'
                      : 'Dieses Ticket wurde gerade erst ausgecheckt.'}
                    {phase.retryInSeconds > 0 && ` Noch ${formatCooldown(phase.retryInSeconds)}.`}
                  </div>
                </div>
              </div>
            )}

            {phase.tag === 'result-invalid' && (
              <div className="result-overlay" style={{ background: 'oklch(0.42 0.18 25)' }}>
                <div>
                  <div className="result-circle" style={{ color: 'var(--bad)' }}>
                    <Icon name="x" size={40} strokeWidth={3} />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 600 }}>Ungültig</div>
                  <div style={{ fontSize: 12.5, marginTop: 4, opacity: 0.88 }}>{reasonDe(phase.reason)}</div>
                </div>
              </div>
            )}
          </div>

          <div className="door-foot" aria-live="polite">
            {phase.tag === 'scanning' && 'QR-Code in den Rahmen halten'}
            {phase.tag === 'verifying' && 'Wird geprüft …'}
            {phase.tag === 'result-valid' && phase.awaitConfirm && 'Ausweis prüfen, dann auf „Einlass“ tippen'}
            {isResult && !(phase.tag === 'result-valid' && phase.awaitConfirm) && 'Scanner startet gleich wieder …'}
          </div>
          <LegalLinks style={{ marginTop: 10, opacity: 0.75 }} />
        </div>
      )}
    </>
  );
}
