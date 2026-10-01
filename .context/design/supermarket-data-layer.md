# Supermarket data layer: design proposal

- **Ticket:** FRESCO-752 (derived from the FRESCO-747 research)
- **Status:** Proposal. The architectural decision is recorded in `ADR-0036` (Proposed).
- **Code that ships with it:** `lib/grocery/supermarket/` (contract, units, connector registry, fake connector, matcher, refresh plan), all tested against synthetic fixtures.
- **Out of scope:** calling any real supermarket (ADR-0028 and the FRESCO-764 consent tracking gate that), any paid provider (ADR-0027), migrating the existing consumers (see "Migration path").

## 1. Problem today

Verified in `lib/grocery/types.ts` and the two generators:

- **One field family per chain.** `precioMercadona`, `precioConsum`, `mercadonaUrl`, `consumUrl` on `MappedGroceryItem` and on `CanonicalIngredient`. A third chain means new fields in every type and every consumer.
- **Prices that do not mean the same thing.** `PrecioMercadona.precioReferencia` is the price of ONE reference unit ("3,90 EUR / L"), `PrecioConsum.precio` is the price of the WHOLE pack. `estimate-menu-cost.ts` carries a conversion that only works for the first.
- **No store or zone.** Prices are a single national number per ingredient, but chains price by store or postcode.
- **No history, no freshness.** The data is a generated file committed to git (FRESCO-762 refreshes it weekly). Fine for one chain; it cannot answer "what did this cost last month" or "how old is this price".
- **No place for the legal state.** Whether a chain may be used at all lives in ADRs and Jira cards, not where the code runs.

## 2. Goals

- Show a supermarket price without depending on any one source: a connector is replaceable, the rest does not change.
- One price meaning everywhere, so two chains can be compared.
- A chain whose permission is not settled cannot run, enforced in code.
- Refresh only what menus need, in small batches.
- Everything designed and tested with a fake connector; no real chain touched.

## 3. The normalized product

`ProductoSupermercado` (`lib/grocery/supermarket/types.ts`): chain, external id, name, brand, `envase` in a base unit (`g`, `ml`, `unidad`), `precioEnvase`, url, availability, zone, observation instant.

**Invariant: `precioEnvase` is always the price of the whole pack.** A connector for a chain that prints a price per reference unit converts it with `precioEnvaseDesdeReferencia`, which returns `null` (the connector drops the product) when the unit is unknown or not the same family as the pack. Comparison across pack sizes uses `precioPorUnidadReferencia` (EUR per kg, l or unit).

## 4. Connectors and the permission gate

`SupermarketConnector`: `cadena`, `permiso`, `permisoRef`, `capacidades`, `buscarProductos(termino, zona)`, `obtenerProducto(idExterno, zona)`. Typed errors: `LimiteDeTasaError` (carries the wait), `BloqueoError` (the chain refused; that chain's circuit opens), `PermisoNoConcedidoError`.

`permiso` is one of `concedido` (written consent), `riesgo-aceptado` (no consent, risk accepted in an ADR), `pendiente`, `rechazado`. `crearRegistro` returns only connectors that may run, and `get(cadena)` throws for the rest. **Fail-closed:** a runnable state with an empty `permisoRef`, or any unexpected value, counts as not permitted.

Today that maps to: Mercadona `riesgo-aceptado` (`ADR-0028`), Consum, Dia and Alcampo `pendiente` (FRESCO-764, 765, 766).

## 5. Data model (Postgres, proposal only)

**This SQL is not a migration.** It is here so the model can be reviewed; nothing in `supabase/migrations/` changes in this ticket. Naming follows the existing schema: English table names, Spanish domain columns.

```sql
create table supermarket_chain (
  slug        text primary key,
  nombre      text not null,
  permiso     text not null check (permiso in ('concedido', 'riesgo-aceptado', 'pendiente', 'rechazado')),
  permiso_ref text,
  habilitada  boolean not null default false,
  -- the legal gate, mirrored in the database
  constraint permiso_ejecutable_con_ref
    check (permiso not in ('concedido', 'riesgo-aceptado') or length(trim(coalesce(permiso_ref, ''))) > 0)
);

create table supermarket_product (
  id                    bigint generated always as identity primary key,
  cadena                text not null references supermarket_chain (slug),
  id_externo            text not null,
  nombre                text not null,
  marca                 text,
  envase_cantidad       numeric(12, 3) not null check (envase_cantidad > 0),
  envase_unidad         text not null check (envase_unidad in ('g', 'ml', 'unidad')),
  url                   text,
  visto_por_primera_vez timestamptz not null default now(),
  visto_por_ultima_vez  timestamptz not null default now(),
  unique (cadena, id_externo)
);

-- Price zone: a store id or a postcode area, whichever the chain prices by.
create table supermarket_zone (
  cadena text not null references supermarket_chain (slug),
  zona   text not null,
  primary key (cadena, zona)
);

-- Postcode as a first-class input: which zone a postcode falls in, per chain.
create table supermarket_zone_postcode (
  cadena        text not null,
  codigo_postal text not null,
  zona          text not null,
  primary key (cadena, codigo_postal),
  foreign key (cadena, zona) references supermarket_zone (cadena, zona)
);

-- Current price: one row per product and zone.
create table supermarket_price (
  producto_id   bigint not null references supermarket_product (id) on delete cascade,
  zona          text not null,
  precio_envase numeric(10, 2) not null check (precio_envase > 0),
  disponible    boolean not null,
  observado_en  timestamptz not null,
  primary key (producto_id, zona)
);

-- History: append only when the price or the availability changes.
create table supermarket_price_history (
  producto_id   bigint not null references supermarket_product (id) on delete cascade,
  zona          text not null,
  precio_envase numeric(10, 2) not null,
  disponible    boolean not null,
  observado_en  timestamptz not null,
  primary key (producto_id, zona, observado_en)
);

-- Matching cache: which products satisfy an ingredient (key from lib/grocery dictionary).
create table ingredient_product_match (
  ingrediente text not null,
  producto_id bigint not null references supermarket_product (id) on delete cascade,
  confianza   text not null check (confianza in ('alta', 'media', 'baja')),
  confirmado  boolean not null default false,
  creado_en   timestamptz not null default now(),
  primary key (ingrediente, producto_id)
);
```

**Access.** RLS on every table. `select` for `authenticated` (guests are anonymous-auth users, so they are included); there are no insert, update or delete policies, so only `service_role` writes, like the recipe catalog seeding (Flow 11). Reads go through a `SECURITY INVOKER` RPC with no identity parameter, per ADR-0032 and the RPC-authorization rule, so a price lookup never needs the caller's id.

**Postcode.** Fresco stores no postcode today. Capturing one (onboarding or profile) is a product decision with a privacy cost and is NOT assumed here: until it exists, a single default zone per chain is used.

## 6. Selective refresh

`planificarRefresco` (pure) decides what to fetch:

- Only products with demand (`demanda > 0`: how many active menu slots need them) and a stale price (older than `maxEdadPrecioHoras`, never observed, or an unparseable date).
- Most demanded first, then oldest.
- A hard cap of `maxPeticionesPorCadena` per run and a `pausaEntrePeticionesMs` between requests: small batches, the method the QuéFalta developer described for avoiding antibot blocks. Anything over the cap is reported as `aplazados`, not dropped.

Catalog (new products, pack changes) and price refresh get separate frequencies: price weekly or daily for demanded products, catalog monthly.

**Runner, open question.** Two options: a GitHub Actions job (what FRESCO-762 uses; needs the service key as a secret) or `pg_cron` + `pg_net` into an Edge Function (ADR-0011; the key stays in Supabase). FRESCO-760 showed GitHub-hosted runners reach 5 of 6 chains; Supabase Edge egress IPs are untested and may be blocked the same way. Probe it before choosing.

On `LimiteDeTasaError` the run waits and halves the batch; on `BloqueoError` it stops that chain for the run and records it. That runtime loop is described, not implemented, in this ticket.

## 7. Matching

`emparejarIngrediente` (pure, `matcher.ts`) lifts the heuristic of `scripts/gen-mercadona-catalog.ts` (FRESCO-503) onto the normalized contract, so every chain shares it:

1. Same unit family as the recipe portion; available; positive price.
2. Plausible pack: at most 20x the portion (rejects bulk SKUs).
3. The term must start a word. Terms are tried canonical first, then synonyms.
4. Ties: product starting with the term, then lowest price per kg/l/unit, then smaller pack, then external id (so the result never depends on input order).

Confidence is `alta` when the canonical term matched at the start of the name, `media` with one weakening, `baja` with two. `ingredienteParaMatching` adapts a FRESCO-488 dictionary entry; count-based portions (eggs, cloves) return `null`, the same scope the generators have.

## 8. Migration path from today (separate tickets)

1. Wrap the existing generated catalogs as two connectors (`mercadona`, `consum`) whose `buscarProductos` read the committed data. No behavior change.
2. Add `precios: PrecioNormalizado[]` to `MappedGroceryItem` next to the old fields; switch `estimate-menu-cost.ts` to read it.
3. Remove `precioMercadona`, `precioConsum`, `mercadonaUrl`, `consumUrl` and the per-chain conversion once nothing reads them.
4. Apply the schema as a real migration and move the refresh into the runner chosen in section 6.

## 9. Open questions

- Postcode capture (product and privacy decision).
- Runner: GitHub Actions or Edge Function, after probing Supabase egress.
- History retention: one row per change is small for a few thousand demanded products; revisit if it grows.
- How a user picks a chain (cheapest overall, a preferred chain, or a basket per chain): FRESCO-346's concern, not this layer's.
