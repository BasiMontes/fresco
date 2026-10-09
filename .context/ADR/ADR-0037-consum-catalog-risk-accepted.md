# ADR-0037 — Consum catalog and prices: run the connector under accepted risk while the consent request is unanswered

- **Status:** Accepted (2026-10-01, founder)
- **Date:** 2026-10-01
- **Deciders:** Founder (Basi Montes)
- **Tags:** product-scope, data-access, legal-risk, supermarket-data-layer
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Fresco already shows Consum prices in the shopping list (FRESCO-520). The data is a generated file, `lib/grocery/consum-catalog.generated.ts`, built by `scripts/gen-consum-catalog.ts` from Consum's public, unauthenticated storefront API (`tienda.consum.es/api/rest/V1.0/catalog/product`). The generator runs by hand, caches locally, and nothing on the request path calls Consum.

`ADR-0036` makes the legal state of each chain executable: the connector registry only runs a connector whose `permiso` is `concedido` or `riesgo-aceptado`, with a reference to the document that justifies it. `ADR-0028` gives Mercadona `riesgo-aceptado` and explicitly says it does NOT extend to other chains.

Consum is `pendiente`. A written consent request was sent on 2026-09-29 with a one-week deadline (FRESCO-764). There is no reply, and silence is not consent.

FRESCO-767 wrapped both catalogs as connectors and registered only Mercadona. FRESCO-768 fills `MappedGroceryItem.precios` through the registry, so Consum items carry `precios: []` and still show their price through the old fields. FRESCO-769 removes those old fields. Without a decision, that step makes Consum prices disappear from the shopping list.

**Consum's own terms.** The legal notice (`consum.es/condiciones-de-uso`, read from a search excerpt on 2026-10-01, not end to end) says no section of the site may be "reproducido, distribuido, transmitido, copiado, comunicado públicamente ni transformado, en todo o en parte [...] sin consentimiento de CONSUM", and that using any part of the content "queda sujeta a la necesidad de solicitar autorización previa de CONSUM". As with Mercadona, copying and displaying their catalog and prices inside Fresco falls inside that clause, so without their consent this is knowingly operating against a stated term, not an ambiguous automation question.

**How this differs from Mercadona.** Mercadona's weekly refresh reads a community dataset (`datania/mercadona-catalog`) and adds no requests to Mercadona (FRESCO-762). Consum's generator calls Consum's storefront API directly, one search per canonical ingredient. The exposure is therefore larger than Mercadona's, even though the volume is small and the run is manual.

## Decision

We will run the Consum connector under `riesgo-aceptado`, citing this ADR as `permisoRef`, and register it in `registroSupermercados`. The scope is the same as `ADR-0028`:

1. Read catalog and price data only, shown to the shopper inside Fresco. No resale, no cart or checkout, no account use.
2. The data stays in the committed generated catalog. Nothing on the request path calls Consum. Any new code that calls Consum's endpoints (for example the runner of FRESCO-770) needs this ADR's risk read again and must keep batches small.
3. The risk is accepted knowingly, not resolved. The consent request stays open.

**Revocation.** If Consum answers no, asks us to stop, or blocks the generator, the connector goes to `rechazado` (or is removed from the registry), the Consum fields stop being shown, and this ADR is superseded. Revocation is one line in `registry.ts` plus dropping the generated file.

**Not covered.** Other chains (Dia, Alcampo, Carrefour). Each needs its own reading of its terms (FRESCO-763, FRESCO-765, FRESCO-766).

## Consequences

- **Positive:** FRESCO-769 can remove the per-chain fields without taking Consum prices off the shopping list. The permission gate keeps working as designed: Consum runs because a document says so, not because the code skipped the gate.
- **Negative / trade-offs:** Fresco knowingly uses data against a clause of Consum's terms, with no contract and no notice if Consum changes or blocks the API. A cooperative with a local brand may react more visibly than a large chain to a small app. If the generator is blocked, Consum prices go stale or disappear, and there is no fallback source.
- **Neutral / follow-ups:**
  - A written reply from Consum (an email counts) scoped to "read catalog and price data, display it in Fresco, no resale, no cart" would turn `riesgo-aceptado` into `concedido` and make this ADR obsolete.
  - Re-read Consum's full legal notice before accepting; this draft quotes it from a search excerpt.
  - The `permiso` of the registered connector changes from `pendiente` to `riesgo-aceptado` with `permisoRef: 'ADR-0037'` once this ADR is Accepted.

## Update 2026-10-06 (FRESCO-790): terms read end to end, kill-switch proved

The Decision above is unchanged and stays `riesgo-aceptado`. What this update adds:

- **Consum's terms, read end to end.** The full page `consum.es/condiciones-de-uso` was extracted and read on 2026-10-06 (about 68,000 characters), not from a search excerpt. The clause the ADR relied on is confirmed word for word: no section of the site may be "reproducido, distribuido, transmitido, copiado, comunicado públicamente ni transformado, en todo o en parte [...] sin consentimiento de CONSUM", and any use "queda sujeta a la necesidad de solicitar autorización previa de CONSUM y/o terceros titulares legítimos". Nothing softens it.
- **What the terms do not say.** They say nothing about automated access, robots or scraping, nothing about third-party use of catalog data, and nothing that disclaims price accuracy. Section 6 says the prices shown are PVP with VAT included and that Consum guarantees, to its own online customers, the price of the day the order was placed. So a price shown in Fresco on a later day can differ from the one Consum would charge, which is why the shopping list now says the prices are indicative.
- **Links.** The legal notice has a "HIPERENLACES" section: links to consum.es are authorized only under conditions listed there, and any other link "requerirá de la autorización escrita de CONSUM". The list of conditions did not survive the page extraction, so it is NOT verified whether our deep links to `tienda.consum.es` product pages meet them. They are covered by this same accepted risk and by the same revocation.
- **Kill-switch.** The revocation described above is now a tested procedure, documented in `lib/grocery/supermarket/registry.ts`: delete the connector from the array and no price and no link reach the shopper (shopping list, weekly cost, savings cards). `lib/grocery/map-item.test.ts` ("Consum kill-switch (ADR-0037)") covers removal, `permiso: 'rechazado'`, a missing `permisoRef`, and Mercadona staying untouched.
- **Shown to the user.** The shopping-list summary says the prices are indicative, names the chains that priced a row and points to the date on each item; the Terms of Service have a section "Precios y enlaces de supermercados" that says the same without naming any chain.
- **Still open.** No reply from Consum to the 2026-09-29 request (FRESCO-764, deadline about 2026-10-06). The lawyer's opinion on database rights, or a dated decision to keep accepting the risk, is still pending (FRESCO-790).

## Update 2026-10-09 (FRESCO-790): risk acceptance dated, review scheduled

The founder decided on 2026-10-09 to keep accepting the risk instead of commissioning the lawyer's opinion now. The Decision stays `riesgo-aceptado`; this update only gives it an owner, a date and a condition.

- **Decision.** Keep showing Consum prices and links under `riesgo-aceptado`, with the indicative-prices clause visible on `/shopping-list` and in the Terms.
- **Review date.** 2026-11-06, or earlier if Consum answers the 2026-09-29 request (FRESCO-764) or sends any objection.
- **Condition for public launch.** A lawyer's opinion on database rights is required BEFORE the public launch. Accepting the risk now does not waive it.
- **Revocation.** Unchanged: delete the connector from the array in `lib/grocery/supermarket/registry.ts`. Tested in `lib/grocery/map-item.test.ts` ("Consum kill-switch (ADR-0037)").
- **Still blocked.** FRESCO-772 (live Consum connector) does not start until Consum answers.

## Alternatives considered

- **Keep Consum out of the registry and drop its prices at step 3.** Safest legally and fully reversible, but removes a price the app shows today and weakens the "real prices" promise for users near a Consum store.
- **Wait for Consum's reply before step 3.** Cleanest, and the deadline is about 2026-10-06, but it blocks the series on a third party that may never answer, and silence is not consent.
- **Switch to a community dataset like Mercadona's.** Lowers direct exposure, but no equivalent Consum dataset is known, and it would not change the clause on reproducing the content.

## References

- `ADR-0028` — Mercadona: same risk decision, same scope, and the "other chains are not covered" line.
- `ADR-0036` — source-agnostic supermarket data layer and the permission gate.
- `.context/design/supermarket-data-layer.md` §8 — migration path (steps 1 to 4).
- `scripts/gen-consum-catalog.ts`, `lib/grocery/consum-catalog.generated.ts` — how the data is obtained.
- Jira FRESCO-764 (consent request), FRESCO-767 and FRESCO-768 (connectors and normalized prices), FRESCO-769 (removal of per-chain fields), FRESCO-520 (Consum prices).
- `consum.es/condiciones-de-uso` — Consum's legal notice, consulted 2026-10-01.
