/**
 * FRESCO-496: split out of `./events.ts` on purpose. `getDistinctId` is the
 * one PostHog helper with a hard synchronous contract (see its own doc
 * comment) — `app/signup/page.tsx`'s guest-reassignment flow reads it
 * synchronously, in the same tick, right before a session-switching auth
 * call. Every other helper in `events.ts` is fire-and-forget and now lazy
 * (dynamic `import('posthog-js')`) so posthog-js's bundle is not part of the
 * initial JS on every route that merely captures an event (e.g. the guest
 * landing page's CTA click). Keeping this one function's static
 * `import posthog from 'posthog-js'` in its own module means only
 * `app/signup/page.tsx` (which imports this file directly, not through
 * `events.ts`) pulls posthog-js in eagerly — everywhere else stays lazy.
 */

import posthog from 'posthog-js';

/**
 * Reads the current browser's PostHog distinct_id. `aliasUser` callers need
 * this captured BEFORE a session-switching auth call (e.g.
 * `signInWithPassword`) resolves — once it does, the provider's
 * `onAuthStateChange` has already re-identified under the new uid and the
 * prior anonymous id is gone. Fail-soft: silent no-op when
 * `NEXT_PUBLIC_POSTHOG_KEY` is unset or posthog-js itself throws.
 */
export function getDistinctId(): string | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return null;
  }
  try {
    return posthog.get_distinct_id();
  }
  catch (error) {
    console.error('[lib/posthog/distinct-id] getDistinctId failed', error);
    return null;
  }
}
