import type { SupabaseClient } from '@supabase/supabase-js';
import type { SavedOnboardingProfile } from '@/lib/api/user-profile';
import type { Database } from '@/lib/supabase/types';
import { afterEach, describe, expect, test } from 'bun:test';
import { hydrateFromSavedProfile } from '@/lib/onboarding/hydrate-saved-profile';
import { useOnboardingStore } from '@/lib/store/onboarding-store';

interface QueryResult { data: unknown, error: { message: string } | null }

/** `result` answers the profile read; `consent` (none by default) answers the `user_consents` read. */
function clientReturning(result: QueryResult, consent: QueryResult = { data: null, error: null }): SupabaseClient<Database> {
  function chainFor(answer: QueryResult) {
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => answer };
    return chain;
  }
  return { from: (table: string) => chainFor(table === 'user_consents' ? consent : result) } as unknown as SupabaseClient<Database>;
}

const SAVED = {
  nombre: 'Marta',
  sexo: null,
  objetivo: null,
  adultos: 2,
  ninos: 0,
  dieta_vegetariano: false,
  dieta_vegano: false,
  dieta_sin_gluten: false,
  dieta_sin_lactosa: false,
  dieta_sin_huevo: true,
  dieta_keto: false,
  dieta_halal: true,
  alergenos: ['huevo'],
  ingredientes_odiados: [],
  cocinas_favoritas: [],
  dieta_texto_libre: null,
  ingredientes_odiados_texto_libre: null,
  cocinas_texto_libre: null,
  presupuesto_semana_euros: null,
  planning_selection: {},
  nivel_experiencia: null,
} as unknown as SavedOnboardingProfile;

afterEach(() => {
  useOnboardingStore.getState().reset();
});

describe('hydrateFromSavedProfile (FRESCO-806)', () => {
  test('fills an untouched wizard from the saved profile', async () => {
    const result = await hydrateFromSavedProfile({ client: clientReturning({ data: SAVED, error: null }), userId: 'u1' });
    expect(result).toBe('hydrated');
    const state = useOnboardingStore.getState();
    expect(state.nombre).toBe('Marta');
    expect(state.dietaHalal).toBe(true);
    expect(state.alergenos).toEqual(['huevo']);
  });

  test('leaves the wizard empty for a user with no profile', async () => {
    const result = await hydrateFromSavedProfile({ client: clientReturning({ data: null, error: null }), userId: 'u1' });
    expect(result).toBe('no-profile');
    expect(useOnboardingStore.getState().alergenos).toEqual([]);
  });

  test('keeps edits already in the wizard (a reload mid-wizard)', async () => {
    useOnboardingStore.getState().setNombre('Escrito a mano');
    const result = await hydrateFromSavedProfile({ client: clientReturning({ data: SAVED, error: null }), userId: 'u1' });
    expect(result).toBe('kept-edits');
    expect(useOnboardingStore.getState().nombre).toBe('Escrito a mano');
    expect(useOnboardingStore.getState().dietaHalal).toBe(false);
  });

  test('a health-data consent already given for the current texts is carried into the wizard with its date (FRESCO-856)', async () => {
    const client = clientReturning({ data: SAVED, error: null }, { data: { accepted_at: '2026-10-06T10:00:00Z' }, error: null });
    await hydrateFromSavedProfile({ client, userId: 'u1' });
    const state = useOnboardingStore.getState();
    expect(state.healthDataConsent).toBe(true);
    expect(state.healthConsentPriorAt).toBe('2026-10-06T10:00:00Z');
  });

  test('no consent for the current texts leaves the box unticked (FRESCO-856)', async () => {
    await hydrateFromSavedProfile({ client: clientReturning({ data: SAVED, error: null }), userId: 'u1' });
    const state = useOnboardingStore.getState();
    expect(state.healthDataConsent).toBe(false);
    expect(state.healthConsentPriorAt).toBeNull();
  });

  test('a failed consent read still hydrates the profile and asks for the consent again (FRESCO-856)', async () => {
    const client = clientReturning({ data: SAVED, error: null }, { data: null, error: { message: 'boom' } });
    expect(await hydrateFromSavedProfile({ client, userId: 'u1' })).toBe('hydrated');
    const state = useOnboardingStore.getState();
    expect(state.alergenos).toEqual(['huevo']);
    expect(state.healthDataConsent).toBe(false);
  });

  test('a user with no profile keeps the box unticked even if a consent exists (FRESCO-856)', async () => {
    const client = clientReturning({ data: null, error: null }, { data: { accepted_at: '2026-10-06T10:00:00Z' }, error: null });
    await hydrateFromSavedProfile({ client, userId: 'u1' });
    expect(useOnboardingStore.getState().healthDataConsent).toBe(false);
  });

  test('edits already in the wizard keep their own consent state (FRESCO-856)', async () => {
    useOnboardingStore.getState().setNombre('Escrito a mano');
    const client = clientReturning({ data: SAVED, error: null }, { data: { accepted_at: '2026-10-06T10:00:00Z' }, error: null });
    await hydrateFromSavedProfile({ client, userId: 'u1' });
    expect(useOnboardingStore.getState().healthDataConsent).toBe(false);
  });

  test('a read error is thrown, never turned into an empty wizard', async () => {
    const client = clientReturning({ data: null, error: { message: 'boom' } });
    await expect(hydrateFromSavedProfile({ client, userId: 'u1' })).rejects.toThrow('No se pudo leer el perfil guardado');
    expect(useOnboardingStore.getState().alergenos).toEqual([]);
  });
});
