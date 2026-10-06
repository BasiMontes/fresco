import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { createMockClient } from '@/lib/fixtures/mock-supabase-client';

/**
 * FRESCO-810 (ADR-0041) + FRESCO-505: `lib/client-api/identity` is what the two
 * root-layout components (the landing nav and the identity-cookie sync) use
 * instead of a Supabase client, so it has to stay light and lazy.
 */

const unsubscribeMock = mock(() => {});
const onAuthStateChangeMock = mock((_callback: unknown) => ({ data: { subscription: { unsubscribe: unsubscribeMock } } }));
const getSessionMock = mock(async (): Promise<{ data: { session: { user: { id: string } } | null } }> => ({ data: { session: { user: { id: 'user-1' } } } }));
let data = createMockClient({ data: { nombre: 'Laura' } });

void mock.module('@/lib/supabase/client-lazy', () => ({
  loadSupabaseClient: async () => ({
    createClient: () => ({
      from: data.client.from.bind(data.client),
      auth: { getSession: getSessionMock, onAuthStateChange: onAuthStateChangeMock },
    }),
  }),
}));

const { getSessionLazy, readProfileNombre, watchAuthState } = await import('@/lib/client-api/identity');

beforeEach(() => {
  unsubscribeMock.mockClear();
  onAuthStateChangeMock.mockClear();
  getSessionMock.mockClear();
  data = createMockClient({ data: { nombre: 'Laura' } });
});

describe('getSessionLazy', () => {
  test('returns the current session, and null when there is none', async () => {
    expect(await getSessionLazy()).toEqual({ user: { id: 'user-1' } });

    getSessionMock.mockResolvedValueOnce({ data: { session: null } });
    expect(await getSessionLazy()).toBeNull();
  });
});

describe('watchAuthState', () => {
  test('subscribes with the callback and returns a function that unsubscribes', async () => {
    const onChange = mock(() => {});

    const stop = await watchAuthState({ onChange, signal: new AbortController().signal });

    expect(onAuthStateChangeMock).toHaveBeenCalledWith(onChange);
    stop();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  test('opens no subscription when the caller already unmounted, so no callback can fire after it', async () => {
    const controller = new AbortController();
    controller.abort();

    const stop = await watchAuthState({ onChange: () => {}, signal: controller.signal });

    expect(onAuthStateChangeMock).not.toHaveBeenCalled();
    stop();
    expect(unsubscribeMock).not.toHaveBeenCalled();
  });
});

describe('readProfileNombre', () => {
  test('reads the name of that user', async () => {
    expect(await readProfileNombre('user-1')).toBe('Laura');
    expect(data.callsOf('from')).toEqual([['user_profiles']]);
    expect(data.callsOf('select')).toEqual([['nombre']]);
    expect(data.callsOf('eq')).toEqual([['id', 'user-1']]);
  });

  test('returns null when there is no profile, a null name, or the read failed', async () => {
    data = createMockClient({ data: null });
    expect(await readProfileNombre('user-1')).toBeNull();

    data = createMockClient({ data: { nombre: null } });
    expect(await readProfileNombre('user-1')).toBeNull();

    data = createMockClient({ errorMessage: 'boom' });
    expect(await readProfileNombre('user-1')).toBeNull();
  });
});

describe('the two light components stay light (FRESCO-505)', () => {
  const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  const importedClientApi = (source: string) => [...source.matchAll(/from '@\/lib\/client-api\/([a-z-]+)'/g)].map(match => match[1]);

  test('identity.ts imports the Supabase client only through the lazy loader', () => {
    const source = read('lib/client-api/identity.ts');

    expect(source).not.toMatch(/from '@\/lib\/supabase\/client'/);
    expect(source).toMatch(/from '@\/lib\/supabase\/client-lazy'/);
  });

  test('site-nav and identity-cookie-sync import no client-api module but identity (the others import the full client statically)', () => {
    expect(importedClientApi(read('components/landing/site-nav.tsx'))).toEqual(['identity']);
    expect(importedClientApi(read('components/auth/identity-cookie-sync.tsx'))).toEqual(['identity']);
  });
});
