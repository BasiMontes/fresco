# Estimating prices for chains without data (FRESCO-1221)

Date of readings: 2026-11-17. Baseline: the Mercadona catalog in `lib/grocery/mercadona-catalog.generated.ts`, dated 2026-11-09.

## Verdict

Yes, for house-brand staples only. For Dia, Carrefour, Eroski, Alcampo and Ahorramas, a factor of 1.0 over Mercadona held within about +-5% on every comparable product, outside promotions. Lidl and Aldi cannot be measured from the web: neither sells groceries online (lidl.es is non-food; aldi.es states it has no online shop). Anything shown for them is an estimate with no observation behind it.

## What was measured

Public prices read through a search engine (snippets, no login, no circumvention). Ratio = chain unit price / Mercadona unit price. Promotions are marked and left out of the range.

| Product | Dia | Carrefour | Eroski | Alcampo | Ahorramas |
|---|---|---|---|---|---|
| Whole milk 1 L | 1.00 | 1.00 | n/a | 1.00 (promo) | n/a |
| Long-grain rice 1 kg | 1.00 | 1.00 | 1.00 | 1.00 | 0.91 (0.83 promo) |
| Grated cheese | 1.00 | 1.00 | 0.94 (other cheese) | 1.00 (promo) | n/a |
| Butter 250 g | 0.98 | 0.98 | 0.98 | n/a | 0.98 |
| Chicken breast fillets | 1.04 | 0.99 | 0.95 | n/a | n/a |

Average per chain on comparable items: Dia 1.01, Carrefour 0.99, Eroski 0.97. Alcampo and Ahorramas have too few points to average.

Four staples have an identical unit price in three chains (milk 0.96, rice 1.20, cheese 8.75, butter 8.20). Hypothesis, unverified: house-brand staples are priced in line with each other.

## Limits

- About 20 observations in total, mostly house brands and staples. Fresh produce, manufacturer brands and premium lines were not measured, and the gap is likely larger there.
- Prices come from search-engine copies, so date and delivery zone are uncertain.
- Promotions distort single points (Ahorramas rice, Alcampo milk and cheese).
- Garbanzos and pasta were dropped as not comparable. Garbanzos cooked cost 2.00 EUR/kg at Alcampo and Eroski against 3.22 EUR/kg in our Mercadona catalog, so that catalog match may point at a pricier product. Not verified: open its `shareUrl`.
- OCU publishes a chain price index, but its legal notice forbids reproducing, quoting or transforming its content. It was not used as a source and is not usable in the product.

## Recommendation

1. Show chain prices only where we have data (Mercadona, Consum).
2. For other chains, if a price is shown at all, label it as an estimate based on Mercadona for staples, never as the chain's own price. Do not extend it to fresh produce or brands.
3. Do not store prices read from these chains. They served only to validate the factor.
4. Lidl and Aldi: no estimate beyond the same labelled one, or none.

## Open decisions for the owner

- Whether a labelled estimate is acceptable in the product (FRESCO-340, FRESCO-1208). A competitor's wording ("estimating prices in Lidl") would be misleading if we copied it.
- The lawyer's opinion on database rights (FRESCO-790) still applies to any chain data we do store.
