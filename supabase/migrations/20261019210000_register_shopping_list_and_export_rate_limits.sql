-- FRESCO-1017 (audit 7b A7-ABUSE-04, A7-ABUSE-05): three authenticated endpoints had no limit, so one
-- free or guest account could loop them and burn the Edge invocation quota and database CPU that every
-- environment shares. check_and_increment_rate_limit only accepts endpoints listed in
-- rate_limit_endpoints (FRESCO-799), clamped to the ceiling stored here, so the callers cannot use it
-- until the endpoints are registered. The call sites pass the same numbers.
--
--   generate-shopping-list          60 an hour: a list is built once per plan and rebuilt in place when
--                                   the plan changes (FRESCO-1010); a human does that a few times a week.
--   get-shopping-list-suggestions  120 an hour: read each time the list screen opens.
--   profile-export                  10 an hour: the "Backup CSV" button, a few times a month at most; the
--                                   export reads every table the user owns, so it is the costly one.
--
-- Idempotent: a rerun leaves an existing row (and any ceiling the owner tuned) alone.
insert into public.rate_limit_endpoints (endpoint, max_per_hour) values
  ('generate-shopping-list', 60),
  ('get-shopping-list-suggestions', 120),
  ('profile-export', 10)
on conflict (endpoint) do nothing;
