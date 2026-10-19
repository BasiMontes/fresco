/**
 * FRESCO-999 — the open findings of the allergen/diet oracle, per card that owns the fix.
 *
 * `recipe-allergen-diet-rules.ts` reads the ingredient list AND the steps, and the catalogue
 * still has recipes it flags (audit 7b: 91 recipes with a wrong declaration). Failing the
 * suite on all of them at once would block every PR until the data cards land, so the
 * coherence test treats this list as a RATCHET:
 *
 *   - a finding that is NOT here fails the test (a new defect, or a regression);
 *   - a finding listed here that no longer reproduces fails the test too: the card that fixed
 *     the data deletes its entries, so the list can only shrink.
 *
 * Each key is `<recipe slug>|<rule>`. The hosted-catalogue job
 * (`scripts/check-hosted-recipe-tags.ts`) ignores this list on purpose and fails on any finding.
 */
export const KNOWN_GAPS: Record<string, string[]> = {};
