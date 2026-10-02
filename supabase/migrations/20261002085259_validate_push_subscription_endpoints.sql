-- FRESCO-779 (audit-6 A6-S2): `push_subscriptions` accepted any URL from any
-- signed-in caller, guests included.
--
-- The weekly re-engagement function (service role, every Sunday) POSTs a
-- signed VAPID request to each stored `endpoint`. With only `UNIQUE(endpoint)`
-- on the table, one guest could store `https://attacker.tld/x` (or an internal
-- address) and make Supabase's infrastructure call it — a blind SSRF — and a
-- slow server stalled the sequential send loop so nobody legitimate got the
-- reminder.
--
-- Close the door in the database, where the unvalidated write happens:
--
--   1. `endpoint` must be an https URL on a real push service. The `/` right
--      after the host is deliberate: it rejects `host.attacker.tld`,
--      `host@attacker.tld` and an explicit port. The same rule lives in
--      TypeScript (`supabase/functions/_shared/push-endpoint.ts`) as defence in
--      depth for the sender; `tests/db/push-subscriptions-validation.test.ts`
--      runs one set of vectors through both.
--   2. Key material has the bounded base64url shape `PushSubscription.toJSON()`
--      produces (a P-256 key is 87 characters, the auth secret 22).
--   3. A user holds at most 10 subscriptions (one per browser install).
--   4. Guest (anonymous) sessions cannot subscribe: they are free to create in
--      bulk, and the opt-in UI hides the control for them.
--
-- `push_subscriptions` is empty in production at the time of writing, so the
-- constraints are added validated with no data to repair.

alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_allowed check (
    length(endpoint) <= 2048
    and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)/\S*$'
  ),
  add constraint push_subscriptions_p256dh_format check (p256dh ~ '^[A-Za-z0-9_-]{1,200}$'),
  add constraint push_subscriptions_auth_format check (auth ~ '^[A-Za-z0-9_-]{1,100}$');

-- Per-user cap. SECURITY INVOKER: the caller's own RLS-scoped SELECT already
-- sees every row for `new.user_id`, which is always their own.
create function public.enforce_push_subscription_cap()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $function$
begin
  if (select count(*) from public.push_subscriptions where user_id = new.user_id) >= 10 then
    raise exception 'push_subscriptions: limit of 10 subscriptions per user reached'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

revoke execute on function public.enforce_push_subscription_cap() from public, anon, authenticated;

create trigger push_subscriptions_enforce_cap
  before insert on public.push_subscriptions
  for each row
  execute function public.enforce_push_subscription_cap();

-- No guest subscriptions. Supabase puts `is_anonymous` in the access token.
alter policy "push_subscriptions_insert_own" on public.push_subscriptions
  with check (
    (select auth.uid()) = user_id
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );
