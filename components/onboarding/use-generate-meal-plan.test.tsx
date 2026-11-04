import { afterEach, beforeEach, describe, expect, mock, setSystemTime, spyOn, test } from 'bun:test';
import * as edgeFunctions from '@/lib/api/edge-functions';
import { UserProfileError } from '@/lib/api/user-profile';
import * as authApi from '@/lib/client-api/auth';
import * as profileClient from '@/lib/client-api/user-profile';
import { POSTHOG_EVENTS } from '@/lib/posthog/event-names';
import * as events from '@/lib/posthog/events';
import * as firstMenu from '@/lib/push/first-menu-signal';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { act, renderHook } from '@/tests/component-render';
import { routerMock } from '@/tests/mocks/next-navigation';
import { useGenerateMealPlan } from './use-generate-meal-plan';

// A Wednesday: ISO week 2026-W45, which starts on Monday 2026-11-02.
const NOW = new Date('2026-11-04T10:00:00Z');
const WEEK = '2026-W45';
const WEEK_START = '2026-11-02';

const markShouldReset = mock(() => {});

type SessionResult = Awaited<ReturnType<typeof authApi.getSession>>;
type MenuResult = Awaited<ReturnType<typeof edgeFunctions.generateMealPlan>>;
type EdgeErrorBody = ConstructorParameters<typeof edgeFunctions.EdgeFunctionError>[1];

const registeredSession = { access_token: 'access-token', user: { id: 'user-id' } } as unknown as SessionResult;
const edgeError = (status: number, message = 'server said no') => new edgeFunctions.EdgeFunctionError(status, { error: message });

let sessionSpy: ReturnType<typeof spyOn<typeof authApi, 'getSession'>>;
let upsertSpy: ReturnType<typeof spyOn<typeof profileClient, 'upsertUserProfile'>>;
let tierSpy: ReturnType<typeof spyOn<typeof profileClient, 'getPlanTierForAnalytics'>>;
let generateSpy: ReturnType<typeof spyOn<typeof edgeFunctions, 'generateMealPlan'>>;
let captureSpy: ReturnType<typeof spyOn<typeof events, 'captureEvent'>>;
let firstMenuSpy: ReturnType<typeof spyOn<typeof firstMenu, 'markFirstMenuGenerated'>>;

beforeEach(() => {
  setSystemTime(NOW);
  markShouldReset.mockClear();
  routerMock.push.mockClear();
  useOnboardingStore.getState().reset();
  sessionSpy = spyOn(authApi, 'getSession').mockResolvedValue(registeredSession);
  upsertSpy = spyOn(profileClient, 'upsertUserProfile').mockResolvedValue(undefined);
  tierSpy = spyOn(profileClient, 'getPlanTierForAnalytics').mockResolvedValue('pro');
  generateSpy = spyOn(edgeFunctions, 'generateMealPlan').mockResolvedValue({} as MenuResult);
  captureSpy = spyOn(events, 'captureEvent').mockImplementation(() => {});
  firstMenuSpy = spyOn(firstMenu, 'markFirstMenuGenerated').mockImplementation(() => {});
});

afterEach(() => {
  setSystemTime();
  for (const spy of [sessionSpy, upsertSpy, tierSpy, generateSpy, captureSpy, firstMenuSpy]) {
    spy.mockRestore();
  }
});

function setup() {
  return renderHook(() => useGenerateMealPlan({ markShouldReset }));
}

type Hook = ReturnType<typeof setup>;

async function generate(hook: Hook) {
  await act(async () => {
    await hook.result.current.handleGenerate();
  });
}

const eventNames = () => captureSpy.mock.calls.map(call => call[0]);

describe('useGenerateMealPlan success', () => {
  test('saves her profile, generates the menu for the current ISO week with her token and goes to the menu', async () => {
    useOnboardingStore.setState({ nombre: 'Ana' });
    const hook = setup();

    await generate(hook);

    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy.mock.calls[0][0].nombre).toBe('Ana');
    expect(generateSpy).toHaveBeenCalledWith({ semana_iso: WEEK, fecha_inicio: WEEK_START }, 'access-token');
    expect(hook.result.current.generateSuccess).toBe(true);
    expect(hook.result.current.generateError).toBeNull();
    expect(hook.result.current.isGenerating).toBe(false);
    expect(routerMock.push).toHaveBeenCalledWith('/menu');
  });

  test('A8-LOGIC-04: in the first hour of a Madrid Monday it asks for the new week, not the one that just ended', async () => {
    // Sunday 23:30 UTC is Monday 00:30 in Madrid (winter).
    setSystemTime(new Date('2026-11-01T23:30:00Z'));
    const hook = setup();

    await generate(hook);

    expect(generateSpy).toHaveBeenCalledWith({ semana_iso: WEEK, fecha_inicio: WEEK_START }, 'access-token');
  });

  test('saves the profile before it asks for the menu', async () => {
    const order: string[] = [];
    upsertSpy.mockImplementation(async () => {
      order.push('upsert');
      return undefined;
    });
    generateSpy.mockImplementation(async () => {
      order.push('generate');
      return {} as MenuResult;
    });
    const hook = setup();

    await generate(hook);

    expect(order).toEqual(['upsert', 'generate']);
  });

  test('reports the funnel steps in order with the week and the plan tier, and marks the first menu', async () => {
    const hook = setup();

    await generate(hook);

    expect(eventNames()).toEqual([POSTHOG_EVENTS.ONBOARDING_COMPLETED, POSTHOG_EVENTS.MENU_GENERATION_STARTED, POSTHOG_EVENTS.MENU_GENERATION_COMPLETED]);
    expect(captureSpy.mock.calls[0][1]).toEqual({ total_steps: 3 });
    expect(captureSpy.mock.calls[2][1]).toEqual({ semana_iso: WEEK, tier: 'pro' });
    expect(tierSpy).toHaveBeenCalledWith('user-id');
    expect(markShouldReset).toHaveBeenCalledTimes(1);
    expect(firstMenuSpy).toHaveBeenCalledTimes(1);
  });

  test('without a user in the session the tier is free and the plan is never asked for', async () => {
    sessionSpy.mockResolvedValue({ access_token: 'guest-token' } as unknown as SessionResult);
    const hook = setup();

    await generate(hook);

    expect(tierSpy).not.toHaveBeenCalled();
    expect(captureSpy.mock.calls[2][1]).toEqual({ semana_iso: WEEK, tier: 'free' });
    expect(generateSpy).toHaveBeenCalledWith({ semana_iso: WEEK, fecha_inicio: WEEK_START }, 'guest-token');
  });

  test('without any session it still tries with no token and reports a free tier', async () => {
    sessionSpy.mockResolvedValue(null);
    const hook = setup();

    await generate(hook);

    expect(generateSpy).toHaveBeenCalledWith({ semana_iso: WEEK, fecha_inicio: WEEK_START }, null);
    expect(captureSpy.mock.calls[2][1]).toEqual({ semana_iso: WEEK, tier: 'free' });
  });
});

describe('useGenerateMealPlan failures', () => {
  test('a catalogue too small for her restrictions (422) says to widen her preferences', async () => {
    generateSpy.mockRejectedValueOnce(edgeError(422));
    const hook = setup();

    await generate(hook);

    expect(hook.result.current.generateError).toContain('No pudimos generar un menú válido con tus restricciones actuales.');
    expect(hook.result.current.hasExistingMenu).toBe(false);
  });

  test('a week that already has a menu (409) is flagged so the page can offer the way out', async () => {
    generateSpy.mockRejectedValueOnce(edgeError(409));
    const hook = setup();

    await generate(hook);

    expect(hook.result.current.generateError).toBe('Ya existe un menú para esta semana.');
    expect(hook.result.current.hasExistingMenu).toBe(true);
  });

  test('a dropped connection says to check the internet', async () => {
    generateSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const hook = setup();

    await generate(hook);

    expect(hook.result.current.generateError).toContain('Revisa tu conexión a internet');
  });

  test('a profile error is shown as it comes, since its message is already user-facing', async () => {
    upsertSpy.mockRejectedValueOnce(new UserProfileError('No pudimos guardar tu perfil.'));
    const hook = setup();

    await generate(hook);

    expect(hook.result.current.generateError).toBe('No pudimos guardar tu perfil.');
    expect(generateSpy).not.toHaveBeenCalled();
  });

  test('any other server status names the status code', async () => {
    generateSpy.mockRejectedValueOnce(edgeError(500));
    const hook = setup();

    await generate(hook);

    expect(hook.result.current.generateError).toContain('código 500');
  });

  test('an unknown error falls back to the generic message', async () => {
    generateSpy.mockRejectedValueOnce(new Error('boom'));
    const hook = setup();

    await generate(hook);

    expect(hook.result.current.generateError).toBe('No pudimos guardar tu perfil o generar tu menú. Intenta de nuevo.');
  });

  test('a failure never navigates, resets the funnel or reports the menu as generated, and releases the button', async () => {
    generateSpy.mockRejectedValueOnce(edgeError(500));
    const hook = setup();

    await generate(hook);

    expect(routerMock.push).not.toHaveBeenCalled();
    expect(markShouldReset).not.toHaveBeenCalled();
    expect(firstMenuSpy).not.toHaveBeenCalled();
    expect(eventNames()).toEqual([POSTHOG_EVENTS.ONBOARDING_COMPLETED, POSTHOG_EVENTS.MENU_GENERATION_STARTED]);
    expect(hook.result.current.generateSuccess).toBe(false);
    expect(hook.result.current.isGenerating).toBe(false);
  });

  test('retrying after a failure clears the error', async () => {
    generateSpy.mockRejectedValueOnce(edgeError(500));
    const hook = setup();
    await generate(hook);
    expect(hook.result.current.generateError).not.toBeNull();

    await generate(hook);

    expect(hook.result.current.generateError).toBeNull();
    expect(routerMock.push).toHaveBeenCalledWith('/menu');
  });
});
