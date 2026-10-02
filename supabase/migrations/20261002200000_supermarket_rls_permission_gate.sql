-- FRESCO-798 (audit-6 A6-S6): the supermarket tables must honour the legal
-- permission gate on a DIRECT read too, not only inside get_supermarket_prices.
--
-- Before: all seven tables had `select ... using (true)` for `authenticated`
-- (guests included), so a plain `select` skipped the gate the RPC body applies:
-- as soon as a `pendiente`/`rechazado` chain had rows loaded they were readable.
-- `supermarket_chain` also exposed `permiso` / `permiso_ref`, the internal legal
-- position. Nothing in the app reads these tables as a user (the refresh runner
-- writes with service_role and the RPC is the read path), so tightening them
-- changes no behaviour for a user.
--
-- After:
--   * the gate lives in ONE place, `private.supermarket_chain_activa(cadena)`,
--     used by every policy and by the RPC, so they cannot drift apart;
--   * product / zone / zone_postcode / price / ingredient_product_match are
--     readable only for a chain that passes the gate;
--   * supermarket_price_history is service_role only (an analytics table);
--   * supermarket_chain has no direct select for authenticated at all.
--
-- Why a SECURITY DEFINER helper in a private schema: a policy's subquery runs
-- with the CALLER's privileges, and the caller must no longer read
-- supermarket_chain. The helper returns one boolean for one slug and takes no
-- identity (ADR-0032), so a definer function cannot be abused through it. It
-- lives in `private`, which the Data API does not expose, instead of `public`
-- where every definer function is a callable endpoint.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create function private.supermarket_chain_activa(p_cadena text)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.supermarket_chain c
    where c.slug = p_cadena
      and c.habilitada
      and c.permiso in ('concedido', 'riesgo-aceptado')
      and length(trim(coalesce(c.permiso_ref, ''))) > 0
  );
$function$;

comment on function private.supermarket_chain_activa(text) is
  'FRESCO-798: the supermarket legal gate for ONE chain (enabled, runnable permission, cited reference). Mirrors lib/grocery/supermarket/connector.ts puedeEjecutarse. SECURITY DEFINER because callers may not read supermarket_chain; returns a boolean only and takes no identity (ADR-0032).';

revoke execute on function private.supermarket_chain_activa(text) from public, anon;
grant execute on function private.supermarket_chain_activa(text) to authenticated, service_role;

-- -- chain: no direct read for users ------------------------------------------------
drop policy supermarket_chain_select_authenticated on public.supermarket_chain;
revoke select on public.supermarket_chain from authenticated;

-- -- history: service_role only ------------------------------------------------------
drop policy supermarket_price_history_select_authenticated on public.supermarket_price_history;
revoke select on public.supermarket_price_history from authenticated;

-- -- the rest: readable only through the gate ---------------------------------------
drop policy supermarket_product_select_authenticated on public.supermarket_product;
create policy supermarket_product_select_authenticated on public.supermarket_product
  for select to authenticated using (private.supermarket_chain_activa(cadena));

drop policy supermarket_zone_select_authenticated on public.supermarket_zone;
create policy supermarket_zone_select_authenticated on public.supermarket_zone
  for select to authenticated using (private.supermarket_chain_activa(cadena));

drop policy supermarket_zone_postcode_select_authenticated on public.supermarket_zone_postcode;
create policy supermarket_zone_postcode_select_authenticated on public.supermarket_zone_postcode
  for select to authenticated using (private.supermarket_chain_activa(cadena));

drop policy supermarket_price_select_authenticated on public.supermarket_price;
create policy supermarket_price_select_authenticated on public.supermarket_price
  for select to authenticated using (
    exists (
      select 1 from public.supermarket_product p
      where p.id = supermarket_price.producto_id
        and private.supermarket_chain_activa(p.cadena)
    )
  );

drop policy ingredient_product_match_select_authenticated on public.ingredient_product_match;
create policy ingredient_product_match_select_authenticated on public.ingredient_product_match
  for select to authenticated using (
    exists (
      select 1 from public.supermarket_product p
      where p.id = ingredient_product_match.producto_id
        and private.supermarket_chain_activa(p.cadena)
    )
  );

-- -- RPC: same gate, no longer joining a table the caller cannot read ----------------
-- Same signature and return type, still SECURITY INVOKER with no identity
-- parameter (ADR-0032). The gate is applied here as well as in the policies, so
-- the function stays fail-closed even if a policy were loosened later.
create or replace function public.get_supermarket_prices(
  p_ingredientes text[],
  p_zona text default 'default'
)
returns table (
  ingrediente text,
  cadena text,
  id_externo text,
  nombre text,
  marca text,
  envase_cantidad numeric,
  envase_unidad text,
  url text,
  precio_envase numeric,
  disponible boolean,
  observado_en timestamptz,
  confianza text,
  confirmado boolean
)
language sql
stable security invoker
set search_path to 'public'
as $function$
  select
    m.ingrediente,
    p.cadena,
    p.id_externo,
    p.nombre,
    p.marca,
    p.envase_cantidad,
    p.envase_unidad,
    p.url,
    pr.precio_envase,
    pr.disponible,
    pr.observado_en,
    m.confianza,
    m.confirmado
  from public.ingredient_product_match m
  join public.supermarket_product p on p.id = m.producto_id
  join public.supermarket_price pr on pr.producto_id = p.id and pr.zona = p_zona
  where m.ingrediente = any (p_ingredientes[1:200])
    and private.supermarket_chain_activa(p.cadena);
$function$;
