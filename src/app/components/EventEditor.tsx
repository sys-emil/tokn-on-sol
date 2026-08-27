'use client';

import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { useState } from 'react';
import { Icon, EventStyleFields } from '@/app/components/passlyUi';
import { EventImagePicker } from '@/app/components/EventImagePicker';
import { EventPreview } from '@/app/components/eventSurfaces/EventPreview';
import type { PreviewDraft } from '@/app/components/eventSurfaces/EventPreview';
import { minUnitPriceCentsFor, splitServiceFee, tooCheapForFeePayer, type FeePayer } from '@/lib/fees';
import { freeCapacityExceeded, freeCapacityOf } from '@/lib/freeTickets';

/**
 * Event anlegen und bearbeiten mit Live-Vorschau.
 *
 * Links steht, wie das Event bei den Gaesten ankommt, rechts wird es
 * eingestellt. Vorher war das Anlegen Blindflug: 13 Felder in einer
 * 460px-Schublade, deren einzige Rueckmeldung ein Datums-Badge war.
 *
 * Ein einziges `draft`-Objekt statt fuenfzehn Einzel-States — dadurch kann
 * kein Feld beim Zuruecksetzen vergessen werden (genau das passierte vorher
 * mit den Weiterverkaufs-Feldern).
 */

export interface TierDraft {
  /** Vorhandene Kategorie beim Bearbeiten. */
  id?: string;
  name: string;
  priceEur: string;
  capacity: string;
  /** Verkauft + reserviert; die Kapazitaet darf nicht darunter fallen. */
  committed?: number;
}

export interface EventDraft {
  name: string;
  date: string;
  startTime: string;
  venue: string;
  description: string;
  longDescription: string;
  tiers: TierDraft[];
  imageUrl: string | null;
  galleryUrls: string[];
  accentHue: number | null;
  borderStyle: string | null;
  isPrivate: boolean;
  payoutHoldDays: string;
  /** Wer die Servicegebuehr traegt; siehe splitServiceFee in src/lib/fees.ts. */
  feePayer: FeePayer;
  resaleEnabled: boolean;
  guestCheckout: boolean;
  reentryEnabled: boolean;
  /** Minuten zwischen zwei Scans desselben Tickets; die API rechnet in Sekunden. */
  reentryCooldownMinutes: string;
  queueEnabled: boolean;
  queueSlots: string;
  ticketsSold?: number;
  ticketsReserved?: number;
}

export const INITIAL_DRAFT: EventDraft = {
  name: '', date: '', startTime: '', venue: '', description: '', longDescription: '',
  tiers: [{ name: 'Standard', priceEur: '0', capacity: '100' }],
  imageUrl: null, galleryUrls: [], accentHue: null, borderStyle: null,
  isPrivate: false, payoutHoldDays: '0', feePayer: 'buyer',
  resaleEnabled: false,
  guestCheckout: true, reentryEnabled: false, reentryCooldownMinutes: '2',
  queueEnabled: false, queueSlots: '50',
};

const MAX_TIERS = 5;

/**
 * Unter diesem Preis schlaegt der Editor vor, dass der Veranstalter die
 * Servicegebuehr uebernimmt. Prozentual sieht ein Aufschlag hier hart aus
 * (0,99 € auf ein 8-€-Ticket sind 12 %), waehrend ein runder Eintrittspreis
 * so aussieht wie an der Tuer. Es bleibt ein Vorschlag: derselbe Euro, nur
 * anders praesentiert, und der Schalter daneben kippt ihn jederzeit.
 */
const CHEAP_TICKET_CENTS = 1_200;

const eur = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

export function EventEditor({
  mode,
  initial,
  eventId,
  ownerWallet,
  isPro,
  onSaved,
}: {
  mode: 'create' | 'edit';
  initial?: EventDraft;
  eventId?: string;
  ownerWallet: string;
  isPro: boolean;
  /** Bearbeiten: die Seite laedt danach neu. Anlegen: ungenutzt, der Editor zeigt den Link. */
  onSaved?: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const [draft, setDraft] = useState<EventDraft>(initial ?? INITIAL_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mobilePane, setMobilePane] = useState<'preview' | 'settings'>('settings');

  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setTier = (i: number, patch: Partial<TierDraft>) =>
    setDraft((d) => ({ ...d, tiers: d.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));

  /**
   * Gratis-Tickets tragen keine Servicegebuehr, kosten aber je Stueck einen
   * Mint und eine Bestaetigungsmail. Die Obergrenze steht in `freeTickets.ts`
   * und wird serverseitig durchgesetzt; hier steht sie nur, damit niemand
   * vergeblich auf Speichern drueckt.
   *
   * Beim Bearbeiten gilt derselbe Bestandsschutz wie in der Route: ein Event,
   * das schon vorher darueber lag, bleibt speicherbar, solange es nicht waechst.
   */
  const asCents = (t: TierDraft) => ({
    price_eur: Math.round((Number(t.priceEur) || 0) * 100),
    capacity: Number(t.capacity) || 0,
  });
  const freeOverflow = freeCapacityExceeded({
    tiers: draft.tiers.map(asCents),
    plan: isPro ? 'pro' : 'free',
    previousFreeCapacity: mode === 'edit' && initial
      ? freeCapacityOf(initial.tiers.map(asCents))
      : undefined,
  });

  const canSave = !!draft.name.trim() && !!draft.date
    && draft.tiers.length > 0
    && draft.tiers.every((t) => t.name.trim() && (Number(t.capacity) || 0) > 0)
    && !freeOverflow
    && !saving && !createdLink;

  const anyPaid = draft.tiers.some((t) => (Number(t.priceEur) || 0) > 0);

  /** Bezahlte Kategorien, guenstigste zuerst — Bezugspunkt fuer alles Folgende. */
  const paidTiers = draft.tiers
    .map((t) => ({ name: t.name.trim() || 'Standard', cents: Math.round((Number(t.priceEur) || 0) * 100) }))
    .filter((t) => t.cents > 0)
    .sort((a, b) => a.cents - b.cents);
  const cheapestPaid = paidTiers[0] ?? null;

  /**
   * Der Gebuehren-Vorschlag fuer billige Events (siehe CHEAP_TICKET_CENTS).
   *
   * Sobald der Veranstalter den Schalter einmal angefasst hat, fassen wir ihn
   * nie wieder an. Beim Bearbeiten gilt er von vornherein als angefasst: dort
   * ist `fee_payer` eine getroffene Entscheidung ueber echtes Geld und darf
   * sich nicht dadurch verschieben, dass jemand einen Preis korrigiert.
   *
   * Nicht unter `minUnitPriceCentsFor('organizer')` vorschlagen — die Gebuehr
   * waere hoeher als das Ticket und das Speichern schluege fehl.
   */
  const [feePayerTouched, setFeePayerTouched] = useState(mode === 'edit');
  const suggestOrganizerFee = !feePayerTouched
    && cheapestPaid !== null
    && cheapestPaid.cents < CHEAP_TICKET_CENTS
    && cheapestPaid.cents >= minUnitPriceCentsFor('organizer');

  /**
   * Der Vorschlag ist *abgeleitet*, nicht in den Draft geschrieben: er soll
   * dem Preis folgen, solange niemand ihn angefasst hat, und genau ab dem
   * ersten Klick nicht mehr. Ein State-Sync haette denselben Effekt nur
   * verzoegert und mit einer Runde ueberfluessigem Rendern.
   */
  const feePayer: FeePayer = suggestOrganizerFee ? 'organizer' : draft.feePayer;

  const pickFeePayer = (payer: FeePayer) => {
    setFeePayerTouched(true);
    set('feePayer', payer);
  };

  /**
   * Was der Gebuehren-Schalter konkret bedeutet, gerechnet an der guenstigsten
   * bezahlten Kategorie — dort ist der Anteil relativ am groessten, und bei
   * mehreren Kategorien waere eine Zahl ohne Bezug nicht nachvollziehbar.
   */
  const feeHint = (() => {
    const paid = paidTiers;
    const cheapest = cheapestPaid;
    if (!cheapest) return { text: '', thin: false };
    const { buyerCents, organizerCents, totalCents } = splitServiceFee(cheapest.cents, feePayer);
    const net = cheapest.cents - organizerCents;
    const named = paid.length > 1 ? ` Bei „${cheapest.name}“` : ' Davon';
    if (feePayer === 'buyer') {
      return {
        text: `Der Gast zahlt ${eur(totalCents)} pro Ticket obendrauf und damit ${eur(cheapest.cents + buyerCents)}.`
          + ` Du bekommst die vollen ${eur(cheapest.cents)}.`,
        thin: false,
      };
    }
    const guestPays = `Der Gast zahlt ${eur(cheapest.cents + buyerCents)} pro Ticket`;
    return {
      text: feePayer === 'organizer'
        ? `${guestPays} – keine Gebühr obendrauf.${named} bleiben dir ${eur(net)}.`
        : `${guestPays}, ${eur(organizerCents)} trägst du.${named} bleiben dir ${eur(net)}.`,
      thin: net < cheapest.cents * 0.2,
    };
  })();

  /** Gemeinsame Pruefung beider Modi; gibt die geparsten Kategorien zurueck. */
  function validate(): { tiers: { id?: string; name: string; price_eur: number; capacity: number }[]; holdDays: number; reentryCooldownSeconds: number } | null {
    const parsed = draft.tiers.map((t) => ({
      id: t.id,
      name: t.name.trim(),
      priceEurNum: Number(t.priceEur) || 0,
      capacity: Math.floor(Number(t.capacity)) || 0,
      committed: t.committed ?? 0,
    }));
    for (const t of parsed) {
      if (!t.name) { setError('Jede Ticketkategorie braucht einen Namen.'); return null; }
      if (t.priceEurNum < 0) { setError(`Der Preis für „${t.name}“ muss 0 oder größer sein.`); return null; }
      if (!Number.isInteger(t.capacity) || t.capacity < 1) {
        setError(`Die Ticketanzahl für „${t.name}“ muss mindestens 1 sein.`); return null;
      }
      if (t.capacity < t.committed) {
        setError(`Kapazität von „${t.name}“ kann nicht unter ${t.committed} (verkauft + reserviert) sinken.`); return null;
      }
    }
    const names = new Set(parsed.map((t) => t.name.toLowerCase()));
    if (names.size !== parsed.length) { setError('Die Namen der Ticketkategorien müssen eindeutig sein.'); return null; }
    if (parsed.reduce((s, t) => s + t.capacity, 0) > 10000) {
      setError('Insgesamt sind höchstens 10.000 Tickets möglich.'); return null;
    }
    const holdDays = Math.floor(Number(draft.payoutHoldDays)) || 0;
    if (holdDays < 0 || holdDays > 90) { setError('Der Auszahlungs-Puffer muss zwischen 0 und 90 Tagen liegen.'); return null; }
    // Wer die Gebuehr traegt, muss zum Preis passen: ein Ticket, das billiger
    // ist als der eigene Gebuehrenanteil, liesse dem Veranstalter nichts uebrig.
    const priceCents = parsed.map((t) => Math.round(t.priceEurNum * 100));
    const tooCheap = tooCheapForFeePayer(priceCents, feePayer);
    if (tooCheap !== null) {
      const tier = parsed[priceCents.indexOf(tooCheap)];
      const floor = eur(minUnitPriceCentsFor(feePayer));
      setError(feePayer === 'organizer'
        ? `Wenn du die Servicegebühr übernimmst, muss ein Ticket mindestens ${floor} kosten. „${tier.name}“ kostet ${eur(tooCheap)} – die Gebühr wäre höher als der Preis.`
        : `Bei „Halbe/Halbe“ muss ein Ticket mindestens ${floor} kosten. „${tier.name}“ kostet ${eur(tooCheap)} – davon bliebe dir nichts.`);
      return null;
    }
    const reentryCooldownSeconds = Math.round((Number(draft.reentryCooldownMinutes) || 0) * 60);
    if (draft.reentryEnabled && (reentryCooldownSeconds < 0 || reentryCooldownSeconds > 3600)) {
      setError('Die Pause zwischen zwei Scans muss zwischen 0 und 60 Minuten liegen.'); return null;
    }
    return {
      reentryCooldownSeconds,
      tiers: parsed.map((t) => ({ ...(t.id ? { id: t.id } : {}), name: t.name, price_eur: Math.round(t.priceEurNum * 100), capacity: t.capacity })),
      holdDays,
    };
  }

  async function save(): Promise<void> {
    if (saving) return;
    setError(null);
    const checked = validate();
    if (!checked) return;

    setSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) { setError('Nicht angemeldet. Bitte melde dich ab und wieder an.'); return; }

      const common = {
        name: draft.name.trim(),
        date: draft.date,
        start_time: draft.startTime || null,
        venue: draft.venue.trim() || null,
        description: draft.description.trim() || null,
        long_description: draft.longDescription.trim() || null,
        image_url: draft.imageUrl,
        gallery_urls: draft.galleryUrls,
        is_private: draft.isPrivate,
        payout_hold_days: checked.holdDays,
        fee_payer: feePayer,
        resale_enabled: draft.resaleEnabled,
        accent_hue: draft.accentHue,
        border_style: draft.borderStyle,
        reentry_enabled: draft.reentryEnabled,
        reentry_cooldown_seconds: checked.reentryCooldownSeconds,
      };

      const res = mode === 'create'
        ? await fetch('/api/events/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ organizer_wallet: ownerWallet, ...common, tiers: checked.tiers }),
          })
        : await fetch('/api/events/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              eventId,
              organizer_wallet: ownerWallet,
              action: 'update',
              fields: {
                ...common,
                guest_checkout_enabled: draft.guestCheckout,
                queue_enabled: draft.queueEnabled,
                queue_slots: Math.min(1000, Math.max(1, Math.floor(Number(draft.queueSlots)) || 50)),
              },
              tiers: checked.tiers,
            }),
          });

      const data = (await res.json()) as { success: true; id?: string } | { success: false; error: string };
      if (!res.ok || !data.success) {
        const message = !data.success ? data.error : `HTTP ${res.status}`;
        setError(message === 'pro_required'
          ? 'Der Kartenrand ist eine Pro-Funktion.'
          : `Speichern fehlgeschlagen: ${message}`);
        return;
      }

      if (mode === 'create' && data.id) {
        setCreatedLink(`${window.location.origin}/event/${data.id}`);
      } else {
        onSaved?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const previewDraft: PreviewDraft = {
    name: draft.name,
    date: draft.date,
    startTime: draft.startTime,
    venue: draft.venue,
    description: draft.description,
    longDescription: draft.longDescription,
    tiers: draft.tiers.map((t) => ({ name: t.name, priceEur: t.priceEur, capacity: t.capacity })),
    imageUrl: draft.imageUrl,
    galleryUrls: draft.galleryUrls,
    feePayer,
    accentHue: draft.accentHue,
    borderStyle: draft.borderStyle,
    ticketsSold: draft.ticketsSold,
    ticketsReserved: draft.ticketsReserved,
  };

  return (
    <div className="eed">
      <style>{EDITOR_CSS}</style>

      <div className="seg eed-panetoggle">
        <button type="button" className={mobilePane === 'preview' ? 'active' : ''} onClick={() => setMobilePane('preview')}>Vorschau</button>
        <button type="button" className={mobilePane === 'settings' ? 'active' : ''} onClick={() => setMobilePane('settings')}>Einstellungen</button>
      </div>

      <div className={`eed-preview${mobilePane === 'preview' ? '' : ' hide-mobile'}`}>
        <EventPreview draft={previewDraft} />
      </div>

      <aside className={`eed-panel${mobilePane === 'settings' ? '' : ' hide-mobile'}`}>
        {createdLink ? (
          <div className="eed-done">
            <div className="ok"><Icon name="check" size={16} /> Veranstaltung erstellt.</div>
            <p>Teile diesen Link, damit Gäste Tickets bekommen:</p>
            <input className="input mono" readOnly value={createdLink} onFocus={(e) => e.target.select()} style={{ fontSize: 12 }} />
            <div className="eed-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(createdLink).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
              >
                <Icon name="share" size={13} /> {copied ? 'Kopiert!' : 'Link kopieren'}
              </button>
              <Link href="/dashboard" className="btn primary">Zum Dashboard <Icon name="arrow" size={13} /></Link>
            </div>
          </div>
        ) : (
          <>
            <div className="field">
              <label>Name der Veranstaltung</label>
              <input className="input" placeholder="z. B. Sommerkonzert 2026" value={draft.name}
                onChange={(e) => set('name', e.target.value)} maxLength={120} disabled={saving} />
            </div>

            <div className="field-row">
              <div className="field">
                <label>Datum</label>
                <div className="date-field">
                  <span className="date-field-icon"><Icon name="calendar" size={15} /></span>
                  <input type="date" className="input" value={draft.date} onChange={(e) => set('date', e.target.value)} disabled={saving} />
                </div>
              </div>
              <div className="field">
                <label>Beginn (optional)</label>
                <div className="date-field">
                  <span className="date-field-icon"><Icon name="clock" size={15} /></span>
                  <input type="time" className="input" value={draft.startTime} onChange={(e) => set('startTime', e.target.value)} disabled={saving} />
                </div>
              </div>
            </div>

            <div className="field">
              <label>Veranstaltungsort</label>
              <input className="input" placeholder="z. B. Aula der Schule, Augsburg" value={draft.venue}
                onChange={(e) => set('venue', e.target.value)} maxLength={200} disabled={saving} />
              <span className="hint">Der Teil hinter dem letzten Komma gilt als Stadt und landet im Stadtfilter.</span>
            </div>

            <div className="field">
              <label>Ticketkategorien</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {draft.tiers.map((t, i) => (
                  <div key={t.id ?? `new-${i}`} className="eed-tier">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input className="input" placeholder="z. B. Early Bird, VIP" value={t.name} maxLength={80}
                        onChange={(e) => setTier(i, { name: e.target.value })} disabled={saving} />
                      {draft.tiers.length > 1 && !t.committed && (
                        <button type="button" className="close-btn" aria-label="Kategorie entfernen"
                          onClick={() => setDraft((d) => ({ ...d, tiers: d.tiers.filter((_, j) => j !== i) }))} disabled={saving}>
                          <Icon name="x" size={14} />
                        </button>
                      )}
                    </div>
                    <div className="field-row" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className="hint">Preis pro Ticket (€)</span>
                        <input type="number" className="input" value={t.priceEur} min={0} step={0.5}
                          onChange={(e) => setTier(i, { priceEur: e.target.value })} disabled={saving} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className="hint">Anzahl Tickets</span>
                        <input type="number" className="input" value={t.capacity} min={1} max={10000}
                          onChange={(e) => setTier(i, { capacity: e.target.value })} disabled={saving} />
                      </div>
                    </div>
                    {!!t.committed && <span className="hint">{t.committed} bereits verkauft oder reserviert.</span>}
                  </div>
                ))}
                {draft.tiers.length < MAX_TIERS && (
                  <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }}
                    onClick={() => setDraft((d) => ({ ...d, tiers: [...d.tiers, { name: '', priceEur: '0', capacity: '50' }] }))}
                    disabled={saving}>
                    + Kategorie hinzufügen
                  </button>
                )}
              </div>
              <span className="hint">Preis 0 = kostenlos. Eine Kategorie namens „VIP“ bekommt automatisch die goldene Ticketkarte.</span>
              {freeOverflow && (
                <span className="hint" style={{ color: 'var(--warn, #a16207)' }}>
                  {freeOverflow.requested} kostenlose Tickets — mehr als {freeOverflow.cap} gehen pro Event nicht.
                  {!isPro && ' Mit Pro fällt diese Grenze weg.'}
                  {' '}Bezahlte Kategorien sind davon nicht betroffen.
                </span>
              )}
            </div>

            <div className="field">
              <label>Titelbild</label>
              <EventImagePicker
                urls={draft.imageUrl ? [draft.imageUrl] : []}
                onChange={(urls) => set('imageUrl', urls[0] ?? null)}
                ownerWallet={ownerWallet}
                max={1}
                disabled={saving}
                onError={setError}
              />
              <span className="hint">JPEG, PNG oder WebP, max. 4 MB. Erscheint auf allen vier Ansichten links.</span>
            </div>

            <div className="field">
              <label>Beschreibung (optional)</label>
              <textarea className="textarea" rows={3} placeholder="Kurzer Hinweis für Gäste …" value={draft.description}
                onChange={(e) => set('description', e.target.value)} maxLength={2000} disabled={saving} />
              <span className="hint">Der Teaser auf der Kaufseite und in der Google-Vorschau.</span>
            </div>

            <div className="field">
              <label>Ausführliche Beschreibung (optional)</label>
              <textarea className="textarea" rows={6} placeholder="Line-up, Ablauf, Hausordnung, Anfahrt …" value={draft.longDescription}
                onChange={(e) => set('longDescription', e.target.value)} maxLength={6000} disabled={saving} />
              <span className="hint">Steht auf der Event-Seite unter „Übersicht“.</span>
            </div>

            <div className="field">
              <label>Galerie (optional)</label>
              <EventImagePicker
                urls={draft.galleryUrls}
                onChange={(urls) => set('galleryUrls', urls)}
                ownerWallet={ownerWallet}
                max={8}
                disabled={saving}
                onError={setError}
              />
              <span className="hint">Bis zu 8 Bilder. Ohne Bilder fehlt der Galerie-Bereich ganz.</span>
            </div>

            <EventStyleFields
              accentHue={draft.accentHue}
              onAccentHueChange={(hue) => set('accentHue', hue)}
              borderStyle={draft.borderStyle}
              onBorderStyleChange={(style) => set('borderStyle', style)}
              isPro={isPro}
              disabled={saving}
            />

            <div className="field">
              <label>Sichtbarkeit</label>
              <div className="seg">
                <button type="button" className={!draft.isPrivate ? 'active' : ''} onClick={() => set('isPrivate', false)} disabled={saving}>Öffentlich</button>
                <button type="button" className={draft.isPrivate ? 'active' : ''} onClick={() => set('isPrivate', true)} disabled={saving}>Privat</button>
              </div>
              <span className="hint">
                {draft.isPrivate ? 'Nur über den direkten Link erreichbar.' : 'Erscheint in der öffentlichen Event-Liste.'}
              </span>
            </div>

            {anyPaid && (
              <div className="field">
                <label>Servicegebühr (7,9 % pro Ticket, mindestens 0,99 €)</label>
                <div className="seg">
                  <button type="button" className={feePayer === 'buyer' ? 'active' : ''} onClick={() => pickFeePayer('buyer')} disabled={saving}>Gast zahlt</button>
                  <button type="button" className={feePayer === 'split' ? 'active' : ''} onClick={() => pickFeePayer('split')} disabled={saving}>Halbe/Halbe</button>
                  <button type="button" className={feePayer === 'organizer' ? 'active' : ''} onClick={() => pickFeePayer('organizer')} disabled={saving}>Ich übernehme</button>
                </div>
                <span className="hint">{feeHint.text}</span>
                {suggestOrganizerFee && (
                  <span className="hint">
                    Vorgeschlagen, weil deine Tickets günstig sind: prozentual sieht ein
                    Aufschlag hier hart aus, ein runder Eintrittspreis wie an der Tür nicht.
                    Du kannst jederzeit umstellen.
                  </span>
                )}
                {feeHint.thin && (
                  <span className="hint" style={{ color: 'var(--warn, #a16207)' }}>
                    Bei diesem Preis bleibt dir kaum etwas übrig.
                  </span>
                )}
              </div>
            )}

            {anyPaid && (
              <div className="field">
                <label>Auszahlungs-Puffer (Tage nach dem Event)</label>
                <input type="number" className="input" value={draft.payoutHoldDays} min={0} max={90} step={1}
                  onChange={(e) => set('payoutHoldDays', e.target.value)} disabled={saving} />
                <span className="hint">
                  0 = tägliche automatische Auszahlung. Ein Puffer hält Einnahmen als Rückbuchungsschutz zurück.
                </span>
              </div>
            )}

            <div className="field">
              <label>Ticket-Rückgabe</label>
              <div className="seg">
                <button type="button" className={!draft.resaleEnabled ? 'active' : ''} onClick={() => set('resaleEnabled', false)} disabled={saving}>Aus</button>
                <button type="button" className={draft.resaleEnabled ? 'active' : ''} onClick={() => set('resaleEnabled', true)} disabled={saving}>Erlauben</button>
              </div>
              <span className="hint">
                {draft.resaleEnabled
                  ? 'Gäste können ihr Ticket zurückgeben. Der Platz geht zum Originalpreis zurück in den Verkauf, der Gast bekommt sein Geld abzüglich 10 % Rückgabegebühr auf seine Zahlungsmethode erstattet. Für dich ändert sich nichts: Du wurdest für den Platz bereits bezahlt.'
                  : 'Gäste können ihr Ticket nicht zurückgeben (nur kostenlos per Link weitergeben).'}
              </span>
            </div>

            <div className="field">
              <label>Wiedereinlass (Re-Entry)</label>
              <div className="seg">
                <button type="button" className={!draft.reentryEnabled ? 'active' : ''} onClick={() => set('reentryEnabled', false)} disabled={saving}>Aus</button>
                <button type="button" className={draft.reentryEnabled ? 'active' : ''} onClick={() => set('reentryEnabled', true)} disabled={saving}>Erlauben</button>
              </div>
              {draft.reentryEnabled ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Pause zwischen zwei Scans</span>
                    <input type="number" className="input" style={{ width: 90 }} value={draft.reentryCooldownMinutes} min={0} max={60} step={1}
                      onChange={(e) => set('reentryCooldownMinutes', e.target.value)} disabled={saving} />
                    <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Minuten</span>
                  </div>
                  <span className="hint">
                    Gäste können rausgehen: Beim Verlassen wird derselbe QR-Code gescannt und der Gast ausgecheckt,
                    beim Zurückkommen wieder eingecheckt. Die Pause verhindert, dass ein Code mehrere Personen
                    hintereinander reinschleust.
                  </span>
                </>
              ) : (
                <span className="hint">Jedes Ticket lässt genau einmal ein. Ein zweiter Scan wird abgelehnt.</span>
              )}
            </div>

            {mode === 'edit' && (
              <>
                <div className="field">
                  <label>Kauf ohne Konto</label>
                  <div className="seg">
                    <button type="button" className={draft.guestCheckout ? 'active' : ''} onClick={() => set('guestCheckout', true)} disabled={saving}>Erlauben</button>
                    <button type="button" className={!draft.guestCheckout ? 'active' : ''} onClick={() => set('guestCheckout', false)} disabled={saving}>Konto nötig</button>
                  </div>
                  <span className="hint">Gäste zahlen zuerst und legen danach das Konto an, das ihr Ticket freischaltet.</span>
                </div>
                <div className="field">
                  <label>Warteschlange beim Verkaufsstart</label>
                  <div className="seg">
                    <button type="button" className={!draft.queueEnabled ? 'active' : ''} onClick={() => set('queueEnabled', false)} disabled={saving}>Aus</button>
                    <button type="button" className={draft.queueEnabled ? 'active' : ''} onClick={() => set('queueEnabled', true)} disabled={saving}>An</button>
                  </div>
                  {draft.queueEnabled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                      <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Gleichzeitig im Kauf</span>
                      <input type="number" className="input" style={{ width: 90 }} value={draft.queueSlots} min={1} max={1000}
                        onChange={(e) => set('queueSlots', e.target.value)} disabled={saving} />
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="eed-trust">
              <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}><Icon name="shield" size={16} /></span>
              <span>
                <b>Fälschungsschutz ist aktiv.</b> Jedes Ticket erhält einen einzigartigen QR-Code.
                Kopien werden beim Einlass automatisch erkannt.
              </span>
            </div>

            {error && <div className="eed-error">{error}</div>}

            <div className="eed-actions">
              <Link href={mode === 'edit' && eventId ? `/dashboard/events/${eventId}` : '/dashboard'} className="btn ghost">
                Abbrechen
              </Link>
              <button className="btn primary" disabled={!canSave} onClick={() => void save()}>
                {saving
                  ? 'Wird gespeichert …'
                  : mode === 'create'
                    ? <>Veranstaltung erstellen <Icon name="arrow" size={13} /></>
                    : 'Änderungen speichern'}
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

/**
 * Ladezustand des Editors.
 *
 * Steht hier neben dem Editor selbst und benutzt dessen Raster, damit die
 * beiden Spalten (Vorschau links, Einstellungen rechts) beim Umschalten an
 * derselben Stelle stehen. Vorher zeigten /dashboard/events/neu und
 * .../bearbeiten in dieser Zeit eine leere Karte mit „Lädt …", und das
 * gesamte Layout sprang danach auf einen Schlag hinein.
 */
export function EventEditorSkeleton() {
  return (
    <>
      <style>{EDITOR_CSS}</style>
      <div className="eed" aria-busy="true" aria-label="Editor wird geladen">
        <div className="eed-preview">
          {/* Die Vorschau ist eine Karte im Seitenverhältnis der Event-Karte. */}
          <div className="sk block" style={{ width: 190, height: 12, marginBottom: 14 }} />
          <div className="sk block" style={{ width: '100%', aspectRatio: '16 / 10', minHeight: 260 }} />
        </div>
        <div className="eed-panel">
          <div className="sk" style={{ width: 128, height: 13, marginBottom: 20 }} />
          {[74, 96, 62, 88].map((w, i) => (
            <div key={i} style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
              <div className="sk" style={{ width: w, height: 10 }} />
              <div className="sk block" style={{ width: '100%', height: 40 }} />
            </div>
          ))}
          <div className="sk block" style={{ width: '100%', height: 44, marginTop: 24 }} />
        </div>
      </div>
    </>
  );
}

const EDITOR_CSS = `
  .eed {
    display: grid; grid-template-columns: minmax(0, 1fr) 400px;
    gap: 28px; align-items: start;
  }
  .eed-preview { min-width: 0; }
  .eed-panel {
    position: sticky; top: 84px;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 18px; box-shadow: var(--shadow);
    padding: 22px; max-height: calc(100vh - 108px); overflow-y: auto;
  }
  .eed-panel .field:last-of-type { margin-bottom: 0; }
  .eed-panetoggle { display: none; }

  .eed-tier {
    padding: 12px; border-radius: 10px;
    border: 1px solid var(--line-2); background: var(--surface);
    display: flex; flex-direction: column; gap: 8px;
  }
  .eed-trust {
    margin-top: 18px; padding: 14px; border-radius: 10px;
    background: var(--accent-wash); border: 1px solid var(--accent-line);
    display: flex; gap: 10px;
    font-size: 12.5px; color: var(--accent-ink); line-height: 1.5;
  }
  .eed-trust b { color: var(--accent-ink); }
  .eed-error { margin-top: 14px; font-size: 13px; color: var(--bad); line-height: 1.5; }
  .eed-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; flex-wrap: wrap; }

  .eed-done { display: flex; flex-direction: column; gap: 12px; }
  .eed-done .ok {
    display: flex; align-items: center; gap: 8px;
    padding: 12px 14px; border-radius: 10px;
    background: var(--ok-wash); border: 1px solid oklch(0.86 0.08 150);
    color: oklch(0.34 0.11 150); font-size: 13.5px; font-weight: 600;
  }
  .eed-done p { margin: 0; font-size: 13px; color: var(--ink-3); }

  @media (max-width: 1100px) {
    .eed { grid-template-columns: 1fr; gap: 18px; }
    .eed-panel { position: static; max-height: none; }
    .eed-panetoggle { display: inline-flex; }
    .eed .hide-mobile { display: none; }
  }
`;
