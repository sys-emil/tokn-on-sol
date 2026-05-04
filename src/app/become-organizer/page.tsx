'use client';

import { useLogout, usePrivy, useLinkAccount } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import { Epilogue, Unbounded } from 'next/font/google';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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

type OrgType = 'private' | 'business';
type PageState = 'loading' | 'form';

export default function BecomeOrganizer() {
  const router = useRouter();
  const { ready, authenticated, login, user, getAccessToken } = usePrivy();
  const { logout } = useLogout({ onSuccess: () => router.push('/') });
  const { linkPhone } = useLinkAccount({ onSuccess: () => { setFormError(null); } });
  const { wallets: solanaWallets } = useSolanaWallets();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [orgType, setOrgType] = useState<OrgType | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const walletAddress = solanaWallets[0]?.address;

  // If not authenticated, trigger login
  useEffect(() => {
    if (!ready) return;
    if (!authenticated) login();
  }, [ready, authenticated, login]);

  // Check existing application status — if already approved, go straight to dashboard
  useEffect(() => {
    if (!walletAddress) return;
    async function checkStatus(): Promise<void> {
      const res = await fetch(`/api/organizers/status?walletAddress=${walletAddress}`);
      if (!res.ok) { setPageState('form'); return; }
      const data = (await res.json()) as { status: string };
      if (data.status === 'approved') {
        router.push('/dashboard');
      } else {
        setPageState('form');
      }
    }
    void checkStatus();
  }, [walletAddress, router]);

  const effectiveEmail = email || (user?.email?.address ?? '');

  async function handleSubmit(): Promise<void> {
    if (!walletAddress) return;
    if (!name.trim()) { setFormError('Full name is required.'); return; }
    if (!effectiveEmail.trim()) { setFormError('Email is required.'); return; }
    if (!orgType) { setFormError('Please select an organizer type.'); return; }
    if (orgType === 'business' && !businessName.trim()) {
      setFormError('Business name is required.'); return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      const token = await getAccessToken();
      if (!token) { setFormError('Authentication error. Please log in again.'); return; }
      const res = await fetch('/api/organizers/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          walletAddress,
          email: effectiveEmail.trim(),
          name: name.trim(),
          type: orgType,
          businessName: orgType === 'business' ? businessName.trim() : undefined,
        }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (!data.success) {
        if (data.error === 'phone_required') {
          setFormError('phone_required');
        } else {
          setFormError(data.error ?? 'Something went wrong.');
        }
        return;
      }
      router.push('/dashboard');
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || !authenticated) return null;

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

        html, body {
          margin: 0;
          padding: 0;
          background: var(--color-bg);
        }

        .page-root {
          font-family: var(--font-body);
          background-color: var(--color-bg);
          background-image: radial-gradient(
            circle,
            oklch(0.23 0.014 258 / 0.45) 1px,
            transparent 1px
          );
          background-size: 28px 28px;
          color: var(--color-text);
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
        }

        /* ── Nav ─────────────────────────────────────────────── */
        .nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 20;
          padding: 0 48px;
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: oklch(0.10 0.014 258 / 0.88);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-bottom: 1px solid var(--color-border);
        }

        .nav-left {
          display: flex;
          align-items: center;
          gap: 32px;
        }

        .logo {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--color-text);
          text-decoration: none;
        }

        .logo-dot { color: var(--color-accent); }

        .nav-divider {
          width: 1px;
          height: 18px;
          background: var(--color-border);
        }

        .nav-section {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .btn-nav {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--color-text-muted);
          background: transparent;
          border: 1px solid var(--color-border);
          padding: 8px 16px;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          transition: color 0.15s ease, border-color 0.15s ease;
        }

        .btn-nav:hover {
          color: var(--color-text);
          border-color: oklch(0.40 0.016 258);
        }

        /* ── Main ────────────────────────────────────────────── */
        .main {
          flex: 1;
          max-width: 640px;
          width: 100%;
          margin: 0 auto;
          padding: 108px 48px 96px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 40px;
        }

        /* ── Heading ─────────────────────────────────────────── */
        .page-heading {
          display: flex;
          flex-direction: column;
          gap: 6px;
          animation: fadeUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both;
        }

        .page-label {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.20em;
          text-transform: uppercase;
          color: var(--color-accent);
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .page-label-line {
          display: block;
          width: 24px;
          height: 1px;
          background: var(--color-accent);
          flex-shrink: 0;
        }

        .page-title {
          font-family: var(--font-display);
          font-size: clamp(24px, 3vw, 36px);
          font-weight: 900;
          letter-spacing: -0.02em;
          line-height: 1.1;
          color: var(--color-text);
          margin: 0;
        }

        .page-sub {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-text-muted);
          line-height: 1.6;
          margin: 4px 0 0;
        }

        /* ── Form card ───────────────────────────────────────── */
        .form-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          padding: 32px 36px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          animation: fadeUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
          box-sizing: border-box;
        }

        /* ── Field ───────────────────────────────────────────── */
        .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .field-label {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        .field-input {
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          color: var(--color-text);
          font-family: var(--font-body);
          font-size: 14px;
          padding: 11px 14px;
          outline: none;
          transition: border-color 0.15s ease;
          box-sizing: border-box;
          width: 100%;
        }

        .field-input:focus {
          border-color: var(--color-accent);
        }

        .field-input::placeholder {
          color: var(--color-text-muted);
          opacity: 0.6;
        }

        /* ── Type toggle cards ───────────────────────────────── */
        .type-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .type-card {
          border: 1px solid var(--color-border);
          background: var(--color-bg);
          padding: 16px 18px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 4px;
          transition: border-color 0.15s ease, background 0.15s ease;
          text-align: left;
        }

        .type-card:hover {
          border-color: oklch(0.40 0.016 258);
        }

        .type-card.selected {
          border-color: var(--color-accent);
          background: oklch(0.14 0.025 148 / 0.35);
        }

        .type-card-name {
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          color: var(--color-text);
        }

        .type-card.selected .type-card-name {
          color: var(--color-accent);
        }

        .type-card-sub {
          font-family: var(--font-body);
          font-size: 12px;
          color: var(--color-text-muted);
        }

        /* ── Submit button ───────────────────────────────────── */
        .btn-submit {
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: oklch(0.10 0.014 258);
          background: var(--color-accent);
          border: 1px solid var(--color-accent);
          padding: 14px 28px;
          cursor: pointer;
          align-self: flex-start;
          transition: background 0.15s ease;
        }

        .btn-submit:hover:not(:disabled) {
          background: oklch(0.80 0.118 148);
          border-color: oklch(0.80 0.118 148);
        }

        .btn-submit:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        /* ── Error ───────────────────────────────────────────── */
        .form-error {
          font-family: var(--font-body);
          font-size: 13px;
          color: oklch(0.72 0.15 25);
          margin: 0;
        }

        /* ── States (pending / submitted) ────────────────────── */
        .state-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          padding: 48px 36px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
          animation: fadeUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
        }

        .state-label {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-accent);
        }

        .state-title {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 900;
          letter-spacing: -0.01em;
          color: var(--color-text);
          margin: 0;
        }

        .state-body {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-text-muted);
          line-height: 1.6;
          margin: 0;
          max-width: 42ch;
        }

        /* ── Animations ──────────────────────────────────────── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .page-heading, .form-card, .state-card { animation: none; }
        }

        /* ── Responsive ──────────────────────────────────────── */
        @media (max-width: 900px) {
          .nav { padding: 0 24px; }
          .main { padding: 96px 24px 64px; }
        }

        @media (max-width: 480px) {
          .nav { padding: 0 16px; }
          .main { padding: 88px 16px 64px; }
          .form-card { padding: 24px 20px; }
          .type-cards { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className={`page-root ${unbounded.variable} ${epilogue.variable}`}>

        <nav className="nav">
          <div className="nav-left">
            <Link href="/" className="logo">Passly<span className="logo-dot">.</span></Link>
            <div className="nav-divider" />
            <div className="nav-section">Host Events</div>
          </div>
          <div className="nav-right">
            <Link href="/my-tickets" className="btn-nav" style={{ textDecoration: 'none' }}>My Tickets</Link>
            <button className="btn-nav" onClick={() => logout()}>Log out</button>
          </div>
        </nav>

        <main className="main">

          <div className="page-heading">
            <div className="page-label">
              <span className="page-label-line" />
              Organizer
            </div>
            <h1 className="page-title">Become an organizer</h1>
            {pageState === 'form' && (
              <p className="page-sub">
                Tell us about yourself. We&rsquo;ll review your application and get back to you.
              </p>
            )}
          </div>

          {/* Form */}
          {pageState === 'form' && (
            <div className="form-card">

              <div className="field">
                <label className="field-label" htmlFor="org-name">Full name</label>
                <input
                  id="org-name"
                  className="field-input"
                  type="text"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="org-email">Email address</label>
                <input
                  id="org-email"
                  className="field-input"
                  type="email"
                  placeholder="you@example.com"
                  value={effectiveEmail}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="field">
                <div className="field-label">Organizer type</div>
                <div className="type-cards">
                  <button
                    className={`type-card${orgType === 'private' ? ' selected' : ''}`}
                    onClick={() => setOrgType('private')}
                    type="button"
                  >
                    <div className="type-card-name">Private</div>
                    <div className="type-card-sub">Individuals, personal events</div>
                  </button>
                  <button
                    className={`type-card${orgType === 'business' ? ' selected' : ''}`}
                    onClick={() => setOrgType('business')}
                    type="button"
                  >
                    <div className="type-card-name">Business</div>
                    <div className="type-card-sub">Companies, brands, recurring events</div>
                  </button>
                </div>
              </div>

              {orgType === 'business' && (
                <div className="field">
                  <label className="field-label" htmlFor="org-business-name">Business name</label>
                  <input
                    id="org-business-name"
                    className="field-input"
                    type="text"
                    placeholder="Your company or brand name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>
              )}

              {formError && formError !== 'phone_required' && (
                <p className="form-error">{formError}</p>
              )}
              {formError === 'phone_required' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <p className="form-error">
                    To become an organizer, please add and verify your phone number first. You can do this in your account settings.
                  </p>
                  <button
                    type="button"
                    className="btn-submit"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => linkPhone()}
                  >
                    Add phone number
                  </button>
                </div>
              )}

              <button
                className="btn-submit"
                onClick={() => void handleSubmit()}
                disabled={submitting}
              >
                {submitting ? 'Submitting…' : 'Submit application'}
              </button>

            </div>
          )}

        </main>

      </div>
    </>
  );
}
