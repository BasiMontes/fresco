-- FRESCO-919 (audit C-15): server-side PostHog events (the Stripe funnel in the
-- webhook, the weekly push in an Edge Function) carry the user id and never
-- looked at the cookie decision, which only lives in the browser
-- (`fresco_cookie_consent`, ADR-0025). Store that decision where the server can
-- read it.
--
-- `analytics_consent`: true = accepted analytics, false = rejected, null = never
-- synced. The server sends an event ONLY when it is true, so null is treated as
-- "no consent" (opt-in, fail closed).
--
-- Written by the owner under their own session (the cookie banner syncs it for a
-- signed-in user), covered by the existing table-level grants and
-- `profiles_update_own`. A user who forged `true` would only turn on analytics
-- about themselves, which is self-inflicted, same trade-off as ADR-0040. Read by
-- `service_role` (webhook, Edge Functions), which already holds SELECT.
alter table public.user_profiles
  add column if not exists analytics_consent boolean;

comment on column public.user_profiles.analytics_consent is
  'Cookie-banner analytics decision synced from the browser: true accepted, false rejected, null never synced. Server-side PostHog events are sent only when true (FRESCO-919, ADR-0044).';
