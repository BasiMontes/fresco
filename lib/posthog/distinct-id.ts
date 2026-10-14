/**
 * FRESCO-496 split this out of `./events.ts` because `getDistinctId` has a hard
 * synchronous contract: `app/signup/page.tsx`'s guest-reassignment flow reads it in
 * the same tick, right before a session-switching auth call.
 *
 * FRESCO-895: it used to `import posthog from 'posthog-js'` to get it, which made the
 * whole SDK (about 311 KB) part of the initial JS of `/signup` and nowhere else. It now
 * reads the value posthog-js itself persists under `ph_<key>_posthog` (localStorage,
 * cookie as fallback; the same key `clearPostHogStorage` removes on consent
 * withdrawal), so no SDK code is loaded to answer it. Before consent nothing is
 * persisted, so the result is `null`, which is what the SDK path gave too.
 */

interface PersistedPosthog {
  distinct_id?: unknown
}

function parsePersisted(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as PersistedPosthog | null;
    return typeof parsed?.distinct_id === 'string' && parsed.distinct_id !== '' ? parsed.distinct_id : null;
  }
  catch {
    return null;
  }
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const entry = document.cookie.split('; ').find(part => part.startsWith(prefix));
  if (!entry) {
    return null;
  }
  try {
    return decodeURIComponent(entry.slice(prefix.length));
  }
  catch {
    return null;
  }
}

/**
 * Reads the current browser's PostHog distinct_id. `aliasUser` callers need this
 * captured BEFORE a session-switching auth call (e.g. `signInWithPassword`) resolves:
 * once it does, the provider's `onAuthStateChange` has already re-identified under the
 * new uid and the prior anonymous id is gone. Fail-soft: `null` when
 * `NEXT_PUBLIC_POSTHOG_KEY` is unset, nothing was persisted, or storage is unreadable.
 */
export function getDistinctId(): string | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof document === 'undefined') {
    return null;
  }
  const storageKey = `ph_${key}_posthog`;
  try {
    return parsePersisted(localStorage.getItem(storageKey)) ?? parsePersisted(readCookie(storageKey));
  }
  catch {
    return parsePersisted(readCookie(storageKey));
  }
}
