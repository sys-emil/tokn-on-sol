/**
 * First-party analytics, strictly consent-gated (DSGVO/TDDDG).
 *
 * Two cookies, both set client-side:
 *  - passly_consent: 'granted' | 'denied'; the banner decision, 12 months
 *  - passly_cid: random UUID, only exists while consent is granted
 *
 * Without consent every call here is a no-op and no identifier exists.
 */

const CONSENT_COOKIE = 'passly_consent';
const CID_COOKIE = 'passly_cid';
const MAX_AGE = 60 * 60 * 24 * 365; // 12 Monate

export type ConsentState = 'granted' | 'denied' | null;

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAge = MAX_AGE): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

export function getConsent(): ConsentState {
  const value = getCookie(CONSENT_COOKIE);
  return value === 'granted' || value === 'denied' ? value : null;
}

export function setConsent(state: 'granted' | 'denied'): void {
  setCookie(CONSENT_COOKIE, state);
  if (state === 'granted') {
    if (!getCookie(CID_COOKIE)) setCookie(CID_COOKIE, crypto.randomUUID());
  } else {
    // Withdrawal deletes the identifier immediately.
    setCookie(CID_COOKIE, '', 0);
  }
}

/** Event name shown in the consent banner to reopen settings (e.g. from /datenschutz). */
export const OPEN_CONSENT_EVENT = 'passly:open-consent';

export function openConsentSettings(): void {
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}

/** Records an analytics event. Silently does nothing without consent. */
export function track(name: string, props?: Record<string, string | number | boolean>): void {
  if (typeof window === 'undefined') return;
  if (getConsent() !== 'granted' || !getCookie(CID_COOKIE)) return;

  const body = JSON.stringify({
    name,
    path: window.location.pathname,
    referrer: document.referrer || null,
    props: props ?? {},
  });

  try {
    if (navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }))) return;
  } catch {
    // fall through to fetch
  }
  void fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}
