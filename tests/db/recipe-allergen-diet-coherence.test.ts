/**
 * FRESCO-943 (audit 2026-10-12, C-02) + FRESCO-999 (audit 7b, A7-TEST-01) — the allergen and
 * diet tags of every ACTIVE recipe agree with its own ingredient list AND its steps. The
 * allergen filter is a plain tag comparison, so a recipe with "queso" and no `lactosa`, a pad
 * thai whose step says "salsa de soja" and no `soja`, or a wheat tortilla and `sin_gluten`
 * reaches the person who declared the allergy / the diet.
 *
 * Checked by the database the suite runs against, over the whole catalogue. The keyword
 * table, its explicit exceptions and the diet rules live in
 * `recipe-allergen-diet-rules.ts` (and are pinned without a stack by its unit test).
 *
 * The oracle still flags recipes whose data the follow-up cards fix, so the open findings sit
 * in `recipe-allergen-diet-known-gaps.ts` as a ratchet: a finding that is not listed fails (a
 * new defect), and a listed finding that no longer reproduces fails too (delete it, the card
 * fixed it). The same table runs strictly, with no list, against the hosted catalogue in
 * `scripts/check-hosted-recipe-tags.ts`.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file.
 */

import type { Finding, RecipeTags } from './recipe-allergen-diet-rules';
import { describe, expect, test } from 'bun:test';
import { restAll, stackReachable } from './harness';
import { KNOWN_GAPS } from './recipe-allergen-diet-known-gaps';
import { auditRecipeFindings } from './recipe-allergen-diet-rules';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface RecipeRow extends RecipeTags {
  activo: boolean
}

const isMissingTag = (finding: Finding) => finding.key.includes('|falta:');

describe.skipIf(!(RUN && reachable))('recipe allergen and diet tags vs ingredients and steps (real DB)', () => {
  async function findings() {
    const rows = await restAll<RecipeRow>('recipes', {
      serviceRole: true,
      select: 'slug,nombre,activo,alergenos,dieta,ingredientes_principales,pasos_resumen',
      order: 'id',
    });
    expect(rows.length).toBeGreaterThan(1000);
    return rows.filter(row => row.activo).flatMap(auditRecipeFindings);
  }

  /** Splits `found` against the ratchet list: what is new, and what the list still holds but no longer reproduces. */
  function againstKnownGaps(found: Finding[], subset: (key: string) => boolean) {
    const known = new Set(Object.values(KNOWN_GAPS).flat().filter(subset));
    const foundKeys = new Set(found.map(finding => finding.key));
    return {
      unexpected: found.filter(finding => !known.has(finding.key)).map(finding => finding.message),
      fixed: [...known].filter(key => !foundKeys.has(key)),
    };
  }

  test('every ingredient or step that is an allergen has its allergen tag', async () => {
    const { unexpected, fixed } = againstKnownGaps((await findings()).filter(isMissingTag), key => key.includes('|falta:'));

    expect(unexpected).toEqual([]);
    expect(fixed).toEqual([]);
  });

  test('the diet flags agree with the allergen tags, the ingredients and the steps', async () => {
    const { unexpected, fixed } = againstKnownGaps((await findings()).filter(finding => !isMissingTag(finding)), key => !key.includes('|falta:'));

    expect(unexpected).toEqual([]);
    expect(fixed).toEqual([]);
  });
});
