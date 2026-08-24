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
