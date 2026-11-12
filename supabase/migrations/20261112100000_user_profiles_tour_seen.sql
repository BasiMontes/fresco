-- FRESCO-1197: the first-visit tour is shown once per account. `recorrido_visto` remembers, on the account
-- (not in the browser), that the person has seen, skipped or closed it, so it follows them across devices.
--
-- Decision (owner, 2026-11-12): accounts that already exist are marked as seen, so only new accounts and
-- guests who register after this ships get the tour. Anyone can still replay it from Configuracion.
--
-- How the backfill works: the column is added with `default true`, which fills every row that exists NOW
-- with true without a table-wide UPDATE, and the default is then set to false so every row created from
-- here on starts as not seen. Both statements run in this one migration, so no row is ever inserted
-- between them.
--
-- Written by the owner under their own session, covered by the existing table-level grants and
-- `profiles_update_own`, like `aviso_bienvenida_visto` and `analytics_consent`. A person who forged the
-- value would only hide the tour from themselves. Neither trigger on this table reacts to it:
-- `require_health_data_consent` checks an UPDATE only when a health column changes, and
-- `user_profiles_retire_conflicting_slots` fires only on allergen, disliked-ingredient and diet columns.
--
-- Check after applying it to a database that already has accounts: no row older than this migration may
-- be false, `select count(*) from public.user_profiles where not recorrido_visto and created_at < <apply time>`
-- must return 0.
alter table public.user_profiles
  add column if not exists recorrido_visto boolean not null default true;

alter table public.user_profiles
  alter column recorrido_visto set default false;

comment on column public.user_profiles.recorrido_visto is
  'FRESCO-1197: true once the person has seen, skipped or closed the first-visit tour. Accounts that existed when the column was added start as true; new ones start as false.';
