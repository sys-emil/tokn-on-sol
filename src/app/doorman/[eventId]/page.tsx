'use client';

import jsQR from 'jsqr';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { Epilogue, Unbounded } from 'next/font/google';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  | { tag: 'result-valid'; assetId: string; eventName: string; redeemedAt: string }
  | { tag: 'result-used'; redeemedAt: string }
  | { tag: 'result-invalid'; reason: string };

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function shortId(assetId: string): string {
  return `#PSL-${assetId.slice(-4).toUpperCase()}`;
}

export default function DoormanPage() {
  const params = useParams();
  const eventId = typeof params.eventId === 'string' ? params.eventId : '';

  const { ready, authenticated, login } = usePrivy();
  const { wallets: solanaWallets } = useWallets();
  const walletAddress = solanaWallets[0]?.address;

  const [event, setEvent] = useState<EventData | null>(null);
  const [phase, setPhase] = useState<Phase>({ tag: 'loading' });
  const [scannedToday, setScannedToday] = useState(0);
  const [debugScan, setDebugScan] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processingRef = useRef(false);

  // Fetch event
  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/events/${eventId}`)
      .then((r) => r.json())
      .then((data: EventData) => setEvent(data))
      .catch(() => setEvent(null));
  }, [eventId]);

  // Auth + access check
  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      login();
      return;
    }
    if (!event) return;
    if (!walletAddress) return;

    if (walletAddress !== event.organizer_wallet) {
      setPhase({ tag: 'denied' });
      return;
    }

    if (phase.tag === 'loading') {
      setPhase({ tag: 'scanning' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, walletAddress, event]);

  const handleQrResult = useCallback(async (raw: string) => {
    if (processingRef.current) return;
    processingRef.current = true;

    setPhase({ tag: 'verifying' });

    try {
      const res = await fetch('/api/tickets/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: raw }),
      });
      const data = (await res.json()) as
        | { valid: true; assetId: string; eventName: string; redeemedAt: string }
        | { valid: false; reason: string; redeemedAt?: string };

      if (data.valid) {
        setScannedToday((n) => n + 1);
        setPhase({ tag: 'result-valid', assetId: data.assetId, eventName: data.eventName, redeemedAt: data.redeemedAt });
      } else if (data.reason === 'Already redeemed') {
        setPhase({ tag: 'result-used', redeemedAt: data.redeemedAt ?? '' });
      } else {
        setPhase({ tag: 'result-invalid', reason: data.reason });
      }
    } catch {
      setPhase({ tag: 'result-invalid', reason: 'Network error. Try again.' });
    }

    setTimeout(() => {
      processingRef.current = false;
      setPhase({ tag: 'scanning' });
    }, 3000);
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

        function scanFrame() {
          if (abortController.signal.aborted) return;
          const video = videoRef.current;
          if (!video || video.readyState < 2) {
            requestAnimationFrame(scanFrame);
            return;
          }
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code && !abortController.signal.aborted) {
            setDebugScan(code.data.substring(0, 150));
          }
          requestAnimationFrame(scanFrame);
        }
        requestAnimationFrame(scanFrame);
      } catch (err) {
        if (!abortController.signal.aborted) {
          const msg = err instanceof Error ? err.message : 'Camera unavailable';
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

  const isResult = phase.tag === 'result-valid' || phase.tag === 'result-used' || phase.tag === 'result-invalid';
  const overlayColor =
    phase.tag === 'result-valid' ? 'oklch(0.38 0.14 148)' :
    phase.tag === 'result-used'  ? 'oklch(0.48 0.14 60)'  :
    phase.tag === 'result-invalid' ? 'oklch(0.38 0.18 28)' : 'transparent';

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

        html, body { margin: 0; padding: 0; background: #000; }

        .doorman-root {
          font-family: var(--font-body);
          background: #000;
          color: var(--color-text);
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
        }

        /* ── Header ─────────────────────────────────────────── */
        .doorman-header {
          background: oklch(0.10 0.014 258 / 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--color-border);
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          z-index: 10;
        }

        .doorman-header-left {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .doorman-eyebrow {
          font-family: var(--font-display);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.20em;
          text-transform: uppercase;
          color: var(--color-accent);
        }

        .doorman-event-name {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 900;
          letter-spacing: -0.01em;
          color: var(--color-text);
        }

        .doorman-event-date {
          font-family: var(--font-body);
          font-size: 12px;
          color: var(--color-text-muted);
        }

        .doorman-counter {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .doorman-counter-num {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 900;
          letter-spacing: -0.03em;
          line-height: 1;
          color: var(--color-accent);
        }

        .doorman-counter-label {
          font-family: var(--font-body);
          font-size: 10px;
          color: var(--color-text-muted);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        /* ── Scanner area ────────────────────────────────────── */
        .scanner-wrap {
          flex: 1;
          position: relative;
          background: #000;
          overflow: hidden;
          min-height: 0;
        }

        .scanner-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        /* Scanning guide frame */
        .scan-frame {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .scan-box {
          width: min(260px, 60vw);
          height: min(260px, 60vw);
          position: relative;
        }

        .scan-box::before,
        .scan-box::after,
        .scan-box-inner::before,
        .scan-box-inner::after {
          content: '';
          position: absolute;
          width: 28px;
          height: 28px;
          border-color: var(--color-accent);
          border-style: solid;
        }

        .scan-box::before    { top: 0;    left: 0;  border-width: 2px 0 0 2px; }
        .scan-box::after     { top: 0;    right: 0; border-width: 2px 2px 0 0; }
        .scan-box-inner::before { bottom: 0; left: 0;  border-width: 0 0 2px 2px; }
        .scan-box-inner::after  { bottom: 0; right: 0; border-width: 0 2px 2px 0; }

        .scan-line {
          position: absolute;
          left: 4px;
          right: 4px;
          height: 2px;
          background: var(--color-accent);
          opacity: 0.7;
          animation: scanLine 2s ease-in-out infinite;
        }

        @keyframes scanLine {
          0%   { top: 8px;  opacity: 0; }
          10%  { opacity: 0.7; }
          90%  { opacity: 0.7; }
          100% { top: calc(100% - 10px); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .scan-line { animation: none; top: 50%; }
        }

        /* ── Result overlay ──────────────────────────────────── */
        .result-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 32px;
          text-align: center;
          animation: overlayIn 0.18s ease both;
        }

        @keyframes overlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .result-icon {
          font-size: 64px;
          line-height: 1;
        }

        .result-status {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 900;
          letter-spacing: -0.02em;
          color: #fff;
          margin: 0;
        }

        .result-detail {
          font-family: var(--font-body);
          font-size: 15px;
          color: rgba(255, 255, 255, 0.80);
          line-height: 1.5;
          margin: 0;
        }

        .result-meta {
          font-family: var(--font-display);
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.55);
          margin-top: 4px;
        }

        /* ── Verifying overlay ───────────────────────────────── */
        .verifying-overlay {
          position: absolute;
          inset: 0;
          background: oklch(0.10 0.014 258 / 0.80);
          backdrop-filter: blur(8px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 2.5px solid var(--color-border);
          border-top-color: var(--color-accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .verifying-text {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        /* ── Footer ──────────────────────────────────────────── */
        .doorman-footer {
          background: oklch(0.10 0.014 258 / 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-top: 1px solid var(--color-border);
          padding: 14px 24px;
          text-align: center;
          flex-shrink: 0;
        }

        .doorman-footer-text {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-muted);
        }

        /* ── Full-screen states ──────────────────────────────── */
        .center-screen {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 48px 24px;
          background-color: var(--color-bg);
          background-image: radial-gradient(circle, oklch(0.23 0.014 258 / 0.45) 1px, transparent 1px);
          background-size: 28px 28px;
          text-align: center;
        }

        .state-eyebrow {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-accent);
        }

        .state-title {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.02em;
          color: var(--color-text);
          margin: 0;
        }

        .state-body {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-text-muted);
          line-height: 1.6;
          max-width: 320px;
          margin: 0;
        }
      `}</style>

      <div className={`${unbounded.variable} ${epilogue.variable}`}>
        {/* Loading / auth / access denied states */}
        {(phase.tag === 'loading' || !event) && (
          <div className="center-screen">
            <div className="spinner" style={{ borderTopColor: 'var(--color-accent)', borderColor: 'var(--color-border)', width: 28, height: 28 }} />
            <div className="state-eyebrow">Doorman</div>
            <h1 className="state-title">Loading…</h1>
          </div>
        )}

        {phase.tag === 'denied' && (
          <div className="center-screen">
            <div className="state-eyebrow">Access denied</div>
            <h1 className="state-title">Not authorized</h1>
            <p className="state-body">
              Your wallet is not the organizer of this event.<br />
              Connect the correct wallet to access doorman mode.
            </p>
          </div>
        )}

        {phase.tag === 'camera-error' && (
          <div className="center-screen">
            <div className="state-eyebrow">Camera error</div>
            <h1 className="state-title">Camera unavailable</h1>
            <p className="state-body">{phase.message}</p>
          </div>
        )}

        {/* Main scanner UI */}
        {event && phase.tag !== 'denied' && phase.tag !== 'camera-error' && phase.tag !== 'loading' && (
          <div className="doorman-root">
            <header className="doorman-header">
              <div className="doorman-header-left">
                <div className="doorman-eyebrow">Doorman</div>
                <div className="doorman-event-name">{event.name}</div>
                <div className="doorman-event-date">{event.date}</div>
              </div>
              <div className="doorman-counter">
                <div className="doorman-counter-num">{scannedToday}</div>
                <div className="doorman-counter-label">scanned today</div>
              </div>
            </header>

            <div className="scanner-wrap">
              <video ref={videoRef} className="scanner-video" muted playsInline />
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {debugScan && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  background: 'rgba(0,0,0,0.85)', color: '#fff',
                  padding: '12px', fontSize: '11px', zIndex: 99,
                  wordBreak: 'break-all', fontFamily: 'monospace'
                }}>
                  {debugScan}
                </div>
              )}

              {/* Scan guide frame — visible while scanning */}
              {(phase.tag === 'scanning') && (
                <div className="scan-frame">
                  <div className="scan-box">
                    <div className="scan-box-inner" />
                    <div className="scan-line" />
                  </div>
                </div>
              )}

              {/* Verifying overlay */}
              {phase.tag === 'verifying' && (
                <div className="verifying-overlay">
                  <div className="spinner" />
                  <div className="verifying-text">Verifying…</div>
                </div>
              )}

              {/* Result overlays */}
              {phase.tag === 'result-valid' && (
                <div className="result-overlay" style={{ background: overlayColor }}>
                  <div className="result-icon">✓</div>
                  <h2 className="result-status">Ticket redeemed</h2>
                  <p className="result-detail">{phase.eventName}</p>
                  <div className="result-meta">{shortId(phase.assetId)}</div>
                </div>
              )}

              {phase.tag === 'result-used' && (
                <div className="result-overlay" style={{ background: overlayColor }}>
                  <div className="result-icon">⚠</div>
                  <h2 className="result-status">Already redeemed</h2>
                  <p className="result-detail">
                    This ticket was already scanned at {formatTime(phase.redeemedAt)}.
                  </p>
                </div>
              )}

              {phase.tag === 'result-invalid' && (
                <div className="result-overlay" style={{ background: overlayColor }}>
                  <div className="result-icon">✕</div>
                  <h2 className="result-status">Invalid ticket</h2>
                  <p className="result-detail">{phase.reason}</p>
                </div>
              )}
            </div>

            <footer className="doorman-footer">
              <div className="doorman-footer-text">
                {phase.tag === 'scanning'    ? 'Point camera at ticket QR code'    : ''}
                {phase.tag === 'verifying'   ? 'Checking ticket…'                  : ''}
                {isResult                    ? 'Resuming in 3 seconds…'            : ''}
              </div>
            </footer>
          </div>
        )}
      </div>
    </>
  );
}
