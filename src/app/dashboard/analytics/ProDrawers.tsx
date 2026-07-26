'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/app/components/passlyUi';
import { nf } from './proFormat';
import type { LoyaltyTier, SegmentId } from './proTypes';

/* ── Stufe anlegen / bearbeiten ──────────────────────────────────────────── */

export interface TierDraft {
  id?: string;
  name: string;
  badge: string;
  threshold: number;
  benefitTitle: string;
  benefitDescription: string;
  active: boolean;
}

export function tierDraftFrom(tier: LoyaltyTier | null, fallbackThreshold: number): TierDraft {
  if (!tier) {
    return { name: '', badge: '', threshold: fallbackThreshold, benefitTitle: '', benefitDescription: '', active: true };
  }
  return {
    id: tier.id,
    name: tier.name,
    badge: tier.badge,
    threshold: tier.threshold,
    benefitTitle: tier.benefitTitle,
    benefitDescription: tier.benefitDescription ?? '',
    active: tier.active,
  };
}

export function TierDrawer({
  draft, saving, error, canDelete, onChange, onClose, onSave, onDelete,
}: {
  draft: TierDraft;
  saving: boolean;
  error: string | null;
  canDelete: boolean;
  onChange: (next: TierDraft) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const badge = (draft.badge || draft.name.slice(0, 1) || '★').toUpperCase();
  return (
    <Drawer
      title={draft.id ? 'Stufe bearbeiten' : 'Neue Stufe'}
      subtitle="Änderungen gelten ab dem nächsten Event"
      onClose={onClose}
      footer={
        <>
          {draft.id && (
            <button className="btn subtle" style={{ marginRight: 'auto', color: 'var(--bad)' }}
                    onClick={onDelete} disabled={saving || !canDelete}
                    title={canDelete ? undefined : 'Diese Stufe hat bereits vergebene Vorteile.'}>
              Löschen
            </button>
          )}
          <button className="btn ghost" onClick={onClose} disabled={saving}>Abbrechen</button>
          <button className="btn primary" onClick={onSave} disabled={saving || !draft.name.trim() || !draft.benefitTitle.trim()}>
            {saving ? 'Speichern …' : 'Speichern'}
          </button>
        </>
      }
    >
      <div className="field-row">
        <div className="field">
          <label htmlFor="tier-name">Name der Stufe</label>
          <input id="tier-name" className="input" maxLength={30} value={draft.name} placeholder="Gold"
                 onChange={(e) => onChange({ ...draft, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="tier-badge">Kürzel</label>
          <input id="tier-badge" className="input" maxLength={2} value={draft.badge} placeholder="G"
                 onChange={(e) => onChange({ ...draft, badge: e.target.value.toUpperCase() })} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="tier-benefit">Vorteil</label>
        <input id="tier-benefit" className="input" maxLength={80} value={draft.benefitTitle}
               placeholder="Fast Lane + Freigetränk"
               onChange={(e) => onChange({ ...draft, benefitTitle: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="tier-desc">Beschreibung für Gäste</label>
        <textarea id="tier-desc" className="textarea" maxLength={300} value={draft.benefitDescription}
                  placeholder="Einlösbar bei jedem unserer Events"
                  onChange={(e) => onChange({ ...draft, benefitDescription: e.target.value })} />
      </div>
      <div className="field" style={{ maxWidth: 220 }}>
        <label htmlFor="tier-threshold">Ab wie vielen besuchten Events?</label>
        <input id="tier-threshold" className="input" type="number" min={2} max={20} value={draft.threshold}
               onChange={(e) => onChange({ ...draft, threshold: Math.max(2, Math.min(20, Number(e.target.value) || 2)) })} />
        <span className="hint">Gezählt werden Events, bei denen der Gast eingecheckt hat.</span>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={draft.active}
               onChange={(e) => onChange({ ...draft, active: e.target.checked })} />
        Stufe aktiv
      </label>

      <div className="tier-preview">
        <div className="preview-label">Vorschau bei deinen Gästen</div>
        <div className="preview-card">
          <div className="preview-badge">{badge}</div>
          <div>
            <div className="preview-benefit">{draft.benefitTitle || 'Dein Vorteil'}</div>
            <div className="preview-sub">Zeig diesen Code am Einlass · {draft.name || 'Stufe'}</div>
          </div>
        </div>
      </div>

      {error && <div className="drawer-error">{error}</div>}
    </Drawer>
  );
}

/* ── Kampagne an ein Segment ─────────────────────────────────────────────── */

export function CampaignDrawer({
  walletAddress, segments, initialSegment, getToken, onClose, onSent,
}: {
  walletAddress: string;
  segments: { id: SegmentId | 'alle'; label: string; count: number }[];
  initialSegment: SegmentId | 'alle';
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSent: (recipients: number) => void;
}) {
  const [segment, setSegment] = useState<SegmentId | 'alle'>(initialSegment);
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [reachable, setReachable] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // The recipient count is resolved server-side from the segment id: the same
  // code path that will do the sending, so the preview can't drift from it.
  useEffect(() => {
    let cancelled = false;
    async function preview(): Promise<void> {
      setReachable(null);
      const token = await getToken();
      if (!token) return;
      const res = await fetch('/api/organizer/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletAddress, segment, preview: true }),
      });
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { recipientCount: number };
      if (!cancelled) setReachable(data.recipientCount);
    }
    void preview();
    return () => { cancelled = true; };
  }, [segment, walletAddress, getToken]);

  async function send(): Promise<void> {
    setError(null);
    setSending(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch('/api/organizer/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletAddress, segment, subject, text }),
      });
      const data = (await res.json()) as { success: boolean; recipientCount?: number; error?: string };
      if (data.success) onSent(data.recipientCount ?? 0);
      else setError(data.error ?? 'Versand fehlgeschlagen.');
    } finally {
      setSending(false);
      setConfirming(false);
    }
  }

  const ready = subject.trim().length > 0 && text.trim().length > 0 && (reachable ?? 0) > 0;

  return (
    <Drawer
      title="Kampagne senden"
      subtitle="Erreiche ein Segment per E-Mail — Versand über Passly"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose} disabled={sending}>Abbrechen</button>
          {confirming ? (
            <button className="btn primary" onClick={() => void send()} disabled={sending}>
              {sending ? 'Sende …' : `Ja, an ${nf.format(reachable ?? 0)} senden`}
            </button>
          ) : (
            <button className="btn primary" onClick={() => setConfirming(true)} disabled={!ready || sending}>
              Jetzt senden
            </button>
          )}
        </>
      }
    >
      <div className="field">
        <label htmlFor="camp-seg">Empfänger</label>
        <select id="camp-seg" className="select" value={segment}
                onChange={(e) => setSegment(e.target.value as SegmentId | 'alle')}>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>{s.label} ({nf.format(s.count)})</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="camp-subject">Betreff</label>
        <input id="camp-subject" className="input" maxLength={120} value={subject}
               placeholder="Wir vermissen dich"
               onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="camp-text">Nachricht</label>
        <textarea id="camp-text" className="textarea" style={{ minHeight: 150 }} maxLength={2000} value={text}
                  placeholder="Hey, du warst länger nicht mehr dabei …"
                  onChange={(e) => setText(e.target.value)} />
        <span className="hint">{nf.format(text.length)} / 2.000 Zeichen · reiner Text, keine Anhänge</span>
      </div>

      <div className="campaign-note">
        <Icon name="mail" size={15} />
        <span>
          {reachable == null
            ? 'Empfänger werden ermittelt …'
            : <>Erreichbar: <b>{nf.format(reachable)}</b> {reachable === 1 ? 'Gast' : 'Gäste'} mit E-Mail-Adresse in diesem Segment.
                Maximal 2 Kampagnen in 24 Stunden.</>}
        </span>
      </div>

      {confirming && !error && (
        <div className="drawer-warn">
          Die E-Mail geht sofort an {nf.format(reachable ?? 0)} Gäste raus und lässt sich nicht zurückholen.
        </div>
      )}
      {error && <div className="drawer-error">{error}</div>}
    </Drawer>
  );
}

/* ── Gemeinsames Drawer-Gerüst ───────────────────────────────────────────── */

function Drawer({
  title, subtitle, onClose, footer, children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head drawer-head-row">
          <div>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Schließen"><Icon name="x" size={16} /></button>
        </div>
        <div className="drawer-body">{children}</div>
        <div className="drawer-foot">{footer}</div>
      </div>
    </>
  );
}
