-- FRESCO-910 (definitive audit C-06, GDPR art. 17): a record that an account was erased.
--
-- Deleting the auth user cascades every table that references it, so afterwards nothing
-- shows that the erasure happened, nor whether the external copies (Stripe customer,
-- PostHog person) went with it. `delete-account` writes one row here AFTER the auth user
-- is gone.
--
-- No direct identifier is kept: `user_hash` is the SHA-256 of the user id, which lets the
-- controller show that a known id was erased without holding the id itself. The one
-- exception is `pending_posthog_distinct_id`: when the PostHog deletion failed, the id is
-- kept until a later run deletes the person and clears it (the constraint ties the two
-- together), because without it the failed deletion could never be retried.
--
-- Same locked-down shape as stripe_webhook_events: RLS on, zero policies, no client role
-- ever touches it; only the service-role client inside delete-account does.

create table public.account_erasures (
  id                          uuid primary key default gen_random_uuid(),
  user_hash                   text not null check (user_hash ~ '^[0-9a-f]{64}$'),
  erased_at                   timestamptz not null default now(),
  -- 'none': the account had no Stripe customer; 'cancelled': subscription ended and customer deleted.
  stripe                      text not null check (stripe in ('none', 'cancelled')),
  -- 'not_configured': the function had no PostHog credentials; 'failed': kept for a retry.
  posthog                     text not null check (posthog in ('deleted', 'not_found', 'not_configured', 'failed')),
  pending_posthog_distinct_id text,
  constraint account_erasures_pending_iff_failed
    check ((posthog = 'failed') = (pending_posthog_distinct_id is not null))
);

comment on table public.account_erasures is
  'One row per erased account (FRESCO-910): SHA-256 of the user id, when, and what happened to the Stripe customer and the PostHog person. Written by the service role only.';

create index account_erasures_posthog_pending_idx
  on public.account_erasures (erased_at)
  where posthog = 'failed';

alter table public.account_erasures enable row level security;
revoke all on public.account_erasures from public, anon, authenticated;

-- A new public table gets no data privileges by default, not even for service_role.
-- delete-account inserts; select lets an operator on the service role audit it. The
-- follow-up that retries a failed PostHog deletion will need update.
grant select, insert on public.account_erasures to service_role;
