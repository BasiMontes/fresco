alter table public.user_profiles
  add column payment_failed_at timestamptz;

comment on column public.user_profiles.payment_failed_at is
  'FRESCO-232: set by the webhook when a Pro renewal charge fails (subscription status past_due/unpaid), cleared on a successful retry or on final downgrade to free — never written client-side (ADR-0007).';
