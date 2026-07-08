'use client';

import { useLogout, usePrivy, getAccessToken } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';
import { badgeDisplay } from '@/lib/badgeMeta';
import { useEffect, useRef, useState } from 'react';

interface Ticket {
  assetId: string;
  eventName: string;
  eventDate: string;
  purchasedAt: string;
  eventId: string;
  redeemedAt: string | null;
  claimUrl: string | null;
}

interface BadgeItem {
  badgeType: string;
  assetId: string | null;
  earnedAt: string;
}

interface Progress {
  attendedCount: number;
  nextMilestone: { type: string; threshold: number } | null;
  topOrganizer: { name: string; attendedEvents: number; threshold: number } | null;
}

interface LoyaltyProgramView {
  programId: string;
  organizerName: string;
  benefitTitle: string;
  benefitDescription: string | null;
  threshold: number;
  attendedEvents: number;
  qualified: boolean;
  claim: { code: string; redeemedAt: string | null } | null;
}

const monthShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' }).replace('.', '');
const dayNum = (iso: string) => new Date(iso + 'T00:00:00').getDate();
const formatDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

function daysUntil(iso: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(iso + 'T00:00:00').getTime() - today.getTime()) / 86400000);
}

function isUpcoming(iso: string): boolean { return daysUntil(iso) >= 0; }

export default function MyTickets() {
  const router = useRouter();
  const { ready, authenticated, user, login } = usePrivy();
  const { logout } = useLogout({ onSuccess: () => router.push('/') });
  const { wallets: solanaWallets } = useSolanaWallets();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyProgramView[]>([]);
  const [claimingProgramId, setClaimingProgramId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [shareModal, setShareModal] = useState<{ assetId: string; url: string } | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharingAssetId, setSharingAssetId] = useState<string | null>(null);
  const [copyConfirmed, setCopyConfirmed] = useState(false);

  const buyerWallet = solanaWallets[0]?.address;

  // Open the login modal at most once for signed-out visitors — never call
  // login() from re-runs of this effect, or the modal resets mid-flow and the
  // e-mail code step never appears.
  const loginPrompted = useRef(false);
  useEffect(() => {
    if (ready && !authenticated && !loginPrompted.current) {
      loginPrompted.current = true;
      login();
    }
  }, [ready, authenticated, login]);

  useEffect(() => {
    if (!buyerWallet || loaded) return;
    async function load() {
      try {
        const [res, loyaltyRes] = await Promise.all([
          fetch(`/api/my-tickets?buyerWallet=${buyerWallet}`),
          fetch(`/api/loyalty/status?buyerWallet=${buyerWallet}`),
        ]);
        if (res.ok) {
          const data = (await res.json()) as { tickets: Ticket[]; badges: BadgeItem[]; progress?: Progress };
          setTickets(data.tickets);
          setBadges(data.badges ?? []);
          setProgress(data.progress ?? null);
        }
        if (loyaltyRes.ok) {
          const data = (await loyaltyRes.json()) as { programs: LoyaltyProgramView[] };
          setLoyalty(data.programs ?? []);
        }
      } finally {
        setLoaded(true);
      }
    }
    void load();
  }, [buyerWallet, loaded]);

  async function handleShare(assetId: string, existingClaimUrl: string | null) {
    setShareError(null);
    if (existingClaimUrl) { setShareModal({ assetId, url: existingClaimUrl }); return; }
    setSharingAssetId(assetId);
    try {
      const authToken = await getAccessToken();
      const res = await fetch('/api/claims/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken ?? ''}` },
        body: JSON.stringify({ assetId }),
      });
      const data = (await res.json()) as { success: boolean; url?: string; error?: string };
      if (data.success && data.url) {
        setTickets((prev) => prev.map((t) => t.assetId === assetId ? { ...t, claimUrl: data.url! } : t));
        setShareModal({ assetId, url: data.url });
      } else if (data.error === 'not_delegated') {
        setShareError('Dieses Ticket wurde gekauft, bevor Weitergabe unterstützt wurde, und kann nicht geteilt werden.');
      } else {
        setShareError(data.error ?? 'Der Link konnte nicht erstellt werden.');
      }
    } finally {
      setSharingAssetId(null);
    }
  }

  async function handleClaimBenefit(programId: string) {
    if (!buyerWallet || claimingProgramId) return;
    setClaimingProgramId(programId);
    try {
      const authToken = await getAccessToken();
      const res = await fetch('/api/loyalty/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken ?? ''}` },
        body: JSON.stringify({ buyerWallet, programId }),
      });
      const data = (await res.json()) as { success: boolean; code?: string; redeemedAt?: string | null };
      if (data.success && data.code) {
        setLoyalty((prev) => prev.map((p) =>
          p.programId === programId ? { ...p, claim: { code: data.code!, redeemedAt: data.redeemedAt ?? null } } : p,
        ));
      }
    } finally {
      setClaimingProgramId(null);
    }
  }

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopyConfirmed(true);
    setTimeout(() => setCopyConfirmed(false), 2000);
  }

  if (!ready) return null;

  // Signed out and the login modal was dismissed: show an explicit sign-in
  // state instead of a blank page or a silent bounce to the landing page.
  if (!authenticated) {
    return (
      <div className="app">
        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <div className="nav">
              <Link href="/events">Events</Link>
            </div>
          </div>
        </div>
        <div className="main">
          <div className="container" style={{ maxWidth: 480 }}>
            <div className="card" style={{ padding: 32, textAlign: 'center', marginTop: 48 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-wash)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', margin: '0 auto 14px', color: 'var(--accent)' }}>
                <Icon name="ticket" size={20} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em' }}>Deine Tickets warten hier.</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.6 }}>
                Melde dich mit deiner E-Mail-Adresse an — ohne Passwort, ein Code genügt.
              </div>
              <button className="btn primary" style={{ marginTop: 18 }} onClick={() => login()}>
                Anmelden
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const email = user?.email?.address ?? '';
  const initials = (email ? email.split('@')[0] : 'PA').slice(0, 2).toUpperCase();
  const loading = !!buyerWallet && !loaded;
  const upcoming = tickets.filter((t) => isUpcoming(t.eventDate));
  const past = tickets.filter((t) => !isUpcoming(t.eventDate));
  const isAllEmpty = loaded && tickets.length === 0 && badges.length === 0;

  const ticketCard = (t: Ticket, kind: 'upcoming' | 'past') => {
    const attended = !!t.redeemedAt;
    const days = daysUntil(t.eventDate);
    const daysLabel = days === 0 ? 'Heute' : days === 1 ? 'Morgen' : `in ${days} Tagen`;
    return (
      <Link key={t.assetId} href={`/tickets/${t.assetId}`} className="event-card">
        <div className="row gap-3">
          <div className="date-chip">
            <div className="m">{monthShort(t.eventDate)}</div>
            <div className="d">{dayNum(t.eventDate)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="title">{t.eventName}</div>
            <div className="meta">
              <Icon name="calendar" size={12} /> {formatDate(t.eventDate)}
            </div>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          {kind === 'upcoming' ? (
            <span className="chip accent"><span className="d" />{daysLabel}</span>
          ) : attended ? (
            <span className="chip ok"><span className="d" />Dabei gewesen</span>
          ) : (
            <span className="chip"><span className="d" />Verpasst</span>
          )}
          {(kind === 'upcoming' || attended) && (
            <button
              className="btn subtle sm"
              onClick={(e) => { e.preventDefault(); void handleShare(t.assetId, t.claimUrl); }}
              disabled={sharingAssetId === t.assetId}
            >
              <Icon name="share" size={12} /> {sharingAssetId === t.assetId ? '…' : t.claimUrl ? 'Link kopieren' : 'Teilen'}
            </button>
          )}
        </div>
      </Link>
    );
  };

  return (
    <>
      <div className="app">

        <div className="topbar">
          <div className="topbar-inner">
            <PasslyLogo height={24} />
            <div className="nav">
              <Link href="/events">Events</Link>
              <Link href="/my-tickets" className="active">Meine Tickets</Link>
              <Link href="/dashboard">Dashboard</Link>
            </div>
            <div className="topbar-right">
              <button className="btn subtle sm" onClick={() => logout()}>Abmelden</button>
              <div className="avatar" title={email}>{initials}</div>
            </div>
          </div>
        </div>

        <div className="main">
          <div className="container">

            <div className="row gap-3" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap' }}>
              <div>
                <h1 style={{ fontSize: 30, letterSpacing: '-0.03em', fontWeight: 600, lineHeight: 1.1 }}>Meine Tickets</h1>
                {buyerWallet && (
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6 }}>
                    <Link href={`/collection/${buyerWallet}`} style={{ color: 'var(--accent)', fontWeight: 500 }}>
                      Öffentliches Profil ansehen →
                    </Link>
                  </div>
                )}
              </div>
              <Link href="/events" className="btn ghost"><Icon name="ticket" size={14} /> Events entdecken</Link>
            </div>

            {shareError && (
              <div className="card" style={{ padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--bad)', border: '1px solid oklch(0.86 0.10 25)', background: 'var(--bad-wash)' }}>
                {shareError}
              </div>
            )}

            {loading && (
              <div className="card"><div className="empty">Lade Tickets …</div></div>
            )}

            {!loading && isAllEmpty && (
              <div className="card">
                <div className="empty">
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-wash)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', color: 'var(--accent)' }}>
                    <Icon name="ticket" size={20} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Dein erstes Ticket wartet hier.</div>
                  <div style={{ fontSize: 13, marginTop: 4, marginBottom: 16 }}>Kauf ein Ticket — es landet automatisch in dieser Übersicht.</div>
                  <Link href="/events" className="btn primary">Events entdecken <Icon name="arrow" size={13} /></Link>
                </div>
              </div>
            )}

            {!loading && !isAllEmpty && (
              <>
                <section>
                  <div className="section-head">
                    <div>
                      <h2>Bevorstehend</h2>
                      <div className="sub">{upcoming.length} Ticket{upcoming.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  {upcoming.length === 0 ? (
                    <div className="card">
                      <div className="empty">
                        Keine bevorstehenden Tickets. <Link href="/events" style={{ color: 'var(--accent)', fontWeight: 500 }}>Events entdecken →</Link>
                      </div>
                    </div>
                  ) : (
                    <div className="events-grid">
                      {upcoming.map((t) => ticketCard(t, 'upcoming'))}
                    </div>
                  )}
                </section>

                <section>
                  <div className="section-head">
                    <div>
                      <h2>Sammlung</h2>
                      <div className="sub">Besuchte Events</div>
                    </div>
                  </div>
                  {past.length === 0 ? (
                    <div className="card">
                      <div className="empty">Events, bei denen du warst, erscheinen hier als Erinnerung.</div>
                    </div>
                  ) : (
                    <div className="events-grid">
                      {past.map((t) => ticketCard(t, 'past'))}
                    </div>
                  )}
                </section>

                {loyalty.length > 0 && (
                  <section>
                    <div className="section-head">
                      <div>
                        <h2>Deine Vorteile</h2>
                        <div className="sub">Treueprogramme deiner Veranstalter</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {loyalty.map((p) => {
                        const remaining = Math.max(0, p.threshold - p.attendedEvents);
                        const pct = Math.min(100, Math.round((p.attendedEvents / p.threshold) * 100));
                        return (
                          <div key={p.programId} className="card" style={{ padding: '16px 20px' }}>
                            <div className="row gap-3" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.benefitTitle}</div>
                                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
                                  von {p.organizerName}{p.benefitDescription ? ` · ${p.benefitDescription}` : ''}
                                </div>
                                {!p.qualified && (
                                  <>
                                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>
                                      Noch {remaining} Event{remaining !== 1 ? 's' : ''} bis zu deinem Vorteil ({p.attendedEvents}/{p.threshold})
                                    </div>
                                    <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', marginTop: 6, overflow: 'hidden', maxWidth: 320 }}>
                                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: 'var(--accent)' }} />
                                    </div>
                                  </>
                                )}
                              </div>
                              {p.qualified && (
                                p.claim ? (
                                  p.claim.redeemedAt ? (
                                    <span className="chip"><span className="d" />Eingelöst</span>
                                  ) : (
                                    <div style={{ textAlign: 'center' }}>
                                      <div className="mono" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--accent)' }}>{p.claim.code}</div>
                                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Am Einlass vorzeigen</div>
                                    </div>
                                  )
                                ) : (
                                  <button
                                    className="btn primary sm"
                                    onClick={() => void handleClaimBenefit(p.programId)}
                                    disabled={claimingProgramId === p.programId}
                                  >
                                    {claimingProgramId === p.programId ? '…' : 'Vorteil abholen'}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {(badges.length > 0 || progress?.nextMilestone || progress?.topOrganizer) && (
                  <section>
                    <div className="section-head">
                      <div>
                        <h2>Abzeichen</h2>
                        <div className="sub">{badges.length > 0 ? `${badges.length} verdient` : 'Dein erstes Abzeichen wartet'}</div>
                      </div>
                    </div>
                    <div className="row gap-3" style={{ flexWrap: 'wrap' }}>
                      {badges.map((b) => {
                        const meta = badgeDisplay(b.badgeType);
                        const earned = new Date(b.earnedAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
                        return (
                          <div key={b.badgeType} className="card" style={{ padding: '16px 20px', width: 130, textAlign: 'center' }}>
                            <div style={{ fontSize: 24, fontWeight: 600, color: `oklch(0.54 0.20 ${meta.hue})`, lineHeight: 1 }}>{meta.symbol}</div>
                            <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>{meta.name}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{earned}</div>
                          </div>
                        );
                      })}
                    </div>
                    {(progress?.nextMilestone || progress?.topOrganizer) && (
                      <div style={{ display: 'grid', gap: 10, marginTop: badges.length > 0 ? 14 : 0 }}>
                        {progress?.nextMilestone && (() => {
                          const meta = badgeDisplay(progress.nextMilestone.type);
                          const remaining = progress.nextMilestone.threshold - progress.attendedCount;
                          const pct = Math.min(100, Math.round((progress.attendedCount / progress.nextMilestone.threshold) * 100));
                          return (
                            <div className="card" style={{ padding: '14px 18px' }}>
                              <div className="row gap-3" style={{ alignItems: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 600, color: `oklch(0.54 0.20 ${meta.hue})`, opacity: 0.45, lineHeight: 1, width: 24, textAlign: 'center' }}>{meta.symbol}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                                    Noch {remaining} Event{remaining !== 1 ? 's' : ''} bis „{meta.name}“
                                  </div>
                                  <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', marginTop: 8, overflow: 'hidden' }}>
                                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: `oklch(0.54 0.20 ${meta.hue})`, transition: 'width .4s ease' }} />
                                  </div>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                                  {progress.attendedCount}/{progress.nextMilestone.threshold}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        {progress?.topOrganizer && (() => {
                          const meta = badgeDisplay('loyal_organizer');
                          const remaining = progress.topOrganizer.threshold - progress.topOrganizer.attendedEvents;
                          const pct = Math.min(100, Math.round((progress.topOrganizer.attendedEvents / progress.topOrganizer.threshold) * 100));
                          return (
                            <div className="card" style={{ padding: '14px 18px' }}>
                              <div className="row gap-3" style={{ alignItems: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 600, color: `oklch(0.54 0.20 ${meta.hue})`, opacity: 0.45, lineHeight: 1, width: 24, textAlign: 'center' }}>{meta.symbol}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                                    Noch {remaining} Event{remaining !== 1 ? 's' : ''} bei {progress.topOrganizer.name} bis „{meta.name}“
                                  </div>
                                  <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', marginTop: 8, overflow: 'hidden' }}>
                                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: `oklch(0.54 0.20 ${meta.hue})`, transition: 'width .4s ease' }} />
                                  </div>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                                  {progress.topOrganizer.attendedEvents}/{progress.topOrganizer.threshold}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            <LegalLinks style={{ marginTop: 56, justifyContent: 'flex-start' }} />

          </div>
        </div>
      </div>

      {shareModal && (
        <div className="modal-backdrop" onClick={() => setShareModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Ticket-Link teilen</h3>
              <button className="close-btn" onClick={() => setShareModal(null)}><Icon name="x" size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55, marginBottom: 14 }}>
                Schicke diesen Link an eine Freundin oder einen Freund. Sobald er eingelöst wird, geht das Ticket über — und der Link wird ungültig.
              </p>
              <div className="input mono" style={{ fontSize: 12, wordBreak: 'break-all', userSelect: 'all' }}>{shareModal.url}</div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShareModal(null)}>Schließen</button>
              <button className="btn primary" onClick={() => void handleCopy(shareModal.url)}>
                {copyConfirmed ? 'Kopiert!' : 'Link kopieren'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
