alter table public.user_profiles
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique;

comment on column public.user_profiles.stripe_customer_id is
  'FRESCO-228: Stripe Customer id, set once by the checkout.session.completed webhook handler — never written client-side (ADR-0007).';

comment on column public.user_profiles.stripe_subscription_id is
  'FRESCO-228: Stripe Subscription id, set once by the checkout.session.completed webhook handler — never written client-side (ADR-0007).';
