import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { getSlotSubstitutionContext } from './get-slot-substitution-context';

/** FRESCO-991 tranche 3 — resolves `?slot=` on `/recipes/[id]`; every miss degrades to "no substitution UI", never an error. */

function clientReturning(result: { data: unknown, error: unknown }) {
  const calls: { table?: string, id?: string } = {};
  const client = {
    from: (table: string) => {
      calls.table = table;
      return {
        select: () => ({
          eq: (_column: string, id: string) => {
            calls.id = id;
            return { maybeSingle: async () => result };
          },
        }),
      };
    },
  } as unknown as SupabaseClient<Database>;
  return { client, calls };
}

describe('getSlotSubstitutionContext', () => {
  let consoleError: ReturnType<typeof spyOn>;
  beforeEach(() => { consoleError = spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { consoleError.mockRestore(); });

  test('no slot id: nothing to resolve and no read', async () => {
    const { client, calls } = clientReturning({ data: null, error: null });

    expect(await getSlotSubstitutionContext(client, { slotId: undefined, recipeId: 'r1' })).toBeNull();
    expect(calls.table).toBeUndefined();
  });

  test('returns the substitution of a slot that belongs to this recipe', async () => {
    const sustitucion = { original: 'leche', sustituto: 'bebida de avena' };
    const { client, calls } = clientReturning({ data: { id: 's1', recipe_id: 'r1', sustitucion_ingrediente: sustitucion }, error: null });

    expect(await getSlotSubstitutionContext(client, { slotId: 's1', recipeId: 'r1' })).toEqual({ slotId: 's1', sustitucionIngrediente: sustitucion });
    expect(calls).toEqual({ table: 'meal_plan_recipes', id: 's1' });
  });

  test('a slot with no substitution keeps the slot id and a null substitution', async () => {
    const { client } = clientReturning({ data: { id: 's1', recipe_id: 'r1', sustitucion_ingrediente: null }, error: null });

    expect(await getSlotSubstitutionContext(client, { slotId: 's1', recipeId: 'r1' })).toEqual({ slotId: 's1', sustitucionIngrediente: null });
  });

  test('a slot of another recipe resolves to null', async () => {
    const { client } = clientReturning({ data: { id: 's1', recipe_id: 'other', sustitucion_ingrediente: null }, error: null });

    expect(await getSlotSubstitutionContext(client, { slotId: 's1', recipeId: 'r1' })).toBeNull();
  });

  test('a missing row (or one hidden by RLS) resolves to null without logging', async () => {
    const { client } = clientReturning({ data: null, error: null });

    expect(await getSlotSubstitutionContext(client, { slotId: 's1', recipeId: 'r1' })).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });

  test('a read error degrades to null and is logged', async () => {
    const { client } = clientReturning({ data: null, error: new Error('rls') });

    expect(await getSlotSubstitutionContext(client, { slotId: 's1', recipeId: 'r1' })).toBeNull();
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
