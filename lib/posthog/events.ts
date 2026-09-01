/**
 * ADR-0013 / FRESCO-240: client-side PostHog capture helpers. Event NAMES
 * live in `./event-names.ts` (zero-dependency, server-safe) and are
 * re-exported here so existing `@/lib/posthog/events` importers keep working.
 * Any new user-facing flow that should count toward the North-star KPI or a
 * funnel/retention report adds its event to `event-names.ts`, never a magic
 * string at the call site.
 */

import type { PosthogEventName } from './event-names';
import posthog from 'posthog-js';

export { POSTHOG_EVENTS } from './event-names';
export type { PosthogEventName } from './event-names';

/**
 * Client-side capture — silent no-op when `NEXT_PUBLIC_POSTHOG_KEY` is unset
 * (local dev without a PostHog project yet) or when posthog-js itself throws.
 * Utility, not a public API boundary (§10 Errors convention) — a UI
 * interaction handler firing this must never break on an analytics failure.
 */
export function captureEvent(name: PosthogEventName, properties?: Record<string, unknown>): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return;
  }
  try {
    posthog.capture(name, properties);
  }
  catch (error) {
    console.error('[lib/posthog/events] captureEvent failed', error);
  }
}

/**
 * Links every subsequent event on this browser to the given Supabase
 * `auth.uid()` — including a guest's anonymous id (ADR-0003), so her
 * pre-signup event stream merges into her post-upgrade one once she
 * registers (ADR-0004). Same fail-soft guard as `captureEvent`.
 *
 * FRESCO-366 / A4-B4: `personProperties` are `$set` on the person on every
 * call (`plan`, `is_guest`, `signup_method`) so PostHog funnels/retention
 * reports can segment by them without a custom cohort. Passing `undefined`
 * is equivalent to the old single-argument call.
 */
export function identifyUser(userId: string, personProperties?: Record<string, unknown>): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return;
  }
  try {
    posthog.identify(userId, personProperties);
  }
  catch (error) {
    console.error('[lib/posthog/events] identifyUser failed', error);
  }
}

/**
 * Merges a just-established distinct_id with the anonymous distinct_id that
 * preceded it. ADR-0004's guest→registered reassignment path (`/signup`'s
 * `handleReassign`) switches the session to a DIFFERENT, pre-existing
 * account via `signInWithPassword()` — unlike the normal conversion path
 * (`updateUser`), which keeps the same `auth.uid()` and so merges for free
 * via `identifyUser`, this one changes distinct_id outright and needs an
 * explicit alias so the guest's pre-reassignment event stream (including any
 * menu she generated) isn't orphaned. Same fail-soft guard as `captureEvent`.
 */
export function aliasUser(newUserId: string, previousUserId: string): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return;
  }
  try {
    posthog.alias(newUserId, previousUserId);
  }
  catch (error) {
    console.error('[lib/posthog/events] aliasUser failed', error);
  }
}

/**
 * Reads the current browser's PostHog distinct_id. `aliasUser` callers need
 * this captured BEFORE a session-switching auth call (e.g.
 * `signInWithPassword`) resolves — once it does, the provider's
 * `onAuthStateChange` has already re-identified under the new uid and the
 * prior anonymous id is gone. Same fail-soft guard as `captureEvent`.
 */
export function getDistinctId(): string | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return null;
  }
  try {
    return posthog.get_distinct_id();
  }
  catch (error) {
    console.error('[lib/posthog/events] getDistinctId failed', error);
    return null;
  }
}
