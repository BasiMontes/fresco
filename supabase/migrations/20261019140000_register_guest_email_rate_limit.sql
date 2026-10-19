-- FRESCO-1006 (audit 7b A7-ABUSE-02): POST /api/auth/guest-email mails a code to an address the
-- guest typed, and had no limit of ours. check_and_increment_rate_limit only accepts endpoints
-- listed in rate_limit_endpoints (FRESCO-799), clamped to the ceiling stored here, so the route
-- cannot call it until the endpoint is registered. 3 an hour per guest: a real conversion needs
-- one send, plus a resend or two when the first code is lost, and Auth's own quota and the Gmail
-- daily cap behind it (ADR-0021) are far too small to share with a flood.
--
-- Idempotent: a rerun leaves an existing row (and any ceiling the owner tuned) alone.
insert into public.rate_limit_endpoints (endpoint, max_per_hour) values
  ('guest-email-change', 3)
on conflict (endpoint) do nothing;
