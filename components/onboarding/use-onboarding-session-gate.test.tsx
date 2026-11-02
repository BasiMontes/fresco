import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as authApi from '@/lib/client-api/auth';
import * as consentsApi from '@/lib/client-api/consents';
import * as onboardingApi from '@/lib/client-api/onboarding';
import { act, renderHook, waitFor } from '@/tests/component-render';
import { useOnboardingSessionGate } from './use-onboarding-session-gate';

// FRESCO-1078 — decides whether /onboarding shows the guest-or-account choice or the wizard.
// A user with a saved profile must find it in the wizard, and a failed read must NOT fall back
// to an empty wizard (that would overwrite their allergens and diet), so it offers a retry.

let sessionSpy: ReturnType<typeof spyOn<typeof authApi, 'getSession'>>;
let hydrateSpy: ReturnType<typeof spyOn<typeof onboardingApi, 'hydrateFromSavedProfile'>>;
let flushSpy: ReturnType<typeof spyOn<typeof consentsApi, 'flushPendingConsents'>>;
let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;

beforeEach(() => {
  sessionSpy = spyOn(authApi, 'getSession').mockResolvedValue({ user: { id: 'u1' } } as never);
  hydrateSpy = spyOn(onboardingApi, 'hydrateFromSavedProfile').mockResolvedValue(undefined as never);
  flushSpy = spyOn(consentsApi, 'flushPendingConsents').mockResolvedValue(undefined);
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  for (const spy of [sessionSpy, hydrateSpy, flushSpy, errorSpy]) { spy.mockRestore(); }
});

describe('useOnboardingSessionGate', () => {
  test('starts unresolved, then shows the wizard animation flag', async () => {
    const { result } = renderHook(() => useOnboardingSessionGate());
    expect(result.current.identityResolved).toBeNull();
    await waitFor(() => expect(result.current.identityResolved).toBe(true));
    expect(result.current.wizardShown).toBe(true);
  });

  test('a signed-in user loads their saved profile into the wizard and resolves', async () => {
    const { result } = renderHook(() => useOnboardingSessionGate());
    await waitFor(() => expect(result.current.identityResolved).toBe(true));
    expect(hydrateSpy).toHaveBeenCalledWith({ userId: 'u1' });
    expect(result.current.profileLoadFailed).toBe(false);
  });

  test('a visitor with no session resolves to false: the guest-or-account choice', async () => {
    sessionSpy.mockResolvedValue(null);
    const { result } = renderHook(() => useOnboardingSessionGate());
    await waitFor(() => expect(result.current.identityResolved).toBe(false));
    expect(hydrateSpy).not.toHaveBeenCalled();
  });

  test('a failed profile read is reported, not turned into an empty wizard', async () => {
    hydrateSpy.mockRejectedValue(new Error('rls'));
    const { result } = renderHook(() => useOnboardingSessionGate());
    await waitFor(() => expect(result.current.profileLoadFailed).toBe(true));
    expect(errorSpy).toHaveBeenCalled();
  });

  test('retrying reads the profile again and clears the failure when it works', async () => {
    hydrateSpy.mockRejectedValueOnce(new Error('rls'));
    const { result } = renderHook(() => useOnboardingSessionGate());
    await waitFor(() => expect(result.current.profileLoadFailed).toBe(true));
    act(() => result.current.retryLoadProfile());
    expect(result.current.identityResolved).toBeNull();
    await waitFor(() => expect(result.current.profileLoadFailed).toBe(false));
    expect(hydrateSpy).toHaveBeenCalledTimes(2);
  });

  test('pending consents are recorded once the user is signed in', async () => {
    const { result } = renderHook(() => useOnboardingSessionGate());
    await waitFor(() => expect(result.current.identityResolved).toBe(true));
    await waitFor(() => expect(flushSpy).toHaveBeenCalledTimes(1));
  });

  test('a visitor with no session records no consents', async () => {
    sessionSpy.mockResolvedValue(null);
    const { result } = renderHook(() => useOnboardingSessionGate());
    await waitFor(() => expect(result.current.identityResolved).toBe(false));
    expect(flushSpy).not.toHaveBeenCalled();
  });

  test('the page can mark the identity as resolved after the guest-or-account choice', async () => {
    sessionSpy.mockResolvedValue(null);
    const { result } = renderHook(() => useOnboardingSessionGate());
    await waitFor(() => expect(result.current.identityResolved).toBe(false));
    act(() => result.current.setIdentityResolved(true));
    expect(result.current.identityResolved).toBe(true);
    await waitFor(() => expect(flushSpy).toHaveBeenCalled());
  });
});
