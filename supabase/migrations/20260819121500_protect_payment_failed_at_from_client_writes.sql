-- Code review on STORY-FRESCO-232's PR found: the previous migration
-- (20260818190000) closed the client-write gap for
-- plan/plan_expires_at/stripe_customer_id/stripe_subscription_id, but
-- payment_failed_at (added right after, 20260819120000) was never added to
-- that same trigger's protected-column list. RLS's profiles_update_own has
-- no column restriction, so any authenticated user could call
-- `.from('user_profiles').update({ payment_failed_at: null }).eq('id', ownId)`
-- directly from the browser and permanently hide a real failed-payment
-- aviso — contradicting this same column's own comment ("never written
-- client-side, ADR-0007") and the webhook's "ONLY writer" doc comment.
--
-- `create or replace function` on the existing trigger function is
-- idempotent and re-attaches to the same already-created trigger — no need
-- to touch the trigger definition itself.

create or replace function public.prevent_client_subscription_writes()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.plan is distinct from old.plan
    or new.plan_expires_at is distinct from old.plan_expires_at
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.payment_failed_at is distinct from old.payment_failed_at
  then
    raise exception 'plan/subscription fields are managed by the Stripe webhook only (ADR-0007)';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
