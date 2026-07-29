import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import type { SeasonPass } from '@/lib/supabase';
import { PasslyLogo } from '@/app/components/PasslyLogo';
import { Icon, VerifiedCheck } from '@/app/components/passlyUi';
import PassClient from './PassClient';

interface PassDate {
  id: string;
  name: string;
  date: string;
  startTime: string | null;
  venue: string | null;
  cancelled: boolean;
}

async function getPass(id: string): Promise<SeasonPass | null> {
  const { data } = await supabaseAdmin
    .from('season_passes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return (data as SeasonPass | null) ?? null;
}

async function getDates(passId: string): Promise<PassDate[]> {
  const { data } = await supabaseAdmin
    .from('season_pass_events')
    .select('event_id, events(id, name, date, start_time, venue, cancelled_at)')
    .eq('pass_id', passId);

  type Row = { events: Record<string, unknown> | Record<string, unknown>[] | null };
  return ((data ?? []) as Row[])
    .map((row) => {
      const ev = Array.isArray(row.events) ? row.events[0] : row.events;
      if (!ev) return null;
      return {
        id: ev.id as string,
        name: ev.name as string,
        date: ev.date as string,
        startTime: (ev.start_time as string | null) ?? null,
        venue: (ev.venue as string | null) ?? null,
        cancelled: Boolean(ev.cancelled_at),
      };
    })
    .filter((d): d is PassDate => d !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const pass = await getPass(id);
  if (!pass) return { title: 'Saisonpass nicht gefunden · Passly' };

  const description = pass.description
    ?? 'Ein Ticket für die ganze Reihe. Sicher und fälschungssicher, Einlass per Handy.';
  return {
    title: `${pass.name} · Saisonpass · Passly`,
    description,
    openGraph: { title: pass.name, description, type: 'website' },
  };
}

const formatDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const monthShort = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' }).replace('.', '');
const dayNum = (iso: string) => new Date(iso + 'T00:00:00').getDate();

const PAGE_CSS = `
  .pass-page {
    min-height: 100vh;
    background: radial-gradient(1000px 500px at 50% -10%, var(--accent-wash), transparent 60%), var(--surface-2);
    display: flex; flex-direction: column; align-items: center;
    padding: 32px 20px 56px;
  }
  .pass-sheet {
    width: 100%; max-width: 460px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    margin-top: 28px;
  }
  .pass-title { padding: 24px 24px 18px; }
  .pass-title .eyebrow-plain {
    font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--accent-ink);
  }
  .pass-title h1 { font-size: 21px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; margin-top: 6px; }
  .pass-desc { padding: 0 24px 20px; font-size: 13.5px; color: var(--ink-2); line-height: 1.6; white-space: pre-line; }
  .pass-rows { border-top: 1px solid var(--line); padding: 18px 24px; display: flex; flex-direction: column; gap: 12px; }
  .pass-row { display: flex; align-items: center; justify-content: space-between; font-size: 13.5px; gap: 12px; }
  .pass-row .label { color: var(--ink-3); }
  .pass-row .value { font-weight: 600; font-variant-numeric: tabular-nums; }
  .pass-row .value.big { font-size: 19px; letter-spacing: -0.01em; }
  .pass-dates { border-top: 1px solid var(--line); padding: 18px 24px; display: grid; gap: 10px; }
  .pass-dates .head { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-3); }
  .pass-date { display: flex; gap: 12px; align-items: center; }
  .pass-date .cal {
    width: 44px; flex-shrink: 0; border: 1px solid var(--line); border-radius: 8px;
    overflow: hidden; text-align: center; background: var(--surface);
  }
  .pass-date .cal .m {
    font-size: 8.5px; letter-spacing: 0.1em; color: white; text-transform: uppercase;
    font-weight: 600; background: var(--accent); padding: 2px 0;
  }
  .pass-date .cal .d { font-size: 17px; font-weight: 600; padding: 3px 0 4px; font-variant-numeric: tabular-nums; }
  .pass-date .txt { min-width: 0; }
  .pass-date .txt .n { font-size: 13.5px; font-weight: 500; }
  .pass-date .txt .w { font-size: 12px; color: var(--ink-3); margin-top: 2px; }
  .pass-date.off { opacity: 0.5; }
  .pass-foot { border-top: 1px solid var(--line); padding: 20px 24px 24px; background: var(--surface-2); }
`;

export default async function PassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pass = await getPass(id);
  if (!pass) notFound();

  const dates = await getDates(id);
  const liveDates = dates.filter((d) => !d.cancelled);

  const { data: organizerRow } = await supabaseAdmin
    .from('organizers')
    .select('name, business_name, type, public_name, handle, is_verified, verified_label')
    .eq('wallet_address', pass.organizer_wallet)
    .maybeSingle();
  const organizerName = organizerRow
    ? (organizerRow.public_name?.trim()
        || (organizerRow.type === 'business' && organizerRow.business_name ? organizerRow.business_name : organizerRow.name))
    : null;
  const organizerHandle = (organizerRow?.handle as string | null) ?? null;
  const organizerVerified = Boolean(organizerRow?.is_verified);
  const organizerVerifiedLabel = (organizerRow?.verified_label as string | null) ?? null;

  const available = Math.max(0, pass.capacity - pass.tickets_sold - pass.tickets_reserved);
  const priceFormatted = pass.price_eur === 0
    ? 'Kostenlos'
    : (pass.price_eur / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="pass-page">
        <PasslyLogo height={24} />

        <div className="pass-sheet">
          <div className="pass-title">
            <div className="eyebrow-plain">Saisonpass</div>
            <h1>{pass.name}</h1>
          </div>

          {pass.description && <div className="pass-desc">{pass.description}</div>}

          <div className="pass-rows">
            <div className="pass-row">
              <span className="label">
                Preis
                {pass.price_eur > 0 && (
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>zzgl. Servicegebühr</span>
                )}
              </span>
              <span className="value big">{priceFormatted}</span>
            </div>
            <div className="pass-row">
              <span className="label">Gilt für</span>
              <span className="value">{liveDates.length} {liveDates.length === 1 ? 'Termin' : 'Termine'}</span>
            </div>
            {organizerName && (
              <div className="pass-row">
                <span className="label">Veranstalter</span>
                <span className="value" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 500, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {organizerHandle ? (
                    <Link href={`/@${organizerHandle}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'inherit' }}>
                      {organizerName}
                      {organizerVerified && <VerifiedCheck size={15} title={organizerVerifiedLabel ?? 'Verifiziert'} />}
                    </Link>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {organizerName}
                      {organizerVerified && <VerifiedCheck size={15} title={organizerVerifiedLabel ?? 'Verifiziert'} />}
                    </span>
                  )}
                  <span className="chip ok" title="Dieser Veranstalter wurde von Passly geprüft."><Icon name="shield" size={11} /> Geprüft</span>
                </span>
              </div>
            )}
            <div className="pass-row">
              <span className="label">Verfügbarkeit</span>
              {!pass.active ? (
                <span className="chip"><span className="d" />Nicht im Verkauf</span>
              ) : available <= 0 ? (
                <span className="chip bad"><span className="d" />Ausverkauft</span>
              ) : available <= Math.max(5, Math.floor(pass.capacity * 0.1)) ? (
                <span className="chip warn"><span className="d" />Nur noch {available}</span>
              ) : (
                <span className="chip ok"><span className="d" />Verfügbar</span>
              )}
            </div>
          </div>

          {dates.length > 0 && (
            <div className="pass-dates">
              <div className="head">Diese Termine sind drin</div>
              {dates.map((d) => (
                <div key={d.id} className={`pass-date${d.cancelled ? ' off' : ''}`}>
                  <div className="cal">
                    <div className="m">{monthShort(d.date)}</div>
                    <div className="d">{dayNum(d.date)}</div>
                  </div>
                  <div className="txt">
                    <div className="n">
                      <Link href={`/shop/${d.id}`} style={{ color: 'inherit' }}>{d.name}</Link>
                    </div>
                    <div className="w">
                      {d.cancelled
                        ? 'Abgesagt'
                        : `${formatDate(d.date)}${d.startTime ? ` · ${d.startTime} Uhr` : ''}${d.venue ? ` · ${d.venue}` : ''}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pass-foot">
            {!pass.active ? (
              <div style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.6 }}>
                Dieser Saisonpass wird nicht mehr verkauft. Einzeltickets gibt es
                weiterhin auf den Eventseiten.
              </div>
            ) : liveDates.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.6 }}>
                Für diesen Pass sind gerade keine Termine hinterlegt.
              </div>
            ) : (
              <PassClient passId={pass.id} priceCents={pass.price_eur} available={available} />
            )}
          </div>
        </div>

        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-3)' }}>
          <Icon name="shield" size={14} />
          Ein Pass, alle Termine. Am Einlass gilt er pro Termin genau einmal.
        </div>

        <div style={{ marginTop: 20, display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--ink-4)' }}>
          <Link href="/hilfe">Hilfe</Link>
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/agb">AGB</Link>
        </div>
      </div>
    </>
  );
}
