import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { createMockClient } from '@/lib/fixtures/mock-supabase-client';

/**
 * FRESCO-810 (ADR-0041): each `lib/client-api` function must hand the
 * browser's Supabase client to the real `lib/api` function it wraps. The
 * client is faked at the one place the wrappers create it, and the real
 * `lib/api` code runs on top, so what is asserted is the table / RPC that
 * actually gets hit and the arguments that reach it, not a stub.
 */

let fake = createMockClient({ userId: 'user-1' });

void mock.module('@/lib/supabase/client', () => ({ createClient: () => fake.client }));

const { addFavorite, removeFavorite } = await import('@/lib/client-api/favorites');
const { searchCatalogRecipes } = await import('@/lib/client-api/admin-recipes');
const { flushPendingConsents } = await import('@/lib/client-api/consents');
const { copyMealPlanToCurrentWeek, deleteMealPlan, swapMealPlanSlots } = await import('@/lib/client-api/meal-plan');
const { createRecetaPropia, deleteRecetaPropia } = await import('@/lib/client-api/recipes');
const { addShoppingListItem, clearComprados, toggleShoppingListItem } = await import('@/lib/client-api/shopping-list');
const { confirmSubstitution, getSafeSubstitutes } = await import('@/lib/client-api/substitutions');
const { getPlanTierForAnalytics, markRoutesNoticeDismissed, updateNombre, upsertUserProfile } = await import('@/lib/client-api/user-profile');

beforeEach(() => {
  fake = createMockClient({ userId: 'user-1' });
});

describe('favorites', () => {
  test('addFavorite inserts the favorite for the signed-in user', async () => {
    await addFavorite({ recipeId: 'recipe-1' });

    expect(fake.callsOf('from')).toEqual([['favorites']]);
    expect(fake.callsOf('insert')).toEqual([[{ user_id: 'user-1', recipe_id: 'recipe-1' }]]);
  });

  test('removeFavorite deletes from the favorites table', async () => {
    await removeFavorite({ recipeId: 'recipe-1' });

    expect(fake.callsOf('from')).toEqual([['favorites']]);
    expect(fake.callsOf('delete')).toHaveLength(1);
  });
});

describe('own recipes', () => {
  test('createRecetaPropia inserts into recetas_propias owned by the signed-in user', async () => {
    fake = createMockClient({ userId: 'user-1', data: { id: 'r-1' } });

    await createRecetaPropia({ nombre: 'Tortilla', ingredientes: ['huevo'], pasos: ['batir'] });

    expect(fake.callsOf('from')).toEqual([['recetas_propias']]);
    expect(fake.callsOf('insert')).toEqual([[{ user_id: 'user-1', nombre: 'Tortilla', ingredientes: ['huevo'], pasos: ['batir'] }]]);
  });

  test('deleteRecetaPropia deletes by id AND owner', async () => {
    fake = createMockClient({ userId: 'user-1', data: [{ id: 'r-1' }] });

    await deleteRecetaPropia('r-1');

    expect(fake.callsOf('from')).toEqual([['recetas_propias']]);
    expect(fake.callsOf('eq')).toEqual([['id', 'r-1'], ['user_id', 'user-1']]);
  });
});

describe('ingredient substitutions', () => {
  test('getSafeSubstitutes calls the safe-substitutes RPC', async () => {
    fake = createMockClient({ userId: 'user-1', data: [] });

    await getSafeSubstitutes('leche');

    expect(fake.callsOf('rpc')[0]?.[0]).toBe('get_safe_ingredient_substitutes');
  });

  test('confirmSubstitution calls the confirm RPC', async () => {
    await confirmSubstitution({ slotId: 'slot-1', ingredienteOriginal: 'leche', ingredienteSustituto: 'avena' });

    expect(fake.callsOf('rpc')[0]?.[0]).toBe('confirm_ingredient_substitution');
  });
});

describe('user profile', () => {
  test('updateNombre writes the trimmed name onto the signed-in user profile', async () => {
    await updateNombre('Laura');

    expect(fake.callsOf('from')).toEqual([['user_profiles']]);
    expect(fake.callsOf('update')).toEqual([[{ nombre: 'Laura' }]]);
    expect(fake.callsOf('eq')).toEqual([['id', 'user-1']]);
  });

  test('upsertUserProfile upserts the profile keyed by the signed-in user', async () => {
    const profile = {
      num_personas: 2,
      adultos: 2,
      ninos: 0,
      dieta_vegetariano: false,
      dieta_vegano: false,
      dieta_sin_gluten: false,
      dieta_sin_lactosa: false,
      dieta_sin_huevo: false,
      dieta_keto: false,
      dieta_halal: false,
      alergenos: [],
      ingredientes_odiados: [],
      cocinas_favoritas: [],
    };

    await upsertUserProfile(profile);

    expect(fake.callsOf('from')).toEqual([['user_profiles']]);
    expect(fake.callsOf('upsert')).toEqual([[{ id: 'user-1', ...profile }]]);
  });
});

describe('meal plans', () => {
  test('deleteMealPlan deletes by id AND owner', async () => {
    await deleteMealPlan('plan-1');

    expect(fake.callsOf('from')).toEqual([['meal_plans']]);
    expect(fake.callsOf('eq')).toEqual([['id', 'plan-1'], ['user_id', 'user-1']]);
  });

  test('swapMealPlanSlots calls the swap RPC', async () => {
    await swapMealPlanSlots({ slotAId: 'a', slotBId: 'b' });

    expect(fake.callsOf('rpc')[0]?.[0]).toBe('swap_meal_plan_slots');
  });

  test('copyMealPlanToCurrentWeek calls the copy RPC', async () => {
    await copyMealPlanToCurrentWeek('plan-1');

    expect(fake.callsOf('rpc')[0]?.[0]).toBe('copy_meal_plan_to_week');
  });
});

describe('shopping list', () => {
  test('toggleShoppingListItem calls the set-comprado RPC', async () => {
    await toggleShoppingListItem({ listId: 'l-1', pasilloIdx: 0, itemIdx: 1, comprado: true });

    expect(fake.callsOf('rpc')[0]?.[0]).toBe('jsonb_set_comprado');
  });

  test('clearComprados calls the clear RPC', async () => {
    await clearComprados('l-1');

    expect(fake.callsOf('rpc')[0]?.[0]).toBe('jsonb_clear_comprados');
  });

  test('addShoppingListItem calls the add-item RPC', async () => {
    await addShoppingListItem({ listId: 'l-1', pasilloNombre: 'Lácteos', item: { nombre: 'leche', cantidad: 1, unidad: 'l', comprado: false } });

    expect(fake.callsOf('rpc')[0]?.[0]).toBe('jsonb_add_item');
  });
});

describe('getPlanTierForAnalytics', () => {
  test('reads the plan of that user', async () => {
    fake = createMockClient({ data: { plan: 'pro' } });

    expect(await getPlanTierForAnalytics('user-1')).toBe('pro');
    expect(fake.callsOf('eq')).toEqual([['id', 'user-1']]);
  });

  test('never throws: a failed read counts as free', async () => {
    fake = createMockClient({ errorMessage: 'boom' });

    expect(await getPlanTierForAnalytics('user-1')).toBe('free');
  });
});

describe('admin catalog search', () => {
  test('searchCatalogRecipes runs the OR-filtered search through the browser client', async () => {
    fake = createMockClient({ data: [] });

    await searchCatalogRecipes('lentejas');

    expect(fake.callsOf('or')).toHaveLength(1);
  });
});

describe('routes notice', () => {
  test('markRoutesNoticeDismissed marks the notice dismissed on the signed-in profile', async () => {
    await markRoutesNoticeDismissed();

    expect(fake.callsOf('update')).toEqual([[{ aviso_rutas_descartado: true }]]);
    expect(fake.callsOf('eq')).toEqual([['id', 'user-1']]);
  });
});

describe('pending consents', () => {
  test('flushPendingConsents reads the signed-in user to see what is parked in their metadata', async () => {
    await flushPendingConsents();

    expect(fake.callsOf('auth.getUser')).toHaveLength(1);
  });
});
