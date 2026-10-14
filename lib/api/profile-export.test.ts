import { describe, expect, test } from 'bun:test';
import { readUserDataForExport } from '@/lib/api/profile-export';
import { createMockClient } from '@/lib/fixtures/mock-supabase-client';

describe('readUserDataForExport', () => {
  test('reads the seven tables of that user, each filtered to that user only', async () => {
    const { client, callsOf } = createMockClient({ data: null });

    const exported = await readUserDataForExport(client, 'user-1');

    expect(callsOf('from')).toEqual([['user_profiles'], ['meal_plans'], ['shopping_lists'], ['recetas_propias'], ['favorites'], ['user_consents'], ['push_subscriptions']]);
    expect(callsOf('select')).toEqual([['*'], ['*, meal_plan_recipes(*)'], ['*'], ['*'], ['*'], ['*'], ['id, created_at, last_used_at, endpoint']]);
    expect(callsOf('eq')).toEqual([['id', 'user-1'], ['user_id', 'user-1'], ['user_id', 'user-1'], ['user_id', 'user-1'], ['user_id', 'user-1'], ['user_id', 'user-1'], ['user_id', 'user-1']]);
    expect(exported).toEqual({ profile: null, mealPlans: [], shoppingLists: [], recetasPropias: [], favorites: [], consents: [], pushSubscriptions: [] });
  });

  test('never selects the push encryption keys (FRESCO-910)', async () => {
    const { client, callsOf } = createMockClient({ data: null });

    await readUserDataForExport(client, 'user-1');

    const selected = callsOf('select').flat().join(' ');
    expect(selected).not.toContain('p256dh');
    expect(selected).not.toMatch(/\bauth\b/);
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
