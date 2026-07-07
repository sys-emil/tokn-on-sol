'use client';

import { useLogout, usePrivy, useLinkAccount } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';

type OrgType = 'private' | 'business';
type PageState = 'loading' | 'form';

const PAGE_CSS = `
  .narrow { max-width: 620px; margin: 0 auto; }
  .type-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 480px) { .type-cards { grid-template-columns: 1fr; } }
  .type-card {
    border: 1px solid var(--line-2);
    background: var(--surface);
    border-radius: var(--radius);
    padding: 14px 16px;
    display: flex; flex-direction: column; gap: 3px;
    text-align: left;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  }
  .type-card:hover { border-color: var(--ink-4); }
  .type-card.selected {
    border-color: var(--accent);
    background: var(--accent-wash);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 12%, transparent);
  }
  .type-card .name { font-size: 13.5px; font-weight: 600; }
  .type-card.selected .name { color: var(--accent-ink); }
  .type-card .sub { font-size: 12px; color: var(--ink-3); }
`;

export default function BecomeOrganizer() {
  const router = useRouter();
  const { ready, authenticated, login, user, getAccessToken } = usePrivy();
  const { logout } = useLogout({ onSuccess: () => router.push('/') });
  const { linkEmail } = useLinkAccount({ onSuccess: () => { setFormError(null); } });
  const { wallets: solanaWallets } = useSolanaWallets();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [orgType, setOrgType] = useState<OrgType | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const walletAddress = solanaWallets[0]?.address;

  // If not authenticated, trigger login — but at most once. Re-invoking
  // login() from effect re-runs (Privy re-renders during the modal flow)
  // resets the modal to the e-mail step, so the code input never shows.
  const loginPrompted = useRef(false);
  useEffect(() => {
    if (!ready) return;
    if (!authenticated && !loginPrompted.current) {
      loginPrompted.current = true;
      login();
    }
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
    if (!name.trim()) { setFormError('Bitte gib deinen Namen an.'); return; }
    if (!effectiveEmail.trim()) { setFormError('Bitte gib deine E-Mail-Adresse an.'); return; }
    if (!orgType) { setFormError('Bitte wähle aus, wie du Events veranstaltest.'); return; }
    if (orgType === 'business' && !businessName.trim()) {
      setFormError('Bitte gib den Namen deines Unternehmens an.'); return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      const token = await getAccessToken();
      if (!token) { setFormError('Anmeldung abgelaufen. Bitte melde dich erneut an.'); return; }
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
        if (data.error === 'email_required') {
          setFormError('email_required');
        } else {
          setFormError(data.error ?? 'Etwas ist schiefgelaufen. Bitte versuch es erneut.');
        }
        return;
      }
      router.push('/dashboard');
    } catch {
      setFormError('Netzwerkfehler. Bitte versuch es erneut.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || !authenticated) return null;

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="app">

        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <div className="nav">
              <Link href="/events">Events</Link>
              <Link href="/my-tickets">Meine Tickets</Link>
            </div>
            <div className="topbar-right">
              <button className="btn subtle sm" onClick={() => logout()}>Abmelden</button>
            </div>
          </div>
        </div>

        <div className="main">
          <div className="aurora" aria-hidden="true" />
          <div className="container">
            <div className="narrow">

              <div className="hero" style={{ padding: '32px 0 28px', marginBottom: 8 }}>
                <div className="eyebrow"><span className="pulse" />Für Veranstalter</div>
                <h1 style={{ fontSize: 32 }}>Eigene Events veranstalten</h1>
                {pageState === 'form' && (
                  <p className="lead" style={{ fontSize: 14.5 }}>
                    Erzähl uns kurz, wer du bist — danach kannst du sofort dein erstes Event anlegen.
                  </p>
                )}
              </div>

              {pageState === 'form' && (
                <div className="card" style={{ padding: '24px 24px 22px' }}>

                  <div className="field">
                    <label htmlFor="org-name">Vollständiger Name</label>
                    <input
                      id="org-name"
                      className="input"
                      type="text"
                      placeholder="Dein Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="org-email">E-Mail-Adresse</label>
                    <input
                      id="org-email"
                      className="input"
                      type="email"
                      placeholder="du@beispiel.de"
                      value={effectiveEmail}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Du veranstaltest als</label>
                    <div className="type-cards">
                      <button
                        className={`type-card${orgType === 'private' ? ' selected' : ''}`}
                        onClick={() => setOrgType('private')}
                        type="button"
                      >
                        <div className="name">Privatperson</div>
                        <div className="sub">Private Feiern, einzelne Events</div>
                      </button>
                      <button
                        className={`type-card${orgType === 'business' ? ' selected' : ''}`}
                        onClick={() => setOrgType('business')}
                        type="button"
                      >
                        <div className="name">Unternehmen</div>
                        <div className="sub">Firmen, Marken, regelmäßige Events</div>
                      </button>
                    </div>
                  </div>

                  {orgType === 'business' && (
                    <div className="field">
                      <label htmlFor="org-business-name">Name des Unternehmens</label>
                      <input
                        id="org-business-name"
                        className="input"
                        type="text"
                        placeholder="Firmen- oder Markenname"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                      />
                    </div>
                  )}

                  {formError && formError !== 'email_required' && (
                    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bad-wash)', border: '1px solid oklch(0.86 0.10 25)', fontSize: 12.5, color: 'var(--bad)', marginBottom: 14 }}>
                      {formError}
                    </div>
                  )}
                  {formError === 'email_required' && (
                    <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--warn-wash)', border: '1px solid oklch(0.86 0.09 70)', marginBottom: 14 }}>
                      <div style={{ fontSize: 12.5, color: 'oklch(0.42 0.13 70)', marginBottom: 10 }}>
                        Um Events zu veranstalten, bestätige bitte zuerst deine E-Mail-Adresse.
                      </div>
                      <button type="button" className="btn ghost sm" onClick={() => linkEmail()}>
                        <Icon name="mail" size={13} /> E-Mail bestätigen
                      </button>
                    </div>
                  )}

                  <button
                    className="btn primary lg"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                    onClick={() => void handleSubmit()}
                    disabled={submitting}
                  >
                    {submitting ? 'Wird gesendet …' : 'Loslegen'}
                  </button>

                </div>
              )}

              {pageState === 'loading' && (
                <div className="card"><div className="empty">Einen Moment …</div></div>
              )}

              <LegalLinks style={{ marginTop: 40 }} />

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
