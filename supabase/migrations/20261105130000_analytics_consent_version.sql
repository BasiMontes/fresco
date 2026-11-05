-- FRESCO-1124 (audit 8 A8-PRIV-03): `user_profiles.analytics_consent` says WHAT the person decided in the cookie
-- banner but not WHEN nor under WHICH texts. The browser cookie is versioned (`<decision>~<LEGAL_TEXTS_VERSION>~
-- <epoch>`, FRESCO-1007), so a new texts version brings the banner back, yet the server kept trusting the stored
-- `true` of the old version and went on sending server-side PostHog events until the person decided again.
--
-- Two nullable columns carry the version and the moment of the decision, written by the same browser sync that
-- writes `analytics_consent`, under the owner's own session (covered by the existing table-level grants and
-- `profiles_update_own`; a user who forged them would only affect analytics about themselves, the same trade-off as
-- FRESCO-919 and ADR-0040). The current version stays in code (`LEGAL_TEXTS_VERSION`, and its copy in
-- `supabase/functions/_shared/posthog.ts`); the database only records the version a decision was taken under.
--
-- Existing rows get null: their `true` stops sending server-side events until the browser syncs the decision again
-- at the current version (the next signed-in page load with a valid cookie). That is the intended fail-closed
-- behaviour, and nothing is written FOR the user.
alter table public.user_profiles
  add column if not exists analytics_consent_at timestamptz,
  add column if not exists analytics_consent_version text;

comment on column public.user_profiles.analytics_consent_at is
  'When the cookie-banner analytics decision was taken (from the consent cookie), synced with analytics_consent. FRESCO-1124.';
comment on column public.user_profiles.analytics_consent_version is
  'The legal texts version the analytics decision was taken under. Server-side PostHog events are sent only when it equals the current LEGAL_TEXTS_VERSION. FRESCO-1124.';
