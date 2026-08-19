-- QA verification of EPIC-FRESCO-227 (2026-08-19) found: the Stripe webhook
-- (app/api/stripe/webhook/route.ts) uses a service-role Supabase client
-- (lib/supabase/service.ts) to write user_profiles on every subscription
-- event, but service_role was never granted table privileges on
-- user_profiles -- 20260729120000_grant_authenticated_table_privileges.sql
-- granted the `authenticated` role only. Every real webhook call has been
-- failing in production with `permission denied for table user_profiles`
-- (42501) since FRESCO-228 shipped; prior QA passes never caught this
-- because they wrote via a superuser-backed SQL client, not through the
-- app's actual service-role key.
--
-- service_role bypasses RLS in Supabase by design, but RLS bypass is
-- separate from base table GRANTs -- both are required.

grant select, update on public.user_profiles to service_role;
