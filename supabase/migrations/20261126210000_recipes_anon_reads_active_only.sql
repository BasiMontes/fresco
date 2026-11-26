-- FRESCO-1315 / QAFRESCO-31 (owner decision, 2026-11-26): without a session only
-- active recipes can be read. "Recetas públicas para lectura" allowed every row
-- to `anon` and `authenticated`, retired recipes included.
--
-- Signed-in users (guests included, they are `authenticated`) keep reading the
-- whole catalogue: menus already generated point at recipes retired since.
-- The anonymous readers that exist (the health probe and two photo scripts) work
-- on active rows or only need one row.

alter policy "Recetas públicas para lectura" on public.recipes
  to authenticated;

drop policy if exists "Recetas activas visibles sin sesión" on public.recipes;

create policy "Recetas activas visibles sin sesión" on public.recipes
  for select
  to anon
  using (activo);
