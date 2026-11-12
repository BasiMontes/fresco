import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
import { UserProfileError } from './errors';
import { getHasSeenTour, markTourSeen } from './tour';

// FRESCO-1197 — whether the person has already seen the first-visit tour, and the write that records
// it. A wrong "not seen" shows the tour again to someone who skipped it, and a wrong "seen" hides it
// from someone who never got it. Only the Supabase client is replaced.

interface Call {
  table?: string
  select?: string
  update?: Record<string, unknown>
  filters: Array<[string, unknown]>
}

interface Result { data?: unknown, error: { message: string } | null }

function fakeClient(opts: { read?: Result, write?: Result, user?: { id: string } | null, userError?: boolean } = {}) {
  const call: Call = { filters: [] };
  const readChain: Record<string, unknown> = {
    eq: (column: string, value: unknown) => { call.filters.push([column, value]); return readChain; },
    maybeSingle: async () => opts.read ?? { data: null, error: null },
  };
  const writeChain: Record<string, unknown> = {
    eq: async (column: string, value: unknown) => { call.filters.push([column, value]); return opts.write ?? { error: null }; },
  };
  const supabase = {
    auth: { getUser: async () => ({ data: { user: opts.user === undefined ? { id: 'session-user' } : opts.user }, error: opts.userError ? { message: 'no session' } : null }) },
    from: (table: string) => ({
      select: (columns: string) => { call.table = table; call.select = columns; return readChain; },
      update: (values: Record<string, unknown>) => { call.table = table; call.update = values; return writeChain; },
    }),
  } as unknown as SupabaseClient<Database>;
  return { supabase, call };
}

describe('getHasSeenTour', () => {
  test('is true when the profile is marked as seen, and reads only that column of that user', async () => {
    const { supabase, call } = fakeClient({ read: { data: { recorrido_visto: true }, error: null } });

    expect(await getHasSeenTour(supabase, 'user-1')).toBe(true);
    expect(call.table).toBe('user_profiles');
    expect(call.select).toBe('recorrido_visto');
    expect(call.filters).toEqual([['id', 'user-1']]);
  });

  test('is false when the profile is not marked as seen', async () => {
    const { supabase } = fakeClient({ read: { data: { recorrido_visto: false }, error: null } });

    expect(await getHasSeenTour(supabase, 'user-1')).toBe(false);
  });

  test('is true when there is no profile row: onboarding is not finished, so there is nothing to show yet', async () => {
    const { supabase } = fakeClient({ read: { data: null, error: null } });

    expect(await getHasSeenTour(supabase, 'user-1')).toBe(true);
  });

  test('throws, never answers not seen, when the read fails, so the caller chooses the fallback', async () => {
    const { supabase } = fakeClient({ read: { data: null, error: { message: 'rls denied' } } });

    await expect(getHasSeenTour(supabase, 'user-1')).rejects.toThrow(UserProfileError);
    await expect(getHasSeenTour(supabase, 'user-1')).rejects.toThrow('No se pudo leer el perfil: rls denied');
  });
});

describe('markTourSeen', () => {
  test('marks the given user as having seen the tour, touching only that column', async () => {
    const { supabase, call } = fakeClient();

    await markTourSeen(supabase, 'user-1');

    expect(call.table).toBe('user_profiles');
    expect(call.update).toEqual({ recorrido_visto: true });
    expect(call.filters).toEqual([['id', 'user-1']]);
  });

  test('resolves the signed-in user when no id is passed', async () => {
    const { supabase, call } = fakeClient({ user: { id: 'session-user' } });

    await markTourSeen(supabase);

    expect(call.filters).toEqual([['id', 'session-user']]);
  });

  test('throws when there is no session to resolve, and writes nothing', async () => {
    const { supabase, call } = fakeClient({ user: null });

    await expect(markTourSeen(supabase)).rejects.toThrow('No hay una sesión autenticada para guardar el perfil.');
    expect(call.update).toBeUndefined();
  });

  test('throws when the write fails', async () => {
    const { supabase } = fakeClient({ write: { error: { message: 'boom' } } });

    await expect(markTourSeen(supabase, 'user-1')).rejects.toThrow('No se pudo guardar el perfil: boom');
  });
});
