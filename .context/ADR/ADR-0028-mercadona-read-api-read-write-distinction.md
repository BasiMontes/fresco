# ADR-0028 — Mercadona catalog/price API: read is unblocked, production use is gated on a founder ToS decision

- **Status:** Proposed
- **Date:** 2026-09-16
- **Deciders:** Founder (Basi Montes) — pending sign-off on the gated item below
- **Tags:** product-scope, data-access, roadmap, cross-cutting-invariant, legal-risk
- **Supersedes:** —
- **Superseded by:** —

---

## Context

`ADR-0027` (2026-09-10) removed supermarket integration and price comparison
from the Out-of-Scope Blacklist, bounded to zero-cost work (export, affiliate
deep links, the FRESCO-488 mapping layer). It recorded, from the FRESCO-345
feasibility spike: **"Mercadona blocks automation."** That line was true only
for the one endpoint tested at the time — the cart-write API
(`POST /api/carts/`), which still requires auth and was never tested against
production for safety.

FRESCO-531 (2026-09-16) live-verified a **different** endpoint: Mercadona's
catalog/price read API (`GET /api/categories/`, `GET /api/categories/<id>/`)
is public, unauthenticated, and returns real, current shelf prices
(`price_instructions.unit_price` / `bulk_price` / `reference_price`) inline
with the product listing — no per-product call needed. A 10-request
sequential probe (0ms delay) returned zero 429/403 responses, ~110ms average.
Full findings: `scripts/spikes/fresco-531-mercadona-price-api/README.md`.

This closes exactly the gap ADR-0027 left open for FRESCO-346 (price
comparison): a real-price data source that needs no paid provider
(Northfork/Whisk) and respects the standing no-extra-spend constraint. It is
also, per the ticket's own risk note, **not obviously legitimate to depend
on**: it is an internal API not published for third-party use, read via an
endpoint that carries Akamai Bot Manager cookies (`_abck`, `bm_sz`) on every
response — evidence of active bot-detection infrastructure that returned no
block in this small test but could start blocking on volume, pattern, or
fingerprint without notice. A public GitHub scraper repo
(`datania/mercadona-catalog`) and a commercial scraping product (Apify
"Mercadona Price and Product Scraper API") both already depend on the same
endpoint, which is evidence it is viable at some scale, not evidence it is
sanctioned.

**Confirmed legal basis (2026-09-16, verified against the live page).** This
is not a generic gray zone — Mercadona's own Terms and Conditions
(`info.mercadona.es/es/terminos-y-condiciones`) state explicitly:

> "no se puede (salvo lo dispuesto en estas condiciones y la ley aplicable)
> modificar, copiar, reproducir, añadir o usar cualquier información o
> documentación del sitio **sin el consentimiento por escrito de Mercadona**"

Copying and displaying their catalog/price data inside Fresco is squarely
"usar información del sitio". Without Mercadona's written consent, this is a
direct breach of their stated IP terms, not an ambiguous automation question.
This raises the bar on the production-use gate below: the open item is not
"assess a vague ToS risk", it is "get Mercadona's written consent, or accept
knowingly operating against an explicit clause of their published terms".

## Decision

We record two things, at two different confidence levels:

1. **Technical finding (settled by this ADR):** Mercadona's catalog/price
   read endpoint is a distinct surface from the cart-write endpoint. Reading
   it does not violate the FRESCO-345/ADR-0027 "blocks automation" finding —
   that finding stands, unmodified, for writes only. `ADR-0027`'s body is
   not edited (ADRs are append-only); this ADR is the correction on record.
2. **Production-use gate (open, not decided here):** whether Fresco may
   actually depend on this undocumented, unauthenticated internal API in a
   shipped, user-facing feature is a business/legal/reputational call, not a
   technical one — exactly the risk the FRESCO-531 ticket itself flagged as
   "evaluar antes de construir". This ADR does **not** approve that. It gates
   it: no production code may call this endpoint outside of the spike script
   until the founder explicitly accepts this ADR (flips `Status` to
   `Accepted`) with the ToS/legal risk read and acknowledged.

## Consequences

- **Positive:** FRESCO-346 has a validated, zero-cost technical path once the
  gate opens. The spike fetcher (`scripts/spikes/fresco-531-mercadona-price-api/`)
  and its recommendation (cache in Supabase via a scheduled `pg_cron`/`pg_net`
  sync, per `ADR-0011`'s existing pattern — not a fetch-per-request) are ready
  to build against.
- **Negative / trade-offs:** the endpoint is unofficial and undocumented — no
  contract, no SLA, no deprecation notice if Mercadona changes or blocks it.
  Building a real feature on it carries the same "no extra spend, but real
  operational risk" trade Fresco already made for the affiliate-link path,
  except here the downside is a broken feature mid-flight, not a lost
  affiliate fee. If depended upon at volume and blocked, FRESCO-346 has no
  fallback data source without paying for one (Northfork/Whisk).
- **Neutral / follow-ups:**
  - **Third path added (2026-09-16): request Mercadona's written consent
    directly**, per their own clause's carve-out ("salvo lo dispuesto en
    estas condiciones y la ley aplicable"). A written reply (email counts —
    Spanish law does not require a notarized form for this) from an
    accountable contact at Mercadona, scoped to "read catalog/price data,
    display it in Fresco, no resale, no cart/checkout", would resolve the
    gate cleanly without waiting on a paid provider. Absence of a reply is
    not consent — do not proceed on silence. If pursued, target Mercadona's
    corporate/legal or IT contact (`info.mercadona.es` → Conócenos /
    Mercadona IT), not generic customer service, which has no authority to
    grant this.
  - Founder reads this ADR and the spike README, then picks one of three:
    (a) request written consent from Mercadona (above) — cleanest, adds
    lead time; (b) accept this ADR and proceed on the current risk read
    without consent (production build on Mercadona read data may proceed
    under FRESCO-346); (c) reject it (FRESCO-346 stays scoped to what
    ADR-0027 already allowed: export + affiliate, no real price shown).
  - Carrefour/Dia/Alcampo were not verified this spike (blind endpoint
    guesses all failed, as expected — a real check needs a headed-browser
    devtools trace, the same method that found the Bonpreu/Mercadona
    endpoints in the FRESCO-518 spike). Track as separate follow-up spike
    work, not a blocker on the Mercadona-only decision here.
  - If accepted: FRESCO-488 (ingredient -> product mapping) remains the real
    prerequisite before FRESCO-346 can show a price against a specific
    recipe ingredient — this ADR unblocks the data source, not the mapping.

## Alternatives considered

- **Fold this into `ADR-0027` by editing it.** Rejected: ADRs are
  append-only once Accepted (`.context/ADR/README.md`); the correct move is
  a new ADR that supersedes the specific claim, not a rewrite.
- **Treat the technical feasibility as sufficient and build straight into
  production.** Rejected: the ticket that found this endpoint explicitly
  flagged the ToS/legal-gray-zone risk as something to evaluate "before
  depending on this in production, especially at volume" — building past
  that note without a founder decision would be deciding a business/legal
  call unilaterally.
- **Wait for a paid recipe-commerce provider (Northfork/Whisk) instead.**
  Still available, still gated on budget per `ADR-0027`. Not rejected, just
  not preferred while a zero-cost technical path exists and is unevaluated.

## References

- `ADR-0027` — supermarket integration scope decision (the "blocks
  automation" line this ADR narrows to writes only)
- `ADR-0011` — `pg_cron` + `pg_net` scheduled HTTP triggers (the pattern the
  recommended Supabase-cache sync would reuse)
- `scripts/spikes/fresco-531-mercadona-price-api/README.md` — full findings,
  rate-limit probe data, recommendation
- Jira FRESCO-531 (this spike), FRESCO-346 (price comparator, the consumer),
  FRESCO-488 (ingredient -> product mapping, still the prerequisite),
  FRESCO-518/519 (cart-write spike, stays closed, unaffected)
