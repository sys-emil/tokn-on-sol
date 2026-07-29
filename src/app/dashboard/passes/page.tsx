'use client';

import { useLogout, usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AccountMenu } from '@/app/components/AccountMenu';
import { LegalLinks } from '@/app/components/LegalLinks';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon } from '@/app/components/passlyUi';

interface PassRow {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  capacity: number;
  ticketsSold: number;
  ticketsReserved: number;
  active: boolean;
  payoutHoldDays: number;
  createdAt: string;
  eventIds: string[];
}

interface EventRow {
  id: string;
  name: string;
  date: string;
}

const eur = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });

interface DraftState {
  passId: string | null;
  name: string;
  description: string;
  priceEuros: string;
  capacity: string;
  payoutHoldDays: string;
  eventIds: string[];
}

const emptyDraft: DraftState = {
  passId: null,
  name: '',
  description: '',
  priceEuros: '',
  capacity: '',
  payoutHoldDays: '0',
  eventIds: [],
};

const PAGE_CSS = `
  .pass-card { display: grid; gap: 14px; }
  .pass-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
  .pass-meta { display: flex; flex-wrap: wrap; gap: 18px; font-size: 13px; }
  .pass-meta > div { display: grid; gap: 2px; }
  .pass-meta .k { font-size: 11px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
  .pass-meta .v { font-weight: 600; font-variant-numeric: tabular-nums; }
  .date-grid { display: grid; gap: 6px; max-height: 260px; overflow-y: auto; padding: 4px 2px; }
  .date-pick {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; border: 1px solid var(--line); border-radius: 9px;
    cursor: pointer; font-size: 13.5px; background: var(--surface);
  }
  .date-pick.on { border-color: var(--accent-line); background: var(--accent-wash); }
  .date-pick input { accent-color: var(--accent); }
  .date-pick .d { margin-left: auto; color: var(--ink-3); font-size: 12.5px; white-space: nowrap; }
`;

export default function PassesPage() {
  const router = useRouter();
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const { logout } = useLogout({ onSuccess: () => router.push('/') });
  const { wallets: solanaWallets } = useSolanaWallets();
  const wallet = solanaWallets[0]?.address;

  const [passes, setPasses] = useState<PassRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await getAccessToken();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` };
  }, [getAccessToken]);

  const load = useCallback(async (): Promise<void> => {
    if (!wallet) return;
    try {
      const headers = await authHeaders();
      const [passRes, eventRes] = await Promise.all([
        fetch(`/api/organizer/passes?walletAddress=${wallet}`, { headers }),
        fetch(`/api/events/list?organizerWallet=${wallet}`, { headers }),
      ]);
      if (passRes.ok) setPasses(((await passRes.json()) as { passes: PassRow[] }).passes);
      if (eventRes.ok) {
        const json = (await eventRes.json()) as { events: EventRow[] };
        setEvents([...json.events].sort((a, b) => a.date.localeCompare(b.date)));
      }
    } finally {
      setLoaded(true);
    }
  }, [wallet, authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(): Promise<void> {
    if (!draft || !wallet) return;
    setBusy(true);
    setError(null);

    const priceCents = Math.round(parseFloat(draft.priceEuros.replace(',', '.')) * 100);
    const body = {
      walletAddress: wallet,
      ...(draft.passId ? { passId: draft.passId } : {}),
      name: draft.name,
      description: draft.description,
      priceEur: Number.isFinite(priceCents) ? priceCents : NaN,
      capacity: parseInt(draft.capacity, 10),
      payoutHoldDays: parseInt(draft.payoutHoldDays, 10) || 0,
      eventIds: draft.eventIds,
    };

    try {
      const res = await fetch('/api/organizer/passes', {
        method: draft.passId ? 'PUT' : 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Speichern fehlgeschlagen');
        return;
      }
      setDraft(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(pass: PassRow): Promise<void> {
    if (!wallet) return;
    setBusy(true);
    try {
      await fetch('/api/organizer/passes', {
        method: 'DELETE',
        headers: await authHeaders(),
        body: JSON.stringify({ walletAddress: wallet, passId: pass.id }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function setActive(pass: PassRow, active: boolean): Promise<void> {
    if (!wallet) return;
    setBusy(true);
    try {
      await fetch('/api/organizer/passes', {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify({ walletAddress: wallet, passId: pass.id, active }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !authenticated) return null;

  const email = user?.email?.address ?? '';
  const eventName = new Map(events.map((e) => [e.id, e]));

  return (
    <div className="app">
      <style>{PAGE_CSS}</style>
      <div className="topbar">
        <div className="topbar-inner">
          <PasslyLogo height={24} />
          <div className="nav">
            <Link href="/dashboard">Übersicht</Link>
            <Link href="/dashboard/passes" className="active">Saisonpässe</Link>
            <Link href="/dashboard/payouts">Auszahlungen</Link>
            <Link href="/dashboard/analytics">Pro</Link>
            <Link href="/events">Events</Link>
          </div>
          <div className="topbar-right">
            <AccountMenu email={email} walletAddress={wallet} onLogout={() => logout()} />
          </div>
        </div>
      </div>

      <div className="main">
        <div className="aurora" />
        <div className="container">
          <div className="hero">
            <div className="eyebrow"><span className="pulse" /> Saisonpässe</div>
            <h1>Ein Ticket, <br />die ganze Saison.</h1>
            <p className="lead">
              Ein Pass gilt für alle Termine, die du ihm zuordnest. Am Einlass wird er
              pro Termin einmal eingelöst, danach ist er für den nächsten wieder gültig.
            </p>
          </div>

          <section>
            <div className="section-head">
              <div>
                <h2>Deine Pässe</h2>
                <div className="sub">Eigene Stückzahl, unabhängig von den Kontingenten der einzelnen Termine</div>
              </div>
              <button className="btn" onClick={() => { setError(null); setDraft({ ...emptyDraft }); }}>
                <Icon name="plus" size={15} strokeWidth={2.2} /> Pass anlegen
              </button>
            </div>

            {!loaded ? (
              <div className="card"><div className="empty">Lade …</div></div>
            ) : passes.length === 0 ? (
              <div className="card">
                <div className="empty">
                  Noch kein Saisonpass. Leg einen an, wähl die Termine aus, und Fans kaufen
                  die Reihe mit einem Kauf.
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {passes.map((p) => {
                  const dates = p.eventIds
                    .map((id) => eventName.get(id))
                    .filter((e): e is EventRow => Boolean(e))
                    .sort((a, b) => a.date.localeCompare(b.date));
                  return (
                    <div key={p.id} className="card pass-card">
                      <div className="pass-head">
                        <div>
                          <div style={{ fontSize: 16.5, fontWeight: 600, letterSpacing: '-0.015em' }}>{p.name}</div>
                          {p.description && (
                            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4, maxWidth: 560, lineHeight: 1.5 }}>
                              {p.description}
                            </div>
                          )}
                        </div>
                        {p.active
                          ? <span className="chip ok"><span className="d" />Im Verkauf</span>
                          : <span className="chip"><span className="d" />Beendet</span>}
                      </div>

                      <div className="pass-meta">
                        <div><span className="k">Preis</span><span className="v">{eur(p.priceCents)}</span></div>
                        <div><span className="k">Verkauft</span><span className="v">{p.ticketsSold} / {p.capacity}</span></div>
                        <div><span className="k">Termine</span><span className="v">{p.eventIds.length}</span></div>
                        <div><span className="k">Auszahlungs-Puffer</span><span className="v">{p.payoutHoldDays} Tage</span></div>
                      </div>

                      {dates.length > 0 && (
                        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                          {dates.map((d) => `${d.name} · ${dayLabel(d.date)}`).join('  ·  ')}
                        </div>
                      )}

                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <button
                          className="btn ghost sm"
                          onClick={() => {
                            setError(null);
                            setDraft({
                              passId: p.id,
                              name: p.name,
                              description: p.description ?? '',
                              priceEuros: (p.priceCents / 100).toFixed(2),
                              capacity: String(p.capacity),
                              payoutHoldDays: String(p.payoutHoldDays),
                              eventIds: p.eventIds,
                            });
                          }}
                        >
                          Bearbeiten
                        </button>
                        <Link className="btn ghost sm" href={`/pass/${p.id}`}>Verkaufsseite</Link>
                        {p.active ? (
                          <button className="btn ghost sm" disabled={busy} onClick={() => void setActive(p, false)}>
                            Verkauf beenden
                          </button>
                        ) : (
                          <button className="btn ghost sm" disabled={busy} onClick={() => void setActive(p, true)}>
                            Wieder verkaufen
                          </button>
                        )}
                        {p.ticketsSold === 0 && (
                          <button className="btn ghost sm" disabled={busy} onClick={() => void remove(p)}>
                            Löschen
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <LegalLinks style={{ marginTop: 56, justifyContent: 'flex-start' }} />
        </div>
      </div>

      {draft && (
        <>
          <div className="drawer-backdrop" onClick={() => !busy && setDraft(null)} />
          <div className="drawer" role="dialog" aria-labelledby="passDrawerTitle">
            <div className="drawer-head">
              <h3 id="passDrawerTitle">{draft.passId ? 'Pass bearbeiten' : 'Saisonpass anlegen'}</h3>
              <p>Ein Pass gilt für alle Termine, die du ihm zuordnest.</p>
            </div>

            <div className="drawer-body" style={{ display: 'grid', gap: 14 }}>
              <div className="field">
                <label>Name</label>
                <input
                  className="input"
                  value={draft.name}
                  maxLength={80}
                  placeholder="Saisonpass 2026"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Beschreibung <span className="muted">(optional)</span></label>
                <textarea
                  className="textarea"
                  rows={3}
                  value={draft.description}
                  maxLength={2000}
                  placeholder="Was steckt drin?"
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>Preis (€)</label>
                  <input
                    className="input"
                    inputMode="decimal"
                    value={draft.priceEuros}
                    placeholder="99,00"
                    onChange={(e) => setDraft({ ...draft, priceEuros: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Stückzahl</label>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={draft.capacity}
                    placeholder="100"
                    onChange={(e) => setDraft({ ...draft, capacity: e.target.value })}
                  />
                </div>
              </div>

              <div className="field">
                <label>Auszahlungs-Puffer (Tage)</label>
                <input
                  className="input"
                  inputMode="numeric"
                  value={draft.payoutHoldDays}
                  onChange={(e) => setDraft({ ...draft, payoutHoldDays: e.target.value })}
                />
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 5, lineHeight: 1.5 }}>
                  Gerechnet ab dem Kauf, nicht ab einem Termin — ein Pass läuft über viele
                  Termine, und so lange soll dein Geld nicht liegen.
                </div>
              </div>

              <div className="field">
                <label>Termine <span className="muted">({draft.eventIds.length} ausgewählt)</span></label>
                {events.length === 0 ? (
                  <div className="empty" style={{ padding: 18 }}>
                    Du hast noch keine Events. Leg zuerst die Termine an.
                  </div>
                ) : (
                  <div className="date-grid">
                    {events.map((ev) => {
                      const on = draft.eventIds.includes(ev.id);
                      return (
                        <label key={ev.id} className={`date-pick${on ? ' on' : ''}`}>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() =>
                              setDraft({
                                ...draft,
                                eventIds: on
                                  ? draft.eventIds.filter((id) => id !== ev.id)
                                  : [...draft.eventIds, ev.id],
                              })
                            }
                          />
                          <span>{ev.name}</span>
                          <span className="d">{dayLabel(ev.date)}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
                  Der Pass belegt keine Plätze in diesen Events; seine Stückzahl ist ein
                  eigenes Kontingent obendrauf.
                </div>
              </div>

              {error && (
                <div className="chip bad" style={{ alignSelf: 'start' }}><span className="d" />{error}</div>
              )}
            </div>

            <div className="drawer-foot">
              <button className="btn ghost" onClick={() => setDraft(null)} disabled={busy}>Abbrechen</button>
              <button className="btn" onClick={() => void save()} disabled={busy}>
                {busy ? 'Speichert …' : draft.passId ? 'Änderungen speichern' : 'Pass anlegen'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
