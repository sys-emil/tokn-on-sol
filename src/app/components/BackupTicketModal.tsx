'use client';

import { getAccessToken } from '@/lib/auth';
import { useState } from 'react';

/**
 * "Backup-Ticket erstellen": personalizes a static QR PDF for venues without
 * connectivity. The server signs the person-bound challenge per ticket with
 * the account's derived key, builds the PDF, mails it, and returns it for
 * download.
 */
export function BackupTicketModal({
  assetIds,
  open,
  onClose,
}: {
  assetIds: string[];
  open: boolean;
  onClose: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ emailed: boolean } | null>(null);

  if (!open) return null;

  const canSubmit = firstName.trim() && lastName.trim() && birthDate && !busy;

  async function create(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Der Server bindet Name und Geburtsdatum in die Signatur ein, damit der
      // Tuersteher sie aus der Signatur liest und nicht vom (editierbaren)
      // Ausdruck.
      const token = await getAccessToken();
      const res = await fetch('/api/tickets/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ assetIds, firstName, lastName, birthDate }),
      });
      const data = (await res.json()) as { success: boolean; emailed?: boolean; pdfBase64?: string; error?: string };
      if (!res.ok || !data.success || !data.pdfBase64) {
        setError(data.error ?? 'Das Backup-Ticket konnte nicht erstellt werden.');
        return;
      }

      // Trigger the download from the returned bytes.
      const bytes = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'passly-backup-ticket.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);

      setDone({ emailed: Boolean(data.emailed) });
    } catch {
      setError('Netzwerkfehler. Bitte versuch es erneut.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Backup-Ticket erstellen</h3>
          <button className="btn ghost sm" onClick={onClose} disabled={busy}>Schließen</button>
        </div>
        <div className="modal-body">
          {done ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Dein Backup-Ticket ist fertig 🎉</div>
              <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginTop: 8 }}>
                Das PDF wurde heruntergeladen{done.emailed ? ' und zusätzlich an deine E-Mail-Adresse geschickt' : ''}.
                Speichere es auf deinem Handy oder drucke es aus, es funktioniert
                auch ganz ohne Empfang, zusammen mit deinem Ausweis.
              </p>
              <button className="btn primary" style={{ marginTop: 16 }} onClick={onClose}>Fertig</button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 16 }}>
                Für Veranstaltungsorte ohne Empfang: ein PDF mit deinem Einlass-Code,
                das ohne Internet funktioniert. Es wird auf dich personalisiert und
                ist nur mit deinem Ausweis gültig, <b style={{ color: 'var(--ink)' }}>nicht
                zum Weitergeben, Weiterverkauf verboten</b>. Deine Angaben werden
                fälschungssicher in den Code eingebettet und am Einlass mit deinem
                Ausweis abgeglichen, wir speichern sie nicht.
              </p>
              <div style={{ display: 'grid', gap: 12 }}>
                <div className="field">
                  <label>Vorname</label>
                  <input className="input" value={firstName} maxLength={40} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                </div>
                <div className="field">
                  <label>Nachname</label>
                  <input className="input" value={lastName} maxLength={40} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                </div>
                <div className="field">
                  <label>Geburtsdatum</label>
                  <input className="input" type="date" value={birthDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setBirthDate(e.target.value)} autoComplete="bday" />
                </div>
              </div>
              {error && (
                <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--bad-wash)', border: '1px solid oklch(0.86 0.10 25)', fontSize: 12.5, color: 'var(--bad)', lineHeight: 1.5 }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>
        {!done && (
          <div className="modal-foot">
            <button className="btn ghost" onClick={onClose} disabled={busy}>Abbrechen</button>
            <button className="btn primary" onClick={() => void create()} disabled={!canSubmit}>
              {busy ? 'Wird erstellt …' : `PDF erstellen${assetIds.length > 1 ? ` (${assetIds.length} Tickets)` : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
