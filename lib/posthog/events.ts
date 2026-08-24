/**
 * ADR-0013 / FRESCO-240: single source of truth for every PostHog event this
 * app emits — avoids event-name drift across the ~6 capture points (onboarding,
 * calendar, login, signup, Stripe webhook). Any new user-facing flow that
 * should count toward the North-star KPI or a funnel/retention report must
 * add its event here rather than a magic string at the call site.
 */

import posthog from 'posthog-js';

export const POSTHOG_EVENTS = {
  MENU_GENERATION_STARTED: 'menu_generation_started',
  MENU_GENERATION_COMPLETED: 'menu_generation_completed',
  RECIPE_MARKED_COOKED: 'recipe_marked_cooked',
  USER_SIGNED_UP: 'user_signed_up',
  SESSION_STARTED: 'session_started',
  SUBSCRIPTION_STARTED: 'subscription_started',
} as const;

export type PosthogEventName = (typeof POSTHOG_EVENTS)[keyof typeof POSTHOG_EVENTS];

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
 */
export function identifyUser(userId: string): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return;
  }
  try {
    posthog.identify(userId);
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
