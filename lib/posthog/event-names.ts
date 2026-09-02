/**
 * Zero-dependency single source of truth for every PostHog event name.
 *
 * Split out of `events.ts` (FRESCO-366 / A4-B4): `events.ts` imports
 * `posthog-js`, so any server-side caller that only needs the event NAME
 * (`lib/posthog/server.ts`, `app/api/stripe/webhook/route.ts`) would
 * otherwise drag the browser SDK into a Node bundle. Import names from here;
 * import the capture helpers from `events.ts` (client) or `server.ts`
 * (server).
 *
 * ADR-0013's invariant still holds: any new user-facing flow that should
 * count toward the North-star KPI or a funnel/retention report adds its
 * event here, never a magic string at the call site.
 */

export const POSTHOG_EVENTS = {
  // North-star KPI ("menús generados Y usados") + core product loop.
  MENU_GENERATION_STARTED: 'menu_generation_started',
  MENU_GENERATION_COMPLETED: 'menu_generation_completed',
  RECIPE_MARKED_COOKED: 'recipe_marked_cooked',
  RECIPE_MARKED_DISCARDED: 'recipe_marked_discarded',
  // FRESCO-373: the mark is committed after a 5s undo window — this fires
  // when the user cancels within it.
  RECIPE_MARK_UNDONE: 'recipe_mark_undone',
  SHOPPING_LIST_GENERATED: 'shopping_list_generated',

  // Acquisition + activation funnel (landing → signup → onboarding → menu).
  LANDING_CTA_CLICKED: 'landing_cta_clicked',
  // FRESCO-374 (A4-M24): a guest-mode entry ("Continuar como invitada"). Kept
  // OUT of `user_signed_up` so that event means "a real account was created"
  // only — a guest converting later still fires `user_signed_up`.
  GUEST_STARTED: 'guest_started',
  USER_SIGNED_UP: 'user_signed_up',
  // FRESCO-390 (A4-M25): the progressive-signup OTP conversion funnel. The
  // OTP is emailed by a Gmail SMTP sender (no owned domain yet — see
  // ADR-0021), so its deliverability is the risk being measured:
  // `otp_verified` / `otp_sent` is the completion rate, `otp_failed.reason`
  // the failure breakdown. `user_signed_up{method:progressive_signup_otp}`
  // still fires alongside `otp_verified` — this is the granular step.
  OTP_SENT: 'otp_sent',
  OTP_VERIFIED: 'otp_verified',
  OTP_FAILED: 'otp_failed',
  SESSION_STARTED: 'session_started',
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  // FRESCO-371: fired when the wizard unmounts without the user reaching a
  // generated menu — the `abandoned` leg of the per-step funnel (A4-H14).
  ONBOARDING_ABANDONED: 'onboarding_abandoned',

  // FRESCO-372 (A4-H15): the weekly re-engagement push loop, end to end.
  // PUSH_SENT fires server-side from the Deno edge function (no browser
  // there) — see `supabase/functions/send-weekly-reengagement-push/index.ts`.
  PUSH_PROMPT_SHOWN: 'push_prompt_shown',
  PUSH_PERMISSION_GRANTED: 'push_permission_granted',
  PUSH_SENT: 'push_sent',
  PUSH_OPENED: 'push_opened',

  // Monetisation funnel (checkout → trial → paid → renewal / churn).
  // The subscription_* / trial_* events fire server-side from the Stripe
  // webhook — the one place a browser capture structurally cannot run and
  // where ad-blocker loss on a business-critical event is unacceptable.
  CHECKOUT_STARTED: 'checkout_started',
  TRIAL_STARTED: 'trial_started',
  TRIAL_CONVERTED_TO_PAID: 'trial_converted_to_paid',
  SUBSCRIPTION_RENEWED: 'subscription_renewed',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
} as const;

export type PosthogEventName = (typeof POSTHOG_EVENTS)[keyof typeof POSTHOG_EVENTS];
