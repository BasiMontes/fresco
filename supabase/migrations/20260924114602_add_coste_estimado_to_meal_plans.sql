-- FRESCO-535: persist the weekly estimated grocery spend (already computed by
-- estimateMenuCost(), FRESCO-340) so it can be charted as a trend over time.
-- Nullable, no default: NULL means "not computed yet for this week" -- the
-- exact gap state the spend-trend chart needs to distinguish from a real 0.

alter table public.meal_plans
  add column coste_estimado numeric;

comment on column public.meal_plans.coste_estimado is
  'FRESCO-535: weekly estimated grocery spend for this meal_plans row, written lazily on first render of /menu for that week (see app/(app)/menu/page.tsx). NULL until computed -- never backfilled for past weeks, and never overwritten once set (idempotent write, guarded by coste_estimado IS NULL).';
