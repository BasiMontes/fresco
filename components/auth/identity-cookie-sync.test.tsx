import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as identityCookie from '@/lib/auth/identity-cookie';
import * as identityApi from '@/lib/client-api/identity';
import { act, renderWithProviders, waitFor } from '@/tests/component-render';
import { IdentityCookieSync } from './identity-cookie-sync';

// FRESCO-1078 — keeps the `fresco_nombre` cookie in step with the Supabase session so the
// landing nav can greet a returning visitor. A guest never gets a cookie; a signed-out visitor
// loses it. The auth listener and the cookie jar are the only boundaries replaced.

type OnChange = (event: string, session: { user?: { id: string, is_anonymous?: boolean } } | null) => void;

let onChange: OnChange;
const stop = mock(() => {});
let cookie: string | null;
let hasSessionSpy: ReturnType<typeof spyOn<typeof identityApi, 'hasSupabaseSessionCookie'>>;
let nombreSpy: ReturnType<typeof spyOn<typeof identityApi, 'readProfileNombre'>>;
let watchSpy: ReturnType<typeof spyOn<typeof identityApi, 'watchAuthState'>>;
let readSpy: ReturnType<typeof spyOn<typeof identityCookie, 'readNombreCookie'>>;
let writeSpy: ReturnType<typeof spyOn<typeof identityCookie, 'writeNombreCookie'>>;
let clearSpy: ReturnType<typeof spyOn<typeof identityCookie, 'clearNombreCookie'>>;

beforeEach(() => {
  cookie = null;
  stop.mockClear();
  hasSessionSpy = spyOn(identityApi, 'hasSupabaseSessionCookie').mockReturnValue(true);
  nombreSpy = spyOn(identityApi, 'readProfileNombre').mockResolvedValue('Laura');
  watchSpy = spyOn(identityApi, 'watchAuthState').mockImplementation(async (a) => { onChange = a.onChange as unknown as OnChange; return stop; });
  readSpy = spyOn(identityCookie, 'readNombreCookie').mockImplementation(() => cookie);
  writeSpy = spyOn(identityCookie, 'writeNombreCookie').mockImplementation((n) => { cookie = n; });
  clearSpy = spyOn(identityCookie, 'clearNombreCookie').mockImplementation(() => { cookie = null; });
});

afterEach(() => {
  for (const spy of [hasSessionSpy, nombreSpy, watchSpy, readSpy, writeSpy, clearSpy]) { spy.mockRestore(); }
});

async function mount() {
  const view = renderWithProviders(<IdentityCookieSync />);
  await waitFor(() => expect(watchSpy).toHaveBeenCalled());
  await act(async () => { await Promise.resolve(); });
  return view;
}

describe('IdentityCookieSync', () => {
  test('renders nothing', async () => {
    const { container } = await mount();
    expect(container).toBeEmptyDOMElement();
  });

  test('a visitor with no Supabase cookie costs nothing: the auth client is never loaded', async () => {
    hasSessionSpy.mockReturnValue(false);
    renderWithProviders(<IdentityCookieSync />);
    await act(async () => { await Promise.resolve(); });
    expect(watchSpy).not.toHaveBeenCalled();
  });

  test('a real user gets the cookie with their trimmed name', async () => {
    nombreSpy.mockResolvedValue('  Laura  ');
    await mount();
    await act(async () => { onChange('SIGNED_IN', { user: { id: 'u1' } }); });
    await waitFor(() => expect(writeSpy).toHaveBeenCalledWith('Laura'));
    expect(nombreSpy).toHaveBeenCalledWith('u1');
  });

  test('a real user with no name loses a stale cookie', async () => {
    nombreSpy.mockResolvedValue('   ');
    await mount();
    await act(async () => { onChange('SIGNED_IN', { user: { id: 'u1' } }); });
    await waitFor(() => expect(clearSpy).toHaveBeenCalled());
    expect(writeSpy).not.toHaveBeenCalled();
  });

  test('the same user is not looked up again while the cookie is there', async () => {
    await mount();
    await act(async () => { onChange('SIGNED_IN', { user: { id: 'u1' } }); });
    await waitFor(() => expect(writeSpy).toHaveBeenCalledTimes(1));
    await act(async () => { onChange('TOKEN_REFRESHED', { user: { id: 'u1' } }); });
    expect(nombreSpy).toHaveBeenCalledTimes(1);
  });

  test('a failing profile read is swallowed and leaves the cookie alone', async () => {
    nombreSpy.mockRejectedValue(new Error('db down'));
    await mount();
    await act(async () => { onChange('SIGNED_IN', { user: { id: 'u1' } }); });
    await waitFor(() => expect(nombreSpy).toHaveBeenCalled());
    expect(writeSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  test('an anonymous guest gets no lookup and loses any cookie', async () => {
    cookie = 'Laura';
    await mount();
    await act(async () => { onChange('SIGNED_IN', { user: { id: 'g1', is_anonymous: true } }); });
    expect(nombreSpy).not.toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  test('signing out clears the cookie and forgets the user', async () => {
    cookie = 'Laura';
    await mount();
    await act(async () => { onChange('SIGNED_OUT', null); });
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  test('a guest or signed-out visitor with no cookie clears nothing', async () => {
    await mount();
    await act(async () => { onChange('SIGNED_OUT', null); });
    expect(clearSpy).not.toHaveBeenCalled();
  });

  test('unmounting stops listening', async () => {
    const { unmount } = await mount();
    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  test('unmounting before the listener is ready stops it as soon as it is', async () => {
    let release: (stopFn: () => void) => void = () => {};
    watchSpy.mockImplementation(async () => new Promise<() => void>((resolve) => { release = resolve; }));
    const { unmount } = renderWithProviders(<IdentityCookieSync />);
    await act(async () => { await Promise.resolve(); });
    unmount();
    await act(async () => { release(stop); await Promise.resolve(); });
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
