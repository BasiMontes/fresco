/**
 * FRESCO-1020 / ADR-0064 — an ACTIVE recipe cannot be saved while its allergen or diet tags contradict its
 * own text. The trigger `recipes_tag_coherence` calls `recipe_tag_findings` (kept equal to the TypeScript
 * oracle by `recipe-tag-findings-parity.test.ts`) and rejects with SQLSTATE 23514, naming each broken rule.
 *
 * One attempt per rule, then the three ways a recipe becomes active (insert it active, edit an active one,
 * reactivate an inactive one), the draft that is allowed, and the write that must not fire the trigger.
 * That the whole current catalogue passes is `recipe-allergen-diet-coherence.test.ts` (no findings on any
 * active recipe) plus the parity test (the SQL function says the same).
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file (see `tests/db/README.md`).
 */

import { afterAll, describe, expect, test } from 'bun:test';
import { rest, stackReachable } from './harness';
import { oracleRules } from './recipe-tag-parity-cases';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const CHECK_VIOLATION = '23514';

interface Attempt {
  ingredientes: string[]
  pasos?: string[]
  alergenos?: string[]
  dieta?: Record<string, boolean>
}

/** One recipe per rule, the smallest text and tags that break exactly that rule. */
const RULES: Record<string, Attempt> = {
  'falta:lactosa': { ingredientes: ['queso'] },
  'falta:gluten': { ingredientes: ['pan'] },
  'falta:huevo': { ingredientes: ['huevos'] },
  'falta:pescado': { ingredientes: ['salmon'] },
  'falta:crustaceos': { ingredientes: ['gambas'] },
  'falta:moluscos': { ingredientes: ['calamares'] },
  'falta:soja': { ingredientes: ['tofu'] },
  'falta:sesamo': { ingredientes: ['tahini'] },
  'falta:cacahuetes': { ingredientes: ['cacahuetes'] },
  'falta:frutos_de_cascara': { ingredientes: ['almendras'] },
  'falta:apio': { ingredientes: ['apio'] },
  'falta:sulfitos': { ingredientes: ['vinagre'] },
  'falta:mostaza': { ingredientes: ['mostaza'] },
  'falta:altramuces': { ingredientes: ['altramuces'] },
  'dieta:sin_gluten': { ingredientes: ['agua'], alergenos: ['gluten'], dieta: { sin_gluten: true } },
  'dieta:sin_gluten_marca': { ingredientes: ['morcilla'], dieta: { sin_gluten: true } },
  'dieta:sin_lactosa': { ingredientes: ['agua'], alergenos: ['lactosa'], dieta: { sin_lactosa: true } },
  'dieta:sin_huevo': { ingredientes: ['agua'], alergenos: ['huevo'], dieta: { sin_huevo: true } },
  'dieta:halal': { ingredientes: ['cerdo'], dieta: { halal: true } },
  'dieta:kosher': { ingredientes: ['conejo'], dieta: { kosher: true } },
  'dieta:vegetariano': { ingredientes: ['pollo'], dieta: { vegetariano: true } },
  'dieta:vegano': { ingredientes: ['miel'], dieta: { vegano: true } },
  'dieta:keto': { ingredientes: ['patata'], dieta: { keto: true } },
  'dieta:paleo': { ingredientes: ['arroz'], dieta: { paleo: true } },
  'dieta:bajo_fodmap': { ingredientes: ['ajo'], dieta: { bajo_fodmap: true } },
  'dieta:caldo': { ingredientes: ['arroz'], pasos: ['Anadir el caldo'], alergenos: ['apio'], dieta: { vegetariano: true } },
};

const body = (name: string, attempt: Attempt, activo: boolean) => ({
  nombre: name,
  slug: name,
  ingredientes_principales: attempt.ingredientes,
  pasos_resumen: attempt.pasos ?? [],
  alergenos: attempt.alergenos ?? [],
  dieta: attempt.dieta ?? {},
  temporada: ['todo_el_ano'],
  activo,
});

describe.skipIf(!(RUN && reachable))('recipes_tag_coherence trigger (real DB)', () => {
  const created: string[] = [];

  async function insert(name: string, attempt: Attempt, activo: boolean) {
    const res = await rest('recipes', { method: 'POST', serviceRole: true, prefer: 'return=representation', body: body(name, attempt, activo) });
    const id = (res.body as { id?: string }[] | null)?.[0]?.id;
    if (id) { created.push(id); }
    return res;
  }

  const patch = async (id: string, changes: Record<string, unknown>) => rest('recipes', { method: 'PATCH', serviceRole: true, query: `id=eq.${id}`, body: changes });
  const slugOf = (label: string) => `fresco-1020-${label}-${crypto.randomUUID()}`;

  afterAll(async () => {
    // service_role has no DELETE on recipes: the throwaway rows are retired the way the catalogue does it.
    for (const id of created) { await patch(id, { activo: false }); }
  });

  test('every probe really breaks the rule it is named after (the oracle agrees)', () => {
    for (const [rule, attempt] of Object.entries(RULES)) {
      expect(oracleRules({ name: rule, alergenos: attempt.alergenos ?? [], dieta: attempt.dieta ?? {}, ingredientes: attempt.ingredientes, pasos: attempt.pasos ?? [] })).toContain(rule);
    }
  });

  test.each(Object.entries(RULES))('an active recipe that breaks %s is rejected and the error names the rule', async (rule, attempt) => {
    const name = slugOf('rule');
    const res = await insert(name, attempt, true);

    const error = res.body as { code?: string, message?: string };
    expect(res.status).toBe(400);
    expect(error.code).toBe(CHECK_VIOLATION);
    expect(error.message).toContain(name);
    expect(error.message).toContain(rule);
  });

  test('an inactive recipe is a draft: it saves with the same broken tags', async () => {
    expect((await insert(slugOf('draft'), RULES['falta:lactosa'], false)).status).toBe(201);
  });

  test('reactivating a draft whose tags are still broken is rejected', async () => {
    const draft = await insert(slugOf('reactivate'), RULES['falta:lactosa'], false);
    const id = (draft.body as { id: string }[])[0].id;

    const res = await patch(id, { activo: true });

    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe(CHECK_VIOLATION);
  });

  test('fixing the tags and reactivating in the same statement is accepted', async () => {
    const draft = await insert(slugOf('fix'), RULES['falta:lactosa'], false);
    const id = (draft.body as { id: string }[])[0].id;

    expect((await patch(id, { alergenos: ['lactosa'], activo: true })).status).toBeLessThan(300);
  });

  test('editing an active recipe so its tags no longer match its text is rejected', async () => {
    const ok = await insert(slugOf('edit'), { ingredientes: ['queso'], alergenos: ['lactosa'] }, true);
    const id = (ok.body as { id: string }[])[0].id;

    const res = await patch(id, { ingredientes_principales: ['queso', 'gambas'] });

    expect(res.status).toBe(400);
    expect((res.body as { message?: string }).message).toContain('falta:crustaceos');
  });

  test('a write that touches none of the columns the rules read does not fire the trigger', async () => {
    const ok = await insert(slugOf('counters'), { ingredientes: ['queso'], alergenos: ['lactosa'] }, true);
    const id = (ok.body as { id: string }[])[0].id;

    expect((await patch(id, { veces_cocinada: 3, foto_url: 'https://example.test/x.jpg' })).status).toBeLessThan(300);
  });
});
