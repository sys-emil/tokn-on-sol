'use client';

import { useState } from 'react';
import { authClient } from '@/lib/authBrowser';

type Step = 'email' | 'code';

/**
 * Anmeldung per E-Mail und Einmalcode.
 *
 * Es gibt bewusst keine Registrierung: die erste Anmeldung legt das Konto an.
 * Wer ein Ticket kauft, will kein Konto — er will das Ticket.
 */
export function LoginModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(): Promise<void> {
    const address = email.trim().toLowerCase();
    if (!address.includes('@') || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await authClient().auth.signInWithOtp({
        email: address,
        options: { shouldCreateUser: true },
      });
      if (err) {
        // Die Sperre ist kein Fehler des Nutzers, sondern eine Wartezeit —
        // also auch so formuliert.
        setError(
          err.message.toLowerCase().includes('rate')
            ? 'Zu viele Versuche. Bitte warte eine Minute.'
            : 'Der Code konnte nicht gesendet werden. Bitte prüf die Adresse.',
        );
        return;
      }
      setStep('code');
    } catch {
      setError('Netzwerkfehler. Bitte versuch es erneut.');
    } finally {
      setBusy(false);
    }
  }

  async function verify(): Promise<void> {
    const token = code.trim();
    if (token.length < 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await authClient().auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: 'email',
      });
      if (err) {
        setError('Der Code stimmt nicht oder ist abgelaufen.');
        return;
      }
      onSuccess();
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
          <h3>{step === 'email' ? 'Anmelden' : 'Code eingeben'}</h3>
          <button className="btn ghost sm" onClick={onClose} disabled={busy}>Schließen</button>
        </div>

        <div className="modal-body">
          {step === 'email' ? (
            <>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 16 }}>
                Wir schicken dir einen Code per E-Mail. Ein Passwort brauchst du nicht.
              </p>
              <div className="field">
                <label htmlFor="login-email">E-Mail</label>
                <input
                  id="login-email"
                  autoFocus
                  className="input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void sendCode(); }}
                  disabled={busy}
                />
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 16 }}>
                Wir haben dir einen Code an <strong>{email.trim().toLowerCase()}</strong> geschickt.
              </p>
              <div className="field">
                <label htmlFor="login-code">Code</label>
                <input
                  id="login-code"
                  autoFocus
                  className="input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') void verify(); }}
                  disabled={busy}
                  style={{ letterSpacing: '0.28em', fontFamily: 'var(--mono)' }}
                />
              </div>
              <button
                className="btn ghost sm"
                style={{ marginTop: 10 }}
                onClick={() => { setStep('email'); setError(null); }}
                disabled={busy}
              >
                Andere Adresse verwenden
              </button>
            </>
          )}

          {error && (
            <p role="alert" style={{ fontSize: 13.5, color: 'var(--danger, #b3261e)', marginTop: 14 }}>
              {error}
            </p>
          )}
        </div>

        <div className="modal-foot">
          <button
            className="btn primary"
            onClick={() => void (step === 'email' ? sendCode() : verify())}
            disabled={busy || (step === 'email' ? !email.includes('@') : code.trim().length < 6)}
          >
            {busy ? 'Einen Moment …' : step === 'email' ? 'Code anfordern' : 'Anmelden'}
          </button>
        </div>
      </div>
    </div>
  );
}
