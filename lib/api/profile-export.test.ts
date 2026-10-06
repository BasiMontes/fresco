import { describe, expect, test } from 'bun:test';
import { readUserDataForExport } from '@/lib/api/profile-export';
import { createMockClient } from '@/lib/fixtures/mock-supabase-client';

describe('readUserDataForExport', () => {
  test('reads the four tables of that user with the same filters the route used', async () => {
    const { client, callsOf } = createMockClient({ data: null });

    const exported = await readUserDataForExport(client, 'user-1');

    expect(callsOf('from')).toEqual([['user_profiles'], ['meal_plans'], ['shopping_lists'], ['recetas_propias']]);
    expect(callsOf('select')).toEqual([['*'], ['*, meal_plan_recipes(*)'], ['*'], ['*']]);
    expect(callsOf('eq')).toEqual([['id', 'user-1'], ['user_id', 'user-1'], ['user_id', 'user-1'], ['user_id', 'user-1']]);
    expect(exported).toEqual({ profile: null, mealPlans: [], shoppingLists: [], recetasPropias: [] });
  });

  test('throws when any read fails, so the route answers 500', async () => {
    let error: unknown;
    try {
      await readUserDataForExport(createMockClient({ errorMessage: 'boom' }).client, 'user-1');
    }
    catch (caught) {
      error = caught;
    }

    expect(error).toBeDefined();
  });
});
