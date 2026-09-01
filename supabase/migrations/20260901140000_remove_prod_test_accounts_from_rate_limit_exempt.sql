-- FRESCO-363 (audit-4 A4-H9): `rate_limit_exempt_users` carried 4 production
-- test-account UUIDs (seeded by 20260827215620, then re-seeded by 20260830142702).
-- Those accounts' credentials live in `.env`, in CI secrets, AND in the Jira
-- epic linked from the PUBLIC `/qa` page — so anyone with them had uncapped
-- access to every rate-limited Edge Function (generate-meal-plan,
-- update-recipe-status). Remove the exemption: those accounts are now rate
-- limited exactly like real users.
--
-- This supersedes the INSERT blocks in 20260827215620 +
-- 20260830142702 (append-only — those migrations are NOT edited). Replaying
-- either of them after this migration would re-insert the rows; that is
-- acceptable because migrations do not replay against the hosted project, and
-- this DELETE is idempotent if it ever runs again.
--
-- CI's ephemeral local Supabase stack (post-FRESCO-310) seeds its OWN
-- exemptions for its own seeded test users via `supabase/seed.sql`, so the
-- CI e2e suite is unaffected. A4-M11 (a second, isolated prod project) stays
-- deferred to Supabase Pro per FRESCO-328.

delete from public.rate_limit_exempt_users
where user_id in (
  '9db00aac-ccaf-4890-a776-41ec5754dc94',  -- hola.frescoapp+dev-user@gmail.com
  '8dc4c490-ea98-4c7b-b610-c315d77febfb',  -- hola.frescoapp+pre-user@gmail.com
  'd757a8bb-0f19-4aca-9c90-cbba656b2a4c',  -- hola.frescoapp+pro-user@gmail.com
  '5b900e16-041f-4906-af43-38adfe992bf3'   -- throwaway
);
