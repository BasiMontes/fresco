-- FRESCO-770 (step 4 of the supermarket data layer migration, ADR-0036): the
-- Postgres price model from `.context/design/supermarket-data-layer.md` §5 plus
-- a read RPC. Nothing reads these tables yet -- the consumers still use the
-- generated catalogs -- so this migration only creates the place the refresh
-- runner (next PR) will write to.
--
-- Access (ADR-0036): RLS on every table; `select` for `authenticated` (guests
-- are anonymous-auth users, so they are included); no insert / update / delete
-- policy, so only `service_role` writes -- the same shape as the recipe catalog.
--
-- RPC authorization (ADR-0032, references/rpc-authorization.md): SECURITY
-- INVOKER with NO identity parameter. The data is global and public-read, so
-- there is no per-caller row to scope and no actor to bind; a function that
-- cannot be told who the caller is cannot be lied to. The permission gate is
-- enforced in the function body as well, so it does not depend on the caller
-- filtering.

-- -- 1. Chains and the legal gate ------------------------------------------------

create table public.supermarket_chain (
  slug        text primary key,
  nombre      text not null,
  permiso     text not null check (permiso in ('concedido', 'riesgo-aceptado', 'pendiente', 'rechazado')),
  permiso_ref text,
  habilitada  boolean not null default false,
  -- The legal gate, mirrored from lib/grocery/supermarket/connector.ts
  -- (`puedeEjecutarse`): a runnable state must cite the document that justifies it...
  constraint supermarket_chain_permiso_ejecutable_con_ref
    check (permiso not in ('concedido', 'riesgo-aceptado') or length(trim(coalesce(permiso_ref, ''))) > 0),
  -- ...and a chain can only be switched on while it is in a runnable state.
  constraint supermarket_chain_habilitada_requiere_permiso
    check (not habilitada or permiso in ('concedido', 'riesgo-aceptado'))
);

-- -- 2. Products, zones, prices ---------------------------------------------------

create table public.supermarket_product (
  id                    bigint generated always as identity primary key,
  cadena                text not null references public.supermarket_chain (slug),
  id_externo            text not null,
  nombre                text not null,
  marca                 text,
  envase_cantidad       numeric(12, 3) not null check (envase_cantidad > 0),
  envase_unidad         text not null check (envase_unidad in ('g', 'ml', 'unidad')),
  url                   text,
  visto_por_primera_vez timestamptz not null default now(),
  visto_por_ultima_vez  timestamptz not null default now(),
  constraint supermarket_product_cadena_id_externo_key unique (cadena, id_externo)
);

-- Price zone: a store id or a postcode area, whichever the chain prices by.
create table public.supermarket_zone (
  cadena text not null references public.supermarket_chain (slug),
  zona   text not null,
  primary key (cadena, zona)
);

-- Postcode as a first-class input: which zone a postcode falls in, per chain.
-- Fresco stores no postcode today, so this stays empty until that product
-- decision is taken; every chain prices a single `default` zone meanwhile.
create table public.supermarket_zone_postcode (
  cadena        text not null,
  codigo_postal text not null,
  zona          text not null,
  primary key (cadena, codigo_postal),
  foreign key (cadena, zona) references public.supermarket_zone (cadena, zona)
);

-- Current price: one row per product and zone.
create table public.supermarket_price (
  producto_id   bigint not null references public.supermarket_product (id) on delete cascade,
  zona          text not null,
  precio_envase numeric(10, 2) not null check (precio_envase > 0),
  disponible    boolean not null,
  observado_en  timestamptz not null,
  primary key (producto_id, zona)
);

-- History: append only when the price or the availability changes.
create table public.supermarket_price_history (
  producto_id   bigint not null references public.supermarket_product (id) on delete cascade,
  zona          text not null,
  precio_envase numeric(10, 2) not null,
  disponible    boolean not null,
  observado_en  timestamptz not null,
  primary key (producto_id, zona, observado_en)
);

-- Matching cache: which products satisfy an ingredient (key from the lib/grocery dictionary).
create table public.ingredient_product_match (
  ingrediente text not null,
  producto_id bigint not null references public.supermarket_product (id) on delete cascade,
  confianza   text not null check (confianza in ('alta', 'media', 'baja')),
  confirmado  boolean not null default false,
  creado_en   timestamptz not null default now(),
  primary key (ingrediente, producto_id)
);

-- Reverse lookup (a product's matches) and the price-by-zone join the RPC does.
create index ingredient_product_match_producto_id_idx on public.ingredient_product_match (producto_id);

-- -- 3. RLS: read for authenticated, write for service_role only ------------------

alter table public.supermarket_chain enable row level security;
alter table public.supermarket_product enable row level security;
alter table public.supermarket_zone enable row level security;
alter table public.supermarket_zone_postcode enable row level security;
alter table public.supermarket_price enable row level security;
alter table public.supermarket_price_history enable row level security;
alter table public.ingredient_product_match enable row level security;

create policy supermarket_chain_select_authenticated on public.supermarket_chain
  for select to authenticated using (true);
create policy supermarket_product_select_authenticated on public.supermarket_product
  for select to authenticated using (true);
create policy supermarket_zone_select_authenticated on public.supermarket_zone
  for select to authenticated using (true);
create policy supermarket_zone_postcode_select_authenticated on public.supermarket_zone_postcode
  for select to authenticated using (true);
create policy supermarket_price_select_authenticated on public.supermarket_price
  for select to authenticated using (true);
create policy supermarket_price_history_select_authenticated on public.supermarket_price_history
  for select to authenticated using (true);
create policy ingredient_product_match_select_authenticated on public.ingredient_product_match
  for select to authenticated using (true);

grant select on
  public.supermarket_chain,
  public.supermarket_product,
  public.supermarket_zone,
  public.supermarket_zone_postcode,
  public.supermarket_price,
  public.supermarket_price_history,
  public.ingredient_product_match
to authenticated;

grant select, insert, update, delete on
  public.supermarket_chain,
  public.supermarket_product,
  public.supermarket_zone,
  public.supermarket_zone_postcode,
  public.supermarket_price,
  public.supermarket_price_history,
  public.ingredient_product_match
to service_role;

-- -- 4. Seed: the four chains with their real legal state -------------------------
-- Mirrors the registry in lib/grocery/supermarket/catalog-connectors.ts:
-- Mercadona and Consum run under accepted risk (ADR-0028, ADR-0037); Dia and
-- Alcampo are still waiting on written consent (FRESCO-764 tracks the requests).
-- tests/db/supermarket-price-model.test.ts fails if the two drift apart.

insert into public.supermarket_chain (slug, nombre, permiso, permiso_ref, habilitada) values
  ('mercadona', 'Mercadona', 'riesgo-aceptado', 'ADR-0028', true),
  ('consum',    'Consum',    'riesgo-aceptado', 'ADR-0037', true),
  ('dia',       'Dia',       'pendiente',       null,       false),
  ('alcampo',   'Alcampo',   'pendiente',       null,       false);

-- No postcode capture yet: one `default` zone per chain.
insert into public.supermarket_zone (cadena, zona)
select slug, 'default' from public.supermarket_chain;

-- -- 5. Read RPC -------------------------------------------------------------------
-- Prices for a set of ingredient keys in one zone. SECURITY INVOKER, no identity
-- parameter (see header). Fail-closed on the legal gate: a product of a chain
-- that is not enabled, or whose permission is not runnable with a cited
-- reference, is never returned, whatever the tables hold. Unknown ingredients,
-- unknown zones and empty input return zero rows, never an error.
-- At most 200 keys are read, so a caller cannot make one call unbounded.

create function public.get_supermarket_prices(
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
  join public.supermarket_chain c on c.slug = p.cadena
  join public.supermarket_price pr on pr.producto_id = p.id and pr.zona = p_zona
  where m.ingrediente = any (p_ingredientes[1:200])
    and c.habilitada
    and c.permiso in ('concedido', 'riesgo-aceptado')
    and length(trim(coalesce(c.permiso_ref, ''))) > 0;
$function$;

revoke execute on function public.get_supermarket_prices(text[], text) from public, anon;
grant execute on function public.get_supermarket_prices(text[], text) to authenticated;
