'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authClient } from '@/lib/authBrowser';
import { PasslyLogo } from '@/app/components/PasslyLogo';

/**
 * Muss mit "Email OTP Length" in den Supabase-Auth-Einstellungen uebereinstimmen
 * (Authentication -> Providers -> Email). Stand dort urspruenglich auf 8, waehrend
 * dieser Dialog sechs Kaestchen zeigt — dann laesst sich der Code aus der Mail
 * nicht mehr vollstaendig eingeben und niemand kommt herein. Es gibt keinen Weg,
 * die Einstellung von hier aus zu lesen; wer sie aendert, aendert auch das hier.
 */
const LENGTH = 6;
/** Supabase laesst pro Adresse eine Mail je Minute zu. */
const RESEND_SECONDS = 60;

/**
 * Anmeldung per E-Mail.
 *
 * Es gibt bewusst keine Registrierung: die erste Anmeldung legt das Konto an.
 * Wer ein Ticket kauft, will kein Konto — er will das Ticket.
 *
 * Der Dialog traegt fast keinen Text. Was zu tun ist, sagt die Form: ein Feld
 * fuer die Adresse, danach sechs Kaestchen fuer den Code. Saetze wuerden hier
 * nur erklaeren, was ohnehin sichtbar ist.
 *
 * Beide Wege aus der Mail funktionieren — Code eintippen oder Link klicken
 * (der Client hat detectSessionInUrl an). An der Tuer ist der Code schneller:
 * er steht auf dem Sperrbildschirm, ein Link macht einen neuen Tab auf.
 */
export function LoginModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const address = email.trim().toLowerCase();
  const valid = /.+@.+\..+/.test(address);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Escape schliesst, solange nichts unterwegs ist.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const send = useCallback(async (): Promise<void> => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await authClient().auth.signInWithOtp({
        email: address,
        options: { shouldCreateUser: true },
      });
      if (err) {
        setError(err.message.toLowerCase().includes('rate') ? 'Zu viele Versuche' : 'Adresse prüfen');
        return;
      }
      setStep('code');
      setDigits(Array(LENGTH).fill(''));
      setCooldown(RESEND_SECONDS);
    } catch {
      setError('Keine Verbindung');
    } finally {
      setBusy(false);
    }
  }, [address, valid, busy]);

  const verify = useCallback(async (code: string): Promise<void> => {
    if (code.length !== LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await authClient().auth.verifyOtp({
        email: address,
        token: code,
        type: 'email',
      });
      if (err) {
        setError('Code stimmt nicht');
        setDigits(Array(LENGTH).fill(''));
        boxes.current[0]?.focus();
        return;
      }
      onSuccess();
    } catch {
      setError('Keine Verbindung');
    } finally {
      setBusy(false);
    }
  }, [address, busy, onSuccess]);

  /** Schreibt ab `start` so viele Ziffern wie geliefert und springt weiter. */
  function fill(start: number, input: string): void {
    const incoming = input.replace(/\D/g, '');
    if (!incoming) return;
    const next = [...digits];
    let i = start;
    for (const ch of incoming) {
      if (i >= LENGTH) break;
      next[i] = ch;
      i++;
    }
    setDigits(next);
    setError(null);
    boxes.current[Math.min(i, LENGTH - 1)]?.focus();
    // Vollstaendig? Dann direkt pruefen — ein Knopf waere hier nur eine Huerde.
    const code = next.join('');
    if (code.length === LENGTH && !next.includes('')) void verify(code);
  }

  function onBoxKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) next[i] = '';
      else if (i > 0) { next[i - 1] = ''; boxes.current[i - 1]?.focus(); }
      setDigits(next);
      setError(null);
    } else if (e.key === 'ArrowLeft' && i > 0) {
      boxes.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < LENGTH - 1) {
      boxes.current[i + 1]?.focus();
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <style>{`
        .login-card { max-width: 360px; }
        .login-body { padding: 26px 28px 24px; display: flex; flex-direction: column; align-items: center; gap: 18px; }
        .login-close {
          position: absolute; top: 12px; right: 12px;
          width: 28px; height: 28px; border-radius: 7px;
          display: grid; place-items: center;
          color: var(--ink-3); font-size: 16px; line-height: 1;
        }
        .login-close:hover { background: var(--surface-2); color: var(--ink); }
        .login-mail { font-size: 12.5px; color: var(--ink-3); font-family: var(--mono); }
        .otp { display: flex; gap: 8px; width: 100%; justify-content: center; }
        .otp input {
          flex: 1 1 0; min-width: 0; max-width: 46px; height: 54px;
          text-align: center; font-size: 22px; font-weight: 500;
          font-family: var(--mono); color: var(--ink);
          background: var(--surface); border: 1px solid var(--line-2); border-radius: 9px;
          transition: border-color .15s, box-shadow .15s;
        }
        .otp input:focus {
          outline: none; border-color: var(--accent);
          box-shadow: 0 0 0 3px oklch(0.62 0.19 var(--hue) / 0.16);
        }
        .otp input:disabled { opacity: .55; }
        .login-err { font-size: 12.5px; color: oklch(0.55 0.19 25); min-height: 1em; }
        .login-foot { display: flex; gap: 10px; align-items: center; justify-content: center; }
      `}</style>

      <div className="modal login-card" style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        <button className="login-close" aria-label="Schließen" onClick={onClose} disabled={busy}>×</button>

        <div className="login-body">
          <PasslyLogo height={26} asLink={false} />

          {step === 'email' ? (
            <>
              <input
                className="input"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                placeholder="du@beispiel.de"
                value={email}
                disabled={busy}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
                style={{ width: '100%', textAlign: 'center' }}
              />
              <span className="login-err">{error}</span>
              <button
                className="btn primary lg"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => void send()}
                disabled={busy || !valid}
              >
                {busy ? 'Moment …' : 'Weiter'}
              </button>
            </>
          ) : (
            <>
              <span className="login-mail">{address}</span>

              <div className="otp">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { boxes.current[i] = el; }}
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    aria-label={`Ziffer ${i + 1}`}
                    value={d}
                    disabled={busy}
                    autoFocus={i === 0}
                    onChange={(e) => fill(i, e.target.value)}
                    onKeyDown={(e) => onBoxKeyDown(i, e)}
                    onPaste={(e) => { e.preventDefault(); fill(0, e.clipboardData.getData('text')); }}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                ))}
              </div>

              <span className="login-err">{error}</span>

              <div className="login-foot">
                <button className="btn subtle sm" onClick={() => { setStep('email'); setError(null); }} disabled={busy}>
                  Ändern
                </button>
                <button className="btn subtle sm" onClick={() => void send()} disabled={busy || cooldown > 0}>
                  {cooldown > 0 ? `Neu senden · ${cooldown}s` : 'Neu senden'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
