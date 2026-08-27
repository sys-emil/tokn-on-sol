'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authClient } from '@/lib/authBrowser';
import { Icon } from '@/app/components/passlyUi';
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

const EASE = 'cubic-bezier(.16,1,.3,1)';
const empty = (): string[] => Array(LENGTH).fill('');

type Step = 'email' | 'code';
/** `out` = alter Schritt geht raus, `enter` = neuer steht bereit, `in` = sichtbar. */
type Phase = 'out' | 'enter' | 'in';

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
 *
 * Die Bewegung ist Teil der Bedienung, nicht Dekoration: die Karte behaelt beim
 * Schrittwechsel ihre Oberkante und waechst nur nach unten (`morph` + `shift`),
 * die Panels wechseln in Leserichtung, und der Zustand jedes Kaestchens —
 * leer, gefuellt, fokussiert, falsch, richtig — ist an Rahmen, Fuellung und
 * Ring ablesbar, bevor irgendein Text erscheint. Der Hintergrund tritt dabei
 * zurueck (`.auth-scene` in globals.css, gesetzt vom AuthProvider).
 */
export function LoginModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<Step>('email');
  const [phase, setPhase] = useState<Phase>('in');
  const [dir, setDir] = useState<1 | -1>(1);

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const [digits, setDigits] = useState<string[]>(empty);
  const [focused, setFocused] = useState(-1);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [ok, setOk] = useState(false);

  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Die Hoehe des Panels wird gemessen, damit der Schrittwechsel sie animieren
  // kann; `base` ist die erste gemessene Hoehe und der Bezug fuer den Versatz.
  const [boxH, setBoxH] = useState<number | null>(null);
  const [base, setBase] = useState<number | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const cellsRef = useRef<HTMLDivElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const timers = useRef<number[]>([]);

  const address = email.trim().toLowerCase();
  const valid = /.+@.+\..+/.test(address);

  const later = useCallback((fn: () => void, ms: number): void => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    const ids = timers.current;
    return () => { ids.forEach(clearTimeout); };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (!h) return;
      setBoxH(h);
      setBase((b) => b ?? h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Erstfokus erst nach der Einblendung: sonst springt Safari mitten in die
  // Animation an das Feld und die Karte ruckelt.
  useEffect(() => {
    const id = window.setTimeout(() => emailRef.current?.focus(), 90);
    return () => clearTimeout(id);
  }, []);

  // Escape schliesst, solange nichts unterwegs ist. Tab bleibt im Dialog.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy && !ok) { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const stops = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href]',
      );
      if (!stops.length) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (!modalRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, ok, onClose]);

  /** Schrittwechsel: raus in Gegenrichtung, tauschen, aus der Richtung herein. */
  const go = useCallback((next: Step, direction: 1 | -1): void => {
    setDir(direction);
    setPhase('out');
    later(() => {
      setStep(next);
      setPhase('enter');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setPhase('in');
        later(() => {
          if (next === 'code') boxes.current[0]?.focus();
          else emailRef.current?.focus();
        }, 60);
      }));
    }, 150);
  }, [later]);

  /**
   * Fordert den Code an. `advance` unterscheidet den ersten Versand (danach
   * geht es weiter zu den Kaestchen) vom "Neuen Code senden" (bleibt stehen).
   */
  const request = useCallback(async (advance: boolean): Promise<void> => {
    if (!valid || busy) return;
    setBusy(true);
    setEmailError(null);
    setCodeError(null);
    const fail = (msg: string) => (advance ? setEmailError(msg) : setCodeError(msg));
    try {
      const { error: err } = await authClient().auth.signInWithOtp({
        email: address,
        options: { shouldCreateUser: true },
      });
      if (err) {
        fail(err.message.toLowerCase().includes('rate') ? 'Zu viele Versuche' : 'Adresse prüfen');
        return;
      }
      setDigits(empty());
      setCooldown(RESEND_SECONDS);
      if (advance) go('code', 1);
      // Nach dem Nachsenden bleibt der Schritt stehen; der Fokus muss zurueck
      // ins erste Kaestchen, sobald es nicht mehr deaktiviert ist.
      else later(() => boxes.current[0]?.focus(), 0);
    } catch {
      fail('Keine Verbindung');
    } finally {
      setBusy(false);
    }
  }, [address, valid, busy, go, later]);

  const verify = useCallback(async (code: string): Promise<void> => {
    if (code.length !== LENGTH || busy) return;
    setBusy(true);
    setCodeError(null);
    try {
      const { error: err } = await authClient().auth.verifyOtp({
        email: address,
        token: code,
        type: 'email',
      });
      if (err) {
        setCodeError('Code stimmt nicht');
        setShake((n) => n + 1);
        later(() => { setDigits(empty()); boxes.current[0]?.focus(); }, 440);
        return;
      }
      // Kurz gruen stehen lassen: der Dialog verschwindet sonst so schnell,
      // dass niemand sieht, dass der Code angenommen wurde.
      setOk(true);
      later(onSuccess, 1100);
    } catch {
      setCodeError('Keine Verbindung');
      setShake((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }, [address, busy, later, onSuccess]);

  // Der Fehlschlag wird gespuert, nicht gelesen. Ueber die Web-Animations-API
  // statt per CSS-Klasse, weil sich dieselbe Animation sonst beim zweiten
  // falschen Code nicht erneut ausloesen laesst, ohne die Felder neu zu bauen
  // (und damit den Fokus zu verlieren).
  useEffect(() => {
    if (!shake) return;
    const el = cellsRef.current;
    if (!el?.animate) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const path = [0, -2, 4, -7, 7, -7, 7, -7, 4, -2, 0];
    el.animate(
      path.map((x) => ({ transform: `translateX(${x}px)` })),
      { duration: 440, easing: 'cubic-bezier(.36,.07,.19,.97)' },
    );
  }, [shake]);

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
    setCodeError(null);
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
      setCodeError(null);
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      boxes.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < LENGTH - 1) {
      e.preventDefault();
      boxes.current[i + 1]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      boxes.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      boxes.current[LENGTH - 1]?.focus();
    } else if (e.key.length === 1 && !/\d/.test(e.key) && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
    }
  }

  const offset = dir > 0 ? 14 : -14;
  const panel: React.CSSProperties =
    phase === 'out'
      ? { opacity: 0, transform: `translateX(${-offset}px)`, transition: 'opacity .14s ease-in, transform .14s ease-in' }
      : phase === 'enter'
        ? { opacity: 0, transform: `translateX(${offset}px)`, transition: 'none' }
        : { opacity: 1, transform: 'none', transition: `opacity .26s ${EASE}, transform .3s ${EASE}` };

  const rest = '0 1px 1px rgba(17,20,45,.04)';
  const cell = (value: string, i: number): React.CSSProperties => {
    const live = focused === i && !busy && !ok;
    if (ok) {
      return {
        borderColor: 'var(--ok)', background: 'var(--ok-wash)', color: 'oklch(0.38 0.12 150)',
        boxShadow: '0 0 0 3px color-mix(in oklab, var(--ok) 16%, transparent)', transform: 'translateY(-2px)',
      };
    }
    if (codeError) {
      return {
        borderColor: 'var(--bad)', background: 'var(--bad-wash)', color: 'var(--bad)',
        boxShadow: live ? '0 0 0 4px color-mix(in oklab, var(--bad) 20%, transparent)' : rest,
      };
    }
    if (live) {
      return {
        borderColor: 'var(--accent)', background: 'var(--surface)',
        boxShadow: '0 0 0 4px color-mix(in oklab, var(--accent) 20%, transparent), 0 1px 2px rgba(17,20,45,.05)',
        transform: 'translateY(-1px)',
      };
    }
    return { background: value ? 'var(--surface)' : 'var(--surface-2)', boxShadow: rest };
  };

  const wait = cooldown > 0;
  const clock = `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, '0')}`;

  return (
    <div className="login-scrim">
      <style>{`
        @keyframes login-veil { from { opacity: 0 } to { opacity: 1 } }
        @keyframes login-card { from { opacity: 0; transform: translateY(10px) scale(.985) } to { opacity: 1; transform: none } }
        @keyframes login-breathe { 0%, 100% { opacity: .42 } 50% { opacity: .85 } }

        .login-scrim { position: fixed; inset: 0; z-index: 120; display: grid; place-items: center; padding: 24px; }
        .login-veil {
          position: absolute; inset: 0;
          background: color-mix(in oklab, oklch(0.16 0.02 280) 46%, transparent);
          backdrop-filter: blur(7px) saturate(115%);
          -webkit-backdrop-filter: blur(7px) saturate(115%);
          animation: login-veil .28s ${EASE};
        }
        .login-card {
          position: relative; width: 400px; max-width: 100%;
          padding: 38px 36px 32px; border-radius: 22px;
          background: var(--surface); border: 1px solid var(--line);
          animation: login-card .34s ${EASE};
          transition: transform .34s ${EASE};
          box-shadow:
            0 0 0 1px color-mix(in oklab, var(--ink) 5%, transparent),
            0 1px 1px rgba(17,20,45,.04),
            0 4px 8px rgba(17,20,45,.05),
            0 12px 28px rgba(17,20,45,.07),
            0 36px 80px -12px rgba(17,20,45,.20),
            inset 0 1px 0 color-mix(in oklab, #fff 55%, transparent);
        }
        /* Der Lichtstrich auf der Oberkante; nimmt die Akzentfarbe nur an. */
        .login-card::before {
          content: ""; position: absolute; top: 0; left: 34px; right: 34px; height: 1px;
          background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--accent) 40%, transparent), transparent);
        }
        .login-logo { display: flex; align-items: center; justify-content: center; height: 32px; margin-bottom: 30px; }

        /* Die Hoehe wird animiert; \`clip\` mit Rand laesst die Fokusringe stehen,
           die ein hartes \`hidden\` an der Ober- und Unterkante abschneiden wuerde. */
        .login-morph { overflow: clip; overflow-clip-margin: 6px; transition: height .34s ${EASE}; }

        .login-form { display: flex; flex-direction: column; gap: 12px; }
        .login-form .input { height: 48px; padding: 0 14px; border-radius: 12px; font-size: 15px; letter-spacing: -.01em; }
        .login-go {
          width: 100%; height: 48px; justify-content: center;
          border-radius: 12px; font-size: 14.5px; font-weight: 550; letter-spacing: -.01em;
          transition: transform .16s ${EASE}, background .18s ease, box-shadow .18s ease;
        }
        .login-go:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 6px 18px oklch(0.45 0.20 var(--hue) / .34); }
        .login-go:not(:disabled):active { transform: translateY(1px) scale(.994); }

        .login-code { display: flex; flex-direction: column; align-items: center; gap: 20px; }
        .login-mail {
          max-width: 100%; gap: 7px; padding: 5px 11px; border-radius: 8px;
          font-size: 12.5px; background: var(--surface-2);
          transition: color .18s ease, border-color .18s ease, background .18s ease;
        }
        .login-mail:hover:not(:disabled) { color: var(--ink); border-color: var(--line-2); background: var(--surface-3); }
        .login-mail .a { color: var(--accent); display: grid; place-items: center; }
        .login-mail .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .otp { display: flex; gap: 9px; }
        .otp input {
          width: 46px; height: 56px; padding: 0; text-align: center;
          font-family: var(--mono); font-size: 23px; font-weight: 500; font-variant-numeric: tabular-nums;
          border-radius: 12px; border: 1px solid var(--line-2); color: var(--ink);
          outline: none; caret-color: var(--accent);
          transition: border-color .2s ${EASE}, box-shadow .22s ${EASE}, background .2s ease, opacity .2s ease, transform .2s ${EASE};
        }
        .otp input:disabled { opacity: .75; }

        .login-foot { display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: 34px; }
        .login-err { font-size: 12.5px; color: var(--bad); letter-spacing: -.005em; text-align: center; }
        .login-resend {
          padding: 6px 8px; font-size: 12px; letter-spacing: -.005em;
          color: var(--ink-3); font-variant-numeric: tabular-nums; transition: color .2s ease;
        }
        .login-resend:hover:not(:disabled) { color: var(--accent); }
        .login-resend:disabled { color: var(--ink-4); cursor: default; }

        @media (max-width: 480px) {
          .login-scrim { padding: 16px; }
          .login-card { padding: 30px 20px 26px; border-radius: 18px; }
          .login-card::before { left: 22px; right: 22px; }
          .otp { gap: 7px; }
          .otp input { width: 42px; height: 52px; font-size: 21px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .login-veil, .login-card { animation: none; }
          .login-card, .login-morph, .otp input { transition: none; }
          .otp input { animation: none !important; }
        }
      `}</style>

      <div className="login-veil" onClick={() => { if (!busy && !ok) onClose(); }} />

      <div
        ref={modalRef}
        className="login-card"
        role="dialog"
        aria-modal="true"
        aria-label="Bei Passly anmelden"
        // Der Dialog waechst nach unten statt aus der Mitte heraus: das Raster
        // zentriert ihn bei jeder Hoehenaenderung neu, der halbe Zuwachs
        // schiebt ihn wieder zurueck und die Oberkante bleibt, wo sie war.
        style={{ transform: boxH && base ? `translateY(${(boxH - base) / 2}px)` : undefined }}
      >
        <div className="login-logo">
          <PasslyLogo height={30} asLink={false} />
        </div>

        <div className="login-morph" style={{ height: boxH ? `${boxH}px` : 'auto' }}>
          <div ref={panelRef} style={panel}>
            {step === 'email' ? (
              <form
                className="login-form"
                onSubmit={(e) => { e.preventDefault(); void request(true); }}
              >
                <input
                  ref={emailRef}
                  className="input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="deine@email.de"
                  aria-label="E-Mail-Adresse"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                />
                <button type="submit" className="btn primary login-go" disabled={busy || !valid}>
                  {busy ? 'Code wird gesendet' : 'Code anfordern'}
                </button>
                {emailError && <div role="alert" className="login-err">{emailError}</div>}
              </form>
            ) : (
              <div className="login-code">
                <button
                  type="button"
                  className="chip login-mail"
                  onClick={() => go('email', -1)}
                  disabled={busy || ok}
                >
                  <span className="a"><Icon name="mail" size={13} /></span>
                  <span className="t">{address}</span>
                </button>

                <div className="otp" ref={cellsRef}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { boxes.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={LENGTH}
                      aria-label={`Ziffer ${i + 1} von ${LENGTH}`}
                      value={d}
                      disabled={busy || ok}
                      onChange={(e) => fill(i, e.target.value)}
                      onKeyDown={(e) => onBoxKeyDown(i, e)}
                      onPaste={(e) => { e.preventDefault(); fill(0, e.clipboardData.getData('text')); }}
                      onFocus={(e) => { setFocused(i); e.currentTarget.select(); }}
                      onBlur={() => setFocused((f) => (f === i ? -1 : f))}
                      style={{
                        ...cell(d, i),
                        animation: busy && !ok ? `login-breathe 1.1s ${EASE} ${i * 90}ms infinite` : undefined,
                      }}
                    />
                  ))}
                </div>

                <div className="login-foot">
                  {codeError && <div role="alert" className="login-err">{codeError}</div>}
                  <button
                    type="button"
                    className="login-resend"
                    onClick={() => void request(false)}
                    disabled={wait || busy || ok}
                  >
                    {wait ? `Neuen Code senden · ${clock}` : 'Neuen Code senden'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
