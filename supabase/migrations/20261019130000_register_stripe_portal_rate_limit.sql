-- FRESCO-1003 (audit 7b A7-API-04): POST /api/stripe/portal opens a Stripe Billing Portal session
-- on every call and had no limit. check_and_increment_rate_limit only accepts endpoints listed in
-- rate_limit_endpoints (FRESCO-799), clamped to the ceiling stored here, so the route cannot call
-- it until the endpoint is registered. 20 an hour per user: the portal is opened a few times a
-- month, and the call site passes the same number.
--
-- Idempotent: a rerun leaves an existing row (and any ceiling the owner tuned) alone.
insert into public.rate_limit_endpoints (endpoint, max_per_hour) values
  ('stripe-portal', 20)
on conflict (endpoint) do nothing;
