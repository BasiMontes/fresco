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
import { LEGAL_TEXTS_VERSION } from '@/lib/legal/consent';

export type CookieConsentDecision = 'accepted' | 'rejected';

export const COOKIE_CONSENT_COOKIE = 'fresco_cookie_consent';

/**
 * FRESCO-1007 (audit 7b A7-PRIV-01): the cookie decision is stored with the text version it was
 * given under and when: `accepted~<LEGAL_TEXTS_VERSION>~<epoch seconds>`. A decision of an older
 * version (or the plain `accepted` / `rejected` the cookie held before this change) is not a valid
 * decision for the current texts, so the banner shows again and analytics stay off until the person
 * decides once more. Evidence of the decision lives in the person's browser, which is where this
 * consent has always lived (ADR-0025): the cookie is the record, so it carries the version and date.
 */
const SEPARATOR = '~';

export interface CookieConsentRecord {
  decision: CookieConsentDecision
  version: string
  /** Epoch seconds. */
  decidedAt: number
}

/** 1 year — matches `THEME_COOKIE_MAX_AGE`'s rationale (a durable preference). */
const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

export function isCookieConsentDecision(value: unknown): value is CookieConsentDecision {
  return value === 'accepted' || value === 'rejected';
}

/** What a cookie value says, whatever version it is: `null` for anything that is not the versioned format. */
export function parseCookieConsentRecord(rawValue: string | undefined): CookieConsentRecord | null {
  const [decision, version, decidedAt, ...rest] = (rawValue ?? '').split(SEPARATOR);
  const seconds = Number(decidedAt);
  if (rest.length > 0 || !isCookieConsentDecision(decision) || !version || !Number.isInteger(seconds) || seconds <= 0) {
    return null;
  }
  return { decision, version, decidedAt: seconds };
}

/**
 * The decision, only when it was taken under the CURRENT texts. Server-side read from a
 * `next/headers` `cookies()` value string, or any raw cookie value. A decision of another version
 * reads as "no decision yet", which is what shows the banner again.
 */
export function parseCookieConsent(rawValue: string | undefined, currentVersion: string = LEGAL_TEXTS_VERSION): CookieConsentDecision | null {
  const record = parseCookieConsentRecord(rawValue);
  return record?.version === currentVersion ? record.decision : null;
}

/** The cookie value for a decision taken now, under the current texts. */
export function serializeCookieConsent(decision: CookieConsentDecision, now: number = Date.now()): string {
  return [decision, LEGAL_TEXTS_VERSION, Math.floor(now / 1000)].join(SEPARATOR);
}

/** Client-side read — `undefined` on the server (no `document`), matching `theme.ts`'s guard shape. */
export function readCookieConsentClient(): CookieConsentDecision | null {
  if (typeof document === 'undefined') { return null; }

  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_CONSENT_COOKIE}=([^;]*)`));
  return parseCookieConsent(match?.[1]);
}

export function writeCookieConsent(decision: CookieConsentDecision): void {
  if (typeof document === 'undefined') { return; }
  document.cookie = `${COOKIE_CONSENT_COOKIE}=${serializeCookieConsent(decision)}; path=/; max-age=${COOKIE_CONSENT_MAX_AGE}; samesite=lax`;
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
