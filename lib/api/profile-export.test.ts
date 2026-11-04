import { describe, expect, test } from 'bun:test';
import { readUserDataForExport } from '@/lib/api/profile-export';
import { createMockClient } from '@/lib/fixtures/mock-supabase-client';

describe('readUserDataForExport', () => {
  test('reads the eight tables of that user, each filtered to that user only', async () => {
    const { client, callsOf } = createMockClient({ data: null });

    const { client: feedbackClient, callsOf: feedbackCallsOf } = createMockClient({ data: null });

    const exported = await readUserDataForExport({ client, feedbackClient }, 'user-1');

    expect(callsOf('from')).toEqual([['user_profiles'], ['meal_plans'], ['shopping_lists'], ['recetas_propias'], ['favorites'], ['user_consents'], ['push_subscriptions']]);
    expect(callsOf('select')).toEqual([['*'], ['*, meal_plan_recipes(*)'], ['*'], ['*'], ['*'], ['*'], ['id, created_at, last_used_at, endpoint']]);
    expect(callsOf('eq')).toEqual([['id', 'user-1'], ['user_id', 'user-1'], ['user_id', 'user-1'], ['user_id', 'user-1'], ['user_id', 'user-1'], ['user_id', 'user-1'], ['user_id', 'user-1']]);
    expect(exported).toEqual({ profile: null, mealPlans: [], shoppingLists: [], recetasPropias: [], favorites: [], consents: [], pushSubscriptions: [], recipeFeedback: [] });
    // FRESCO-1109 (A8-PRIV-02): the cooked / discarded marks, through the privileged client, one user only.
    expect(feedbackCallsOf('from')).toEqual([['recipe_user_feedback']]);
    expect(feedbackCallsOf('eq')).toEqual([['user_id', 'user-1']]);
  });

  test('returns the cooked / discarded marks of the user (FRESCO-1109)', async () => {
    const { client } = createMockClient({ data: null });
    const marks = [{ recipe_id: 'r_1', cocinada_at: '2026-11-01T10:00:00Z', descartada_at: null }];
    const { client: feedbackClient } = createMockClient({ data: marks });

    const exported = await readUserDataForExport({ client, feedbackClient }, 'user-1');

    expect(exported.recipeFeedback).toEqual(marks);
  });

  test('never selects the push encryption keys (FRESCO-910)', async () => {
    const { client, callsOf } = createMockClient({ data: null });

    await readUserDataForExport({ client, feedbackClient: client }, 'user-1');

    const selected = callsOf('select').flat().join(' ');
    expect(selected).not.toContain('p256dh');
    expect(selected).not.toMatch(/\bauth\b/);
  });

  test('throws when any read fails, so the route answers 500', async () => {
    let error: unknown;
    try {
      await readUserDataForExport({ client: createMockClient({ errorMessage: 'boom' }).client, feedbackClient: createMockClient({ data: null }).client }, 'user-1');
    }
    catch (caught) {
      error = caught;
    }

    expect(error).toBeDefined();
  });
});
