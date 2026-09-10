# ADR-0027 — Supermarket integration and price comparison removed from the Out-of-Scope Blacklist

- **Status:** Accepted
- **Date:** 2026-09-10
- **Deciders:** Founder (Basi Montes)
- **Tags:** product-scope, roadmap, cross-cutting-invariant
- **Supersedes:** —
- **Superseded by:** —

---

## Context

`.context/business/business-model.md` and `.context/PRD/mvp-scope.md` carry an **Out-of-Scope Blacklist**: a set of features excluded not just from the MVP but from *all near-term roadmap consideration* until **both** MRR > €5,000 **and** 30-day retention > 50% are met. "Supermarket integrations" and "price comparison" are on that list. The founder brief called the price-comparison / pantry cluster "another product entirely". The documented moat is the perceived-learning loop (ADR-0001, EPIC-FRESCO-5), not grocery integration.

A feasibility spike ran against a real shopping list (`scripts/spikes/fresco-345-grocery-deeplink/`, 2026-09-10). Findings:

- No Spanish supermarket exposes a consumer "push my list to cart" API. Mercadona blocks automation; Carrefour and Dia expose only seller-side marketplace APIs.
- Per-item deep links are weak: Carrefour ignores the query param and 403s non-browser clients; Dia's search returns garbage for short terms ("tofu" → only "toffee") and nothing for niche items.
- A real one-click-to-cart needs a recipe-commerce provider (Northfork / Whisk) **with a live Spanish retailer** — a paid dependency (SaaS fee and/or per-transaction).
- 83% of a real list's items carry a non-retail unit (g, ml, dientes) a deep link cannot express.

The founder has set a standing hard constraint: **no extra spend**. That rules out the provider path. What remains buildable at zero cost is structured list export plus affiliate deep links (Awin — revenue-positive, free to join).

The AI's recorded recommendation was **not** to reverse the blacklist before the retention thesis is validated — the dev backlog is intentionally near-empty so founder time goes to the concierge-validation loop, and at zero budget the grocery line is a convenience feature plus a small revenue channel, not the moat. The founder considered this and decided to proceed anyway. This ADR records the decision and that context, the way EPIC-FRESCO-227 recorded the self-serve-payment reversal.

## Decision

We will **remove "supermarket integrations" and "price comparison" from the Out-of-Scope Blacklist**, effective now. Epic FRESCO-332 and its stories FRESCO-345 (list → supermarket) and FRESCO-346 (price comparison), plus their zero-cost enabling pieces (shopping-list export, the FRESCO-488 ingredient→product layer), move to the active backlog.

Bounded by the standing no-extra-spend constraint:

- **In scope now:** structured shopping-list export, affiliate deep links (Awin), and the FRESCO-488 mapping layer.
- **Still gated — on budget, not on the retention metric:** any recipe-commerce provider integration (Northfork / Whisk) or other paid dependency. Signing one requires a separate, explicit spend decision.

The rest of the blacklist is unchanged: receipt scanning, pantry/inventory, price learning, leftover-ingredient AI, batch-cooking, expiration alerts, native app before 1,000 paying users, B2B before B2C, and the others all remain out of scope under the same MRR/retention gate.

The moat invariant (ADR-0001) is unchanged: grocery integration is an added-value layer, never the Free/Pro boundary, and must not draw effort away from the learning loop during concierge validation.

## Consequences

- **Positive:** the grocery line has a clear, funded path (export + affiliate) that can ship as one small story; FRESCO-488 unblocks cleanly; the affiliate deep link is a revenue channel; the build/no-build ambiguity that stalled FRESCO-345 is resolved.
- **Negative / trade-offs:** the blacklist's core principle — "do not build expansion before the core thesis is validated" — is now partially breached while 30-day retention is still unmeasured. Founder time spent here is time not spent on the concierge cohort. The zero-cost version delivers convenience, not the one-click-to-cart experience users would call a differentiator, so it risks under-delivering on the "value add" framing. If validation later fails and the product pivots, this work may be stranded.
- **Neutral / follow-ups:**
  - Refine FRESCO-345 pieza A (export) and FRESCO-346 for build; keep FRESCO-488 first (it blocks both).
  - Register for Awin before the deep-link work starts.
  - Sequencing guard: these stories stay behind the concierge-validation work in priority order — unblocked, not prioritized.
  - Revisit if a provider deal (Northfork / Whisk) becomes free or rev-share only — that would reopen the one-click path without new spend.

## Alternatives considered

- **Keep the full blacklist; wait for the MRR/retention gate.** The AI's recommendation. Rejected by the founder: they want the grocery line as a differentiator now and judge the zero-cost version worth shipping ahead of the gate.
- **Narrow carve-out for FRESCO-488 only** (the prior state, 2026-09-10 earlier the same day). Superseded by this ADR: the founder extended the decision to the whole supermarket-integration and price-comparison line, not just the prerequisite.
- **Pay for a recipe-commerce provider now (Northfork / Whisk).** Rejected: violates the standing no-extra-spend constraint. Remains available as a separate future spend decision.

## References

- `.context/business/business-model.md` — Out-of-Scope Blacklist (carries the reversal note)
- `.context/PRD/mvp-scope.md` — Out of Scope (Blacklist) (carries the reversal note)
- `scripts/spikes/fresco-345-grocery-deeplink/` — feasibility spike + README
- Jira FRESCO-332 (epic), FRESCO-345, FRESCO-346, FRESCO-488
- ADR-0001 — Behavioral-learning moat as the Free/Pro pricing boundary (unchanged)
- EPIC-FRESCO-227 — prior founder-approved scope reversal (self-serve payment), the precedent for recording this one
