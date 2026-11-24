import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as edgeFunctions from '@/lib/api/edge-functions';
import * as authApi from '@/lib/client-api/auth';
import * as userProfile from '@/lib/client-api/user-profile';
import { POSTHOG_EVENTS } from '@/lib/posthog/event-names';
import * as events from '@/lib/posthog/events';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { routerMock } from '@/tests/mocks/next-navigation';
import { GenerateWeekButton } from './generate-week-button';

/**
 * FRESCO-409 — `GenerateWeekButton` disables itself and shows a fixed
 * message for a week that has already passed (`fechaInicio` < this week's
 * Monday), before any network call. That guard is the branch worth
 * pinning; the 422/409 error mapping is left to e2e (it needs the full
 * Supabase + Edge Function mock surface).
 */

const PAST_MONDAY = '2020-01-06';
const FUTURE_MONDAY = '2999-01-04';

describe('GenerateWeekButton', () => {
  beforeEach(() => {
    routerMock.refresh.mockClear();
  });

  test('renders an enabled generate button for a non-past week', () => {
    renderWithProviders(<GenerateWeekButton semanaIso="2999-W01" fechaInicio={FUTURE_MONDAY} />);

    const button = screen.getByTestId('generate_week_button');
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('Generar mi menú');
    expect(screen.queryByTestId('generate_week_error_message')).toBeNull();
  });

  test('disables the button and explains why for a past week', () => {
    renderWithProviders(<GenerateWeekButton semanaIso="2020-W02" fechaInicio={PAST_MONDAY} />);

    expect(screen.getByTestId('generate_week_button')).toBeDisabled();
    expect(screen.getByTestId('generate_week_error_message')).toHaveTextContent(
      'No se pueden planificar semanas que ya han pasado.',
    );
  });

  test('does not navigate when the disabled past-week button is clicked', async () => {
    renderWithProviders(<GenerateWeekButton semanaIso="2020-W02" fechaInicio={PAST_MONDAY} />);

    screen.getByTestId('generate_week_button').click();

    expect(routerMock.refresh).not.toHaveBeenCalled();
  });
});

// FRESCO-1077 — the generation itself: what the button sends, where it goes after
// success, and which message each failure gets. The edge function and the session
// are the only boundaries replaced.

const { EdgeFunctionError, EdgeFunctionTimeoutError } = edgeFunctions;

describe('GenerateWeekButton generation', () => {
  let generateSpy: ReturnType<typeof spyOn<typeof edgeFunctions, 'generateMealPlan'>>;
  let sessionSpy: ReturnType<typeof spyOn<typeof authApi, 'getSession'>>;
  let tierSpy: ReturnType<typeof spyOn<typeof userProfile, 'getPlanTierForAnalytics'>>;
  let captureSpy: ReturnType<typeof spyOn<typeof events, 'captureEvent'>>;
  let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;

  beforeEach(() => {
    routerMock.refresh.mockClear();
    routerMock.push.mockClear();
    generateSpy = spyOn(edgeFunctions, 'generateMealPlan').mockResolvedValue({} as never);
    sessionSpy = spyOn(authApi, 'getSession').mockResolvedValue({ access_token: 'tok', user: { id: 'u1' } } as never);
    tierSpy = spyOn(userProfile, 'getPlanTierForAnalytics').mockResolvedValue('pro');
    captureSpy = spyOn(events, 'captureEvent').mockImplementation(() => {});
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const spy of [generateSpy, sessionSpy, tierSpy, captureSpy, errorSpy]) { spy.mockRestore(); }
  });

  async function generate(props: { redirectTo?: string } = {}) {
    renderWithProviders(<GenerateWeekButton semanaIso="2999-W01" fechaInicio={FUTURE_MONDAY} {...props} />);
    await setupUser().click(screen.getByTestId('generate_week_button'));
  }

  test('sends the week and the access token, then refreshes in place', async () => {
    await generate();
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
    expect(generateSpy).toHaveBeenCalledWith({ semana_iso: '2999-W01', fecha_inicio: FUTURE_MONDAY }, 'tok');
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  test('with redirectTo it navigates there instead of refreshing', async () => {
    await generate({ redirectTo: '/calendar' });
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/calendar'));
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  test('records the start, and the completion with the week and the plan tier', async () => {
    await generate();
    await waitFor(() => expect(captureSpy).toHaveBeenCalledTimes(2));
    expect(captureSpy.mock.calls[1]?.[1]).toEqual({ semana_iso: '2999-W01', tier: 'pro' });
  });

  test('without a session it still generates, as a free user, with no token', async () => {
    sessionSpy.mockResolvedValue(null);
    await generate();
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled());
    expect(generateSpy).toHaveBeenCalledWith(expect.anything(), null);
    expect(tierSpy).not.toHaveBeenCalled();
    expect(captureSpy.mock.calls[1]?.[1]).toMatchObject({ tier: 'free' });
  });

  test('a 422 tells the user to widen their preferences', async () => {
    generateSpy.mockRejectedValue(new EdgeFunctionError(422, { error: 'catalogo insuficiente' }));
    await generate();
    expect(await screen.findByTestId('generate_week_error_message')).toHaveTextContent('ampliar tus preferencias');
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  test('a 409 tells the user a menu already exists for that week', async () => {
    generateSpy.mockRejectedValue(new EdgeFunctionError(409, { error: 'ya existe' }));
    await generate();
    expect(await screen.findByTestId('generate_week_error_message')).toHaveTextContent('Ya existe un menú para esta semana');
  });

  test('any other failure gets the generic message and the button works again', async () => {
    generateSpy.mockRejectedValue(new Error('network'));
    await generate();
    expect(await screen.findByTestId('generate_week_error_message')).toHaveTextContent('No pudimos generar tu menú. Intenta de nuevo.');
    expect(screen.getByTestId('generate_week_button')).toBeEnabled();
  });

  // FRESCO-1249 — a generation that did not answer in time may still have landed on the server.
  test('a timeout says the menu may already exist and the button works again', async () => {
    generateSpy.mockRejectedValue(new EdgeFunctionTimeoutError('generate-meal-plan', 30_000));
    await generate();
    expect(await screen.findByTestId('generate_week_error_message')).toHaveTextContent('Puede que ya se haya generado');
    expect(screen.getByTestId('generate_week_button')).toBeEnabled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  test('a 409 right after a timeout is that menu: it refreshes instead of asking to delete it', async () => {
    generateSpy
      .mockRejectedValueOnce(new EdgeFunctionTimeoutError('generate-meal-plan', 30_000))
      .mockRejectedValueOnce(new EdgeFunctionError(409, { error: 'ya existe' }));
    await generate();
    expect(await screen.findByTestId('generate_week_error_message')).toHaveTextContent('Puede que ya se haya generado');

    await setupUser().click(screen.getByTestId('generate_week_button'));

    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('generate_week_error_message')).toBeNull();
    expect(captureSpy.mock.calls.map(call => call[0])).not.toContain(POSTHOG_EVENTS.MENU_GENERATION_COMPLETED);
  });

  // FRESCO-1283 — a dropped connection is the commonest way to lose the response, and the menu may still have been made.
  test('a 409 right after a dropped connection is that menu: it refreshes instead of asking to delete it', async () => {
    generateSpy
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new EdgeFunctionError(409, { error: 'ya existe' }));
    await generate();
    expect(await screen.findByTestId('generate_week_error_message')).toHaveTextContent('No pudimos generar tu menú. Intenta de nuevo.');

    await setupUser().click(screen.getByTestId('generate_week_button'));

    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('generate_week_error_message')).toBeNull();
    expect(captureSpy.mock.calls.map(call => call[0])).not.toContain(POSTHOG_EVENTS.MENU_GENERATION_COMPLETED);
  });

  test('a 409 after a server error keeps asking to delete: the server answered, so it did not make a menu', async () => {
    generateSpy
      .mockRejectedValueOnce(new EdgeFunctionError(500, { error: 'boom' }))
      .mockRejectedValueOnce(new EdgeFunctionError(409, { error: 'ya existe' }));
    await generate();
    await screen.findByTestId('generate_week_error_message');

    await setupUser().click(screen.getByTestId('generate_week_button'));

    expect(await screen.findByTestId('generate_week_error_message')).toHaveTextContent('Elimínalo antes de generar uno nuevo');
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  test('a 409 with no timeout before it keeps asking to delete the existing menu', async () => {
    generateSpy.mockRejectedValue(new EdgeFunctionError(409, { error: 'ya existe' }));
    await generate();
    await screen.findByTestId('generate_week_error_message');

    await setupUser().click(screen.getByTestId('generate_week_button'));

    expect(await screen.findByTestId('generate_week_error_message')).toHaveTextContent('Elimínalo antes de generar uno nuevo');
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });
});
