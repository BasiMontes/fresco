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
const { createRecetaPropia, deleteRecetaPropia } = await import('@/lib/client-api/recipes');
const { confirmSubstitution, getSafeSubstitutes } = await import('@/lib/client-api/substitutions');
const { updateNombre, upsertUserProfile } = await import('@/lib/client-api/user-profile');

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
