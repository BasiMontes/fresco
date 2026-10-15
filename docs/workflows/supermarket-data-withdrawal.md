# Withdrawing a supermarket's data (Mercadona, Consum)

How to take a chain's prices and links out of Fresco within hours, and what each switch really controls (FRESCO-921, audit C-19). Mercadona (ADR-0028) and Consum (ADR-0037) run under `riesgo-aceptado`: a decision of the founder, not a permission. This runbook is what makes that decision reversible.

## When to use it

Any of these, for any chain:

- the chain answers no, asks us to stop, or blocks the connector or the dataset;
- the lawyer's opinion on database rights (FRESCO-790; consent requests FRESCO-532 and FRESCO-764) is negative;
- a legal notice or a complaint arrives.

The founder decides; the decision is recorded by superseding the chain's ADR (step 5). A lawyer's opinion is required **before the public launch**: accepting the risk now does not waive it.

## The two switches, and what each one controls

This is the part that is easy to get wrong. There are two layers, and they do not do the same thing.

| Switch | Where | Controls | Needs a deploy |
|---|---|---|---|
| **Code**: the chain's connector in `registroSupermercados` | `lib/grocery/supermarket/registry.ts` (or `permiso: 'rechazado'` in `catalog-connectors.ts`) | **What shoppers see**: prices and links on the shopping list, the weekly cost estimate and the savings cards. They all read through `preciosNormalizados`, from the committed generated catalogs (`lib/grocery/<chain>-catalog.generated.ts`). | Yes |
| **Database**: `supermarket_chain.habilitada` | the shared Supabase project | The database price layer (ADR-0036): the `refresh-supermarket-prices` runner skips a chain that is not enabled, and the row-level policies and `get_supermarket_prices` hide that chain's rows, even though they stay stored. | No, takes effect at once |

**Checked on 2026-10-14:** nothing in the shopper path reads the database prices yet. The only code that touches the supermarket tables is `lib/grocery/supermarket/price-store.ts`, which the refresh runner uses with the service role. So **setting `habilitada = false` alone retires nothing a shopper sees.** Withdrawal needs the code switch; the database switch stops the pipeline and closes the data layer so it cannot start showing the chain later by accident.

State on 2026-10-14, read from the shared database: `mercadona` and `consum` are `habilitada = true`; `alcampo` and `dia` are `false` (`pendiente`).

## Withdrawal procedure

Do 1 and 2 together. Everything under "Immediate" is reversible.

### Immediate

1. **Close the database layer** (minutes, no deploy). With the CLI, which is the working path while the Supabase MCP is down:

   ```bash
   supabase db query --linked "update public.supermarket_chain set habilitada = false where slug in ('consum')"
   supabase db query --linked "select slug, habilitada, permiso from public.supermarket_chain order by slug"
   ```

   Replace the slug list with the chain(s) being withdrawn. The second query is the proof: the chain shows `habilitada = false`. This is a write to the shared project, which every environment reads: there is no staging-only version of it.

2. **Remove it from what shoppers see** (one line, then a deploy). Delete the chain's connector from the array in `lib/grocery/supermarket/registry.ts`, or set its `permiso` to `'rechazado'` in `catalog-connectors.ts`. Both are proved by `map-item.test.ts` (see "What is tested"). Then ship it:
   - normal: PR to `staging`, wait for its `PR Check`, then `bun run git:promote` (`docs/workflows/promotion.md`);
   - true emergency: the fast path of `docs/workflows/hotfix.md` section 2, step 4b.

3. **Verify**:
   - `bun test lib/grocery/map-item.test.ts` passes on the change;
   - after the deploy, `https://fresco-pro.vercel.app/api/health` answers `ok` and a signed-in person opens `/shopping-list`: no link and no price of that chain, and the sentence under the summary no longer names it (it is built from the data).

### Afterwards, not urgent

4. **Purge the data**, only once the withdrawal is final. Prices, history and matches go with the product (`on delete cascade`); zones do not, so delete in this order. The chain's own row stays, switched off, so the history of the decision survives:

   ```sql
   delete from public.supermarket_product where cadena = 'consum';
   delete from public.supermarket_zone_postcode where cadena = 'consum';
   delete from public.supermarket_zone where cadena = 'consum';
   update public.supermarket_chain set permiso = 'rechazado', habilitada = false where slug = 'consum';
   ```

   Do not delete the generated catalog file before this decision is final: the committed catalogs are the only source for reloading the database (`refresh-supermarket-prices` with `cargar_catalogos`).
5. **Record it**: mark the chain's ADR superseded (ADR-0028 for Mercadona, ADR-0037 for Consum), then delete `lib/grocery/<chain>-catalog.generated.ts` and the generator that feeds it (`scripts/gen-consum-catalog.ts`; for Mercadona the dataset loader and `.github/workflows/refresh-mercadona-catalog.yml`).
6. **Terms of Service**: the section "Precios y enlaces de supermercados" in `components/legal/legal-content-data.ts` names no chain, so withdrawing one needs no text change. If the **last** chain goes, remove or reword the section and bump the legal texts version.

## How long it takes

Measured on 2026-10-14, not estimated: <!-- volatile-ok: dated measurement, stamped on purpose -->

| Step | Time |
|---|---|
| Database switch | seconds |
| `PR Check` on the `staging` merge (its `test:e2e` job is the long one, 5 min 48 s) | about 7 minutes |
| `git:promote` (gate, tests, push) | about 1.5 minutes |
| Production serving the new build after the push | about 2 minutes |

From the decision to the chain gone from production: **about 15 to 20 minutes** by the normal path, with the database already closed in the first minutes. The hotfix path skips the `PR Check` wait.

## If it was withdrawn by mistake

Reverse step 1 (`habilitada = true`) and revert the commit of step 2. If the data was purged (step 4), reload it from the committed catalogs with the `refresh-supermarket-prices` workflow (`cargar_catalogos`), which needs the generated files still in the repo.

## What is tested, and what is not

- **Code switch**: `lib/grocery/map-item.test.ts`, "Consum kill-switch (ADR-0037)": with the connector removed, or kept with `permiso: 'rechazado'`, no price and no link reach the shopper.
- **Database switch**: `tests/db/supermarket-price-model.test.ts`, against the real local stack: a chain switched off hides its rows from a direct read even though they stay stored, and `get_supermarket_prices` never returns a pending or switched-off chain.
- **Not done: a live drill.** There is one shared database for every environment, so flipping `habilitada` in "staging" would flip it in production, and checking the result needs a signed-in session that automation cannot get (Turnstile). The timings above come from the real promotion of 2026-10-14, and the two switches from the tests. A live flip of a chain, with a person watching `/shopping-list`, would be a decision for the founder.

## Related

- ADR-0028 (Mercadona), ADR-0036 (the data layer and the legal gate), ADR-0037 (Consum).
- `docs/workflows/promotion.md`, `docs/workflows/hotfix.md`.
