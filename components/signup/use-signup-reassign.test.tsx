import type { Captcha } from '@/components/auth/use-captcha';
import { AuthApiError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as edgeFunctions from '@/lib/api/edge-functions';
import { translateAuthError } from '@/lib/auth-errors';
import * as authApi from '@/lib/client-api/auth';
import * as distinctId from '@/lib/posthog/distinct-id';
import { POSTHOG_EVENTS } from '@/lib/posthog/event-names';
import * as events from '@/lib/posthog/events';
import { act, renderHook } from '@/tests/component-render';
import { routerMock } from '@/tests/mocks/next-navigation';
import { useSignupReassign } from './use-signup-reassign';

const FAKE_EMAIL = 'test-user@example.com';

const setNavigating = mock((_value: boolean) => {});
const captchaReset = mock(() => {});
const captcha = { token: 'fake-captcha-token', reset: captchaReset } as unknown as Captcha;

type SessionResult = Awaited<ReturnType<typeof authApi.getSession>>;
type ProofResult = Awaited<ReturnType<typeof authApi.proveAccountOwnership>>;
type AdoptResult = Awaited<ReturnType<typeof authApi.adoptSession>>;

const guestSession = { access_token: 'guest-access-token' } as unknown as SessionResult;
const proofOk = { data: { session: { access_token: 'proof-access-token', refresh_token: 'proof-refresh-token' } }, error: null } as unknown as ProofResult;
const adoptOk = { data: { user: { id: 'real-user-id' } }, error: null } as unknown as AdoptResult;

let sessionSpy: ReturnType<typeof spyOn<typeof authApi, 'getSession'>>;
let proofSpy: ReturnType<typeof spyOn<typeof authApi, 'proveAccountOwnership'>>;
let adoptSpy: ReturnType<typeof spyOn<typeof authApi, 'adoptSession'>>;
let reassignSpy: ReturnType<typeof spyOn<typeof edgeFunctions, 'reassignGuestData'>>;
let distinctIdSpy: ReturnType<typeof spyOn<typeof distinctId, 'getDistinctId'>>;
let aliasSpy: ReturnType<typeof spyOn<typeof events, 'aliasUser'>>;
let captureSpy: ReturnType<typeof spyOn<typeof events, 'captureEvent'>>;

beforeEach(() => {
  for (const fn of [setNavigating, captchaReset, routerMock.push, routerMock.refresh]) {
    fn.mockClear();
  }
  sessionSpy = spyOn(authApi, 'getSession').mockResolvedValue(guestSession);
  proofSpy = spyOn(authApi, 'proveAccountOwnership').mockResolvedValue(proofOk);
  adoptSpy = spyOn(authApi, 'adoptSession').mockResolvedValue(adoptOk);
  reassignSpy = spyOn(edgeFunctions, 'reassignGuestData').mockResolvedValue({} as Awaited<ReturnType<typeof edgeFunctions.reassignGuestData>>);
  distinctIdSpy = spyOn(distinctId, 'getDistinctId').mockReturnValue('anonymous-distinct-id');
  aliasSpy = spyOn(events, 'aliasUser').mockImplementation(() => {});
  captureSpy = spyOn(events, 'captureEvent').mockImplementation(() => {});
});

afterEach(() => {
  for (const spy of [sessionSpy, proofSpy, adoptSpy, reassignSpy, distinctIdSpy, aliasSpy, captureSpy]) {
    spy.mockRestore();
  }
});

function setup() {
  return renderHook(() => useSignupReassign({ email: FAKE_EMAIL, captcha, setNavigating }));
}

type Hook = ReturnType<typeof setup>;

async function reassign(hook: Hook, password = 'fake-conflict-password') {
  act(() => hook.result.current.setConflictPassword(password));
  await act(async () => {
    await hook.result.current.handleReassign();
  });
}

describe('useSignupReassign success', () => {
  test('proves ownership, moves the guest data, adopts the real session and returns her to the menu', async () => {
    const hook = setup();

    await reassign(hook, 'her-real-password');

    expect(proofSpy).toHaveBeenCalledWith({ email: FAKE_EMAIL, password: 'her-real-password', captchaToken: 'fake-captcha-token' });
    expect(reassignSpy).toHaveBeenCalledWith({ targetAccessToken: 'proof-access-token' }, 'guest-access-token');
    expect(adoptSpy).toHaveBeenCalledWith({ accessToken: 'proof-access-token', refreshToken: 'proof-refresh-token' });
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    expect(setNavigating).toHaveBeenCalledWith(true);
    expect(routerMock.push).toHaveBeenCalledWith('/menu');
    expect(hook.result.current.reassignError).toBeNull();
    expect(hook.result.current.isReassigning).toBe(false);
  });

  test('the guest data is moved before the session is switched to the real account', async () => {
    const order: string[] = [];
    reassignSpy.mockImplementation(async () => {
      order.push('reassign');
      return {} as Awaited<ReturnType<typeof edgeFunctions.reassignGuestData>>;
    });
    adoptSpy.mockImplementation(async () => {
      order.push('adopt');
      return adoptOk;
    });
    const hook = setup();

    await reassign(hook);

    expect(order).toEqual(['reassign', 'adopt']);
  });

  test('the captcha is reset right after the proof, a token being single-use', async () => {
    const hook = setup();

    await reassign(hook);

    expect(captchaReset).toHaveBeenCalledTimes(1);
  });

  test('links the anonymous analytics identity to the real account and reports the signup method', async () => {
    const hook = setup();

    await reassign(hook);

    expect(aliasSpy).toHaveBeenCalledWith('real-user-id', 'anonymous-distinct-id');
    expect(captureSpy).toHaveBeenCalledWith(POSTHOG_EVENTS.USER_SIGNED_UP, { method: 'progressive_signup_reassign', $set_once: { signup_method: 'progressive_signup_reassign' } });
  });

  test('without an anonymous analytics identity it skips the alias but still finishes', async () => {
    distinctIdSpy.mockReturnValue(null);
    const hook = setup();

    await reassign(hook);

    expect(aliasSpy).not.toHaveBeenCalled();
    expect(routerMock.push).toHaveBeenCalledWith('/menu');
  });
});

describe('useSignupReassign failures', () => {
  test('a guest session that expired stops before asking the password anywhere', async () => {
    sessionSpy.mockResolvedValueOnce(null);
    const hook = setup();

    await reassign(hook);

    expect(hook.result.current.reassignError).toBe('Tu sesión de invitada expiró. Recarga la página e inténtalo de nuevo.');
    expect(proofSpy).not.toHaveBeenCalled();
    expect(reassignSpy).not.toHaveBeenCalled();
    expect(hook.result.current.isReassigning).toBe(false);
  });

  test('a wrong password shows the translated error and moves nothing', async () => {
    proofSpy.mockResolvedValueOnce({ data: { session: null }, error: new AuthApiError('bad', 400, 'invalid_credentials') } as unknown as ProofResult);
    const hook = setup();

    await reassign(hook);

    expect(hook.result.current.reassignError).not.toBeNull();
    expect(captchaReset).toHaveBeenCalledTimes(1);
    expect(reassignSpy).not.toHaveBeenCalled();
    expect(adoptSpy).not.toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  test('a proof that returns no session is treated as a failure even without an error', async () => {
    proofSpy.mockResolvedValueOnce({ data: { session: null }, error: null } as unknown as ProofResult);
    const hook = setup();

    await reassign(hook);

    // The generic Auth message, not the catch-all one: the guard answered, nothing was thrown.
    expect(hook.result.current.reassignError).toBe(translateAuthError(null));
    expect(reassignSpy).not.toHaveBeenCalled();
  });

  test('an Edge Function error shows its own message and does not switch the session', async () => {
    reassignSpy.mockRejectedValueOnce(new edgeFunctions.EdgeFunctionError(409, { error: 'La cuenta ya tiene datos.' }));
    const hook = setup();

    await reassign(hook);

    expect(hook.result.current.reassignError).toBe('La cuenta ya tiene datos.');
    expect(adoptSpy).not.toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(hook.result.current.isReassigning).toBe(false);
  });

  test('any other thrown error falls back to the generic verification message', async () => {
    reassignSpy.mockRejectedValueOnce(new TypeError('network down'));
    const hook = setup();

    await reassign(hook);

    expect(hook.result.current.reassignError).toBe('No pudimos verificar esa cuenta. Inténtalo de nuevo.');
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  test('a failure adopting the real session shows the error and does not report a signup', async () => {
    adoptSpy.mockResolvedValueOnce({ data: { user: null }, error: new AuthApiError('bad', 400, 'session_not_found') } as unknown as AdoptResult);
    const hook = setup();

    await reassign(hook);

    expect(hook.result.current.reassignError).not.toBeNull();
    expect(aliasSpy).not.toHaveBeenCalled();
    expect(captureSpy).not.toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  test('a previous error is cleared when she tries again', async () => {
    reassignSpy.mockRejectedValueOnce(new TypeError('network down'));
    const hook = setup();
    await reassign(hook);
    expect(hook.result.current.reassignError).not.toBeNull();

    await reassign(hook);

    expect(hook.result.current.reassignError).toBeNull();
    expect(routerMock.push).toHaveBeenCalledWith('/menu');
  });
});
