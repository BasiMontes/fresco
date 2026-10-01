# ADR-0036 — Supermarket price data: a source-agnostic connector contract and a Postgres price model

- **Status:** Accepted (2026-10-01, founder)
- **Date:** 2026-10-01
- **Deciders:** Founder (Basi Montes)
- **Tags:** data-model, integrations, cross-cutting-invariant, legal-risk
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Fresco already shows real supermarket prices, but through one hard-coded field family per chain: `precioMercadona` and `mercadonaUrl` (FRESCO-503), `precioConsum` and `consumUrl` (FRESCO-520). The two prices do not even mean the same thing: Mercadona's is per reference unit, Consum's is per whole pack. The data is a generated file committed to git, refreshed weekly (FRESCO-762). There is no store or zone, no history, no freshness, and the legal state of each chain (ADR-0028, FRESCO-764/765/766) lives in documents, not where the code runs.

Which chains Fresco can use is undecided and may stay so for weeks: Mercadona is `riesgo-aceptado` under ADR-0028, and Consum, Dia and Alcampo have consent requests pending. The next sources may be an affiliate feed (FRESCO-753), a community dataset, or a storefront API. The design must let a source be connected or dropped at no cost.

## Decision

We will:

1. **Normalize every source into one product contract** (`ProductoSupermercado`) with one invariant: `precioEnvase` is ALWAYS the price of the whole pack. A connector converts a per-reference-unit price or drops the product; no consumer ever sees the difference. Adding a chain adds a connector, never a field.
2. **Put the legal gate in code.** Every connector declares `permiso` (`concedido`, `riesgo-aceptado`, `pendiente`, `rechazado`) and a `permisoRef` citing the ADR or card that justifies it. The registry runs only `concedido` and `riesgo-aceptado`, and is fail-closed: a runnable state with an empty reference, or an unexpected value, does not run.
3. **Store price data in Postgres** (chain, product, current price per zone, price history, ingredient-product matches, postcode-to-zone), readable by `authenticated` and written only by `service_role`, read through a `SECURITY INVOKER` RPC with no identity parameter (ADR-0032). The exact schema is in `.context/design/supermarket-data-layer.md` §5 and is NOT a migration yet.
4. **Refresh only what menus need,** in small budgeted batches per chain, with a hard cap and a pause between requests.
5. **Share one matching heuristic** across chains (same unit family, plausible pack against the recipe portion, whole-word term, canonical before synonyms, deterministic ties).

The invariants every feature must uphold: a price is a whole-pack price; a connector that is not permitted does not run; nothing in this layer calls a real chain without a registered, permitted connector.

## Consequences

- **Positive:** a chain can be added, swapped or dropped without touching consumers; two chains are comparable by construction; the legal state is enforced where it matters instead of remembered; tests and development need no real supermarket.
- **Negative / trade-offs:** the schema is a commitment (tables, the RPC surface, the zone model) that is costly to change once data accumulates; during the migration there are two sources of truth (generated files and the database); a refresh runner is one more thing to operate and monitor; the contract can only express what every chain can provide, so a chain-specific extra needs a contract change.
- **Neutral / follow-ups:** the migration path is four separate tickets (design §8). Postcode capture is a product and privacy decision not taken here. The runner (GitHub Actions or Edge Function) depends on probing Supabase egress against the chains. This ADR enforces permission technically; it does not decide whether a chain's terms allow the use, which stays a founder decision per chain.

## Alternatives considered

- **Keep generated files, one per chain (the current approach).** Fine for one or two chains and zero infrastructure, and it is what FRESCO-762 does today. Rejected as the long-term model: no zones, no history, no freshness, and each chain multiplies the types and the consumers.
- **Per-chain tables.** Rejected: every consumer would have to know every chain, which is the problem this ADR removes.
- **Store prices as `jsonb` on the ingredient dictionary.** Rejected: loses the product as a unit, makes history and zone queries awkward, and bakes the Mercadona and Consum shape back in.
- **A paid recipe-commerce provider (Northfork, Whisk).** Excluded by ADR-0027 (no extra spend). Remains a future connector behind the same contract.

## References

- `.context/design/supermarket-data-layer.md` — the full proposal and the SQL
- `lib/grocery/supermarket/` — the contract, registry, matcher and refresh plan, tested with synthetic fixtures
- ADR-0027 (supermarket scope, no extra spend), ADR-0028 (Mercadona read API and its gate), ADR-0011 (`pg_cron` + `pg_net`), ADR-0032 (`SECURITY INVOKER` RPC with no identity parameter)
- Jira FRESCO-752, FRESCO-747 (research), FRESCO-760 (runner reachability), FRESCO-762 (weekly Mercadona refresh), FRESCO-764/765/766 (consent tracking), FRESCO-488 (ingredient to product mapping)
