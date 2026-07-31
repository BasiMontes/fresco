-- STORY-FRESCO-13: the Edge Function's generation response already returns
-- resumen.coste_estimado_min/max (api-contracts.md §2b), but public.shopping_lists
-- never persisted it — only `items` (the pasillos jsonb). A page revisit
-- (not the moment right after generation) had no way to show the cost
-- estimate the Alcance field explicitly requires ("mostrar ... el coste
-- estimado de la compra"), only the item count. Additive columns, backfilled
-- 0 for any pre-existing row (none expected outside manual test data).

alter table public.shopping_lists
  add column coste_estimado_min numeric not null default 0,
  add column coste_estimado_max numeric not null default 0;
