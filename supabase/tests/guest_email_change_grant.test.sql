-- pgTAP test for the guest email-change guard (FRESCO-1085, audit 8 A8-ABUSE-01).
-- Run by `supabase test db` (CI: the e2e job in .github/workflows/pr-check.yml, right after
-- `supabase db reset`).
--
-- Auth writes the pending address to auth.users.email_change and stamps email_change_sent_at
-- before it mails anything. The trigger guest_email_change_requires_grant refuses that write for an
-- anonymous user unless a one-shot grant exists, so a direct PUT /auth/v1/user {email} with a guest
-- token cannot send a mail. These statements are exactly the UPDATEs Auth runs, so the guard is
-- tested at the database whatever the local Auth config is (the local stack autoconfirms email
-- changes and never writes email_change; hosted does).

begin;
select plan(14);

-- ── Fixtures ────────────────────────────────────────────────────────────
insert into auth.users (id, email, is_anonymous) values
  ('c0000001-0000-0000-0000-000000000001', null, true),
  ('c0000002-0000-0000-0000-000000000002', null, true),
  ('c0000003-0000-0000-0000-000000000003', null, true),
  ('c0000004-0000-0000-0000-000000000004', null, true),
  ('c0000005-0000-0000-0000-000000000005', 'fresco-1085-registered@test.local', false);

-- ── A guest without a grant ─────────────────────────────────────────────
select throws_ok(
  $$update auth.users set email_change = 'victim@example.com', email_change_sent_at = now() where id = 'c0000001-0000-0000-0000-000000000001'$$,
  'P0001', null,
  'a guest cannot get a pending email written without a grant'
);

select is(
  (select coalesce(email_change, '') from auth.users where id = 'c0000001-0000-0000-0000-000000000001'),
  '',
  'the refused write leaves nothing pending'
);

-- ── With a grant: once ──────────────────────────────────────────────────
select lives_ok(
  $$select public.grant_guest_email_change('c0000001-0000-0000-0000-000000000001')$$,
  'the grant is created for a guest'
);

select lives_ok(
  $$update auth.users set email_change = 'ana@example.com', email_change_sent_at = now() where id = 'c0000001-0000-0000-0000-000000000001'$$,
  'with a grant the pending email is written'
);

select throws_ok(
  $$update auth.users set email_change = 'ana@example.com', email_change_sent_at = now() + interval '1 second' where id = 'c0000001-0000-0000-0000-000000000001'$$,
  'P0001', null,
  'the grant was consumed: re-sending the same pending address needs a new one'
);

-- ── What must keep working ──────────────────────────────────────────────
select throws_ok(
  $$select public.grant_guest_email_change('c0000005-0000-0000-0000-000000000005')$$,
  'P0002', null,
  'a grant cannot be made for a registered user'
);

select lives_ok(
  $$update auth.users set email_change = 'new@example.com', email_change_sent_at = now() where id = 'c0000005-0000-0000-0000-000000000005'$$,
  'a registered user changes email without a grant: the trigger is for guests only'
);

select lives_ok(
  $$update auth.users set last_sign_in_at = now() where id = 'c0000001-0000-0000-0000-000000000001'$$,
  'a guest session refresh (any column but the pending email) is untouched'
);

select lives_ok(
  $$update auth.users set email_change = '', email_change_sent_at = null where id = 'c0000001-0000-0000-0000-000000000001'$$,
  'clearing the pending email (the confirmation) needs no grant'
);

-- ── Expired, and someone else's ─────────────────────────────────────────
select public.grant_guest_email_change('c0000002-0000-0000-0000-000000000002');
update public.guest_email_change_grants set expires_at = now() - interval '1 second'
  where user_id = 'c0000002-0000-0000-0000-000000000002';

select throws_ok(
  $$update auth.users set email_change = 'late@example.com', email_change_sent_at = now() where id = 'c0000002-0000-0000-0000-000000000002'$$,
  'P0001', null,
  'an expired grant (older than 60 seconds) does not open the path'
);

select public.grant_guest_email_change('c0000003-0000-0000-0000-000000000003');

select throws_ok(
  $$update auth.users set email_change = 'other@example.com', email_change_sent_at = now() where id = 'c0000004-0000-0000-0000-000000000004'$$,
  'P0001', null,
  'a grant is for one guest: it does not open the path for another'
);

-- ── Who can ask for a grant ─────────────────────────────────────────────
select ok(
  not has_function_privilege('authenticated', 'public.grant_guest_email_change(uuid)', 'execute'),
  'a signed-in guest cannot grant itself'
);

select ok(
  not has_function_privilege('anon', 'public.grant_guest_email_change(uuid)', 'execute'),
  'anon cannot grant'
);

select ok(
  has_function_privilege('service_role', 'public.grant_guest_email_change(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.enforce_guest_email_change_grant()', 'execute'),
  'only service_role grants, and the trigger function is closed to clients'
);

select * from finish();
rollback;
