/**
 * Cookie consent contract (FRESCO-428, ADR-0025).
 *
 * Follows `lib/theme/theme.ts`'s precedent exactly: a plain first-party
 * cookie (not `localStorage`/Zustand), 1-year expiry, read server-side in
 * `app/layout.tsx` so the banner never flashes on hydration and read/written
 * client-side to react immediately without a reload.
 *
 * Storing this decision itself needs no consent — it is strictly necessary
 * (Art. 22.2 LSSI exempts technical storage required for the service the
 * user explicitly requested, and "remember what you chose" is that).
 */
export type CookieConsentDecision = 'accepted' | 'rejected';

export const COOKIE_CONSENT_COOKIE = 'fresco_cookie_consent';

/** 1 year — matches `THEME_COOKIE_MAX_AGE`'s rationale (a durable preference). */
export const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

export function isCookieConsentDecision(value: unknown): value is CookieConsentDecision {
  return value === 'accepted' || value === 'rejected';
}

/** Server-side read from a `next/headers` `cookies()` value string, or any raw cookie value. */
export function parseCookieConsent(rawValue: string | undefined): CookieConsentDecision | null {
  return isCookieConsentDecision(rawValue) ? rawValue : null;
}

/** Client-side read — `undefined` on the server (no `document`), matching `theme.ts`'s guard shape. */
export function readCookieConsentClient(): CookieConsentDecision | null {
  if (typeof document === 'undefined') { return null; }

  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_CONSENT_COOKIE}=([^;]*)`));
  return parseCookieConsent(match?.[1]);
}

export function writeCookieConsent(decision: CookieConsentDecision): void {
  if (typeof document === 'undefined') { return; }
  document.cookie = `${COOKIE_CONSENT_COOKIE}=${decision}; path=/; max-age=${COOKIE_CONSENT_MAX_AGE}; samesite=lax`;
}

/**
 * PostHog's own default persistence (confirmed via Context7 against
 * `/posthog/posthog.com`) is `localStorage+cookie`: a cookie AND a
 * localStorage entry, both named `ph_<project_api_key>_posthog`. Deleted
 * explicitly on withdrawal per ADR-0025 rather than relying on
 * `posthog.reset()`'s internal cleanup, which this project does not own.
 */
export function clearPostHogStorage(posthogKey: string): void {
  const storageKey = `ph_${posthogKey}_posthog`;

  if (typeof document !== 'undefined') {
    document.cookie = `${storageKey}=; path=/; max-age=0; samesite=lax`;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(storageKey);
  }
}
