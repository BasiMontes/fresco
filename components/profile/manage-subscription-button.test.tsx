import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/tests/component-render';
import { ManageSubscriptionButton } from './manage-subscription-button';

/** FRESCO-991 tranche 3 — the Billing Portal entry on `/profile`: it must fail visibly, never leave the button stuck. */

const realFetch = globalThis.fetch;
// Assigning `window.location.href` makes happy-dom really navigate and wipes the document (cookies
// included) for every test file that runs after this one, so navigation is switched off here.
const navigation = (window as unknown as { happyDOM: { settings: { navigation: { disableMainFrameNavigation: boolean } } } }).happyDOM.settings.navigation;

describe('ManageSubscriptionButton', () => {
  let consoleError: ReturnType<typeof spyOn>;
  beforeEach(() => {
    consoleError = spyOn(console, 'error').mockImplementation(() => {});
    navigation.disableMainFrameNavigation = true;
  });
  afterEach(() => {
    navigation.disableMainFrameNavigation = false;
    globalThis.fetch = realFetch;
    consoleError.mockRestore();
  });

  test('posts to the portal route and shows the redirecting state', async () => {
    const calls: { url: string, method?: string }[] = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method });
      return new Response(JSON.stringify({ url: '#stripe-portal' }), { status: 200 });
    }) as unknown as typeof fetch;
    renderWithProviders(<ManageSubscriptionButton />);

    fireEvent.click(screen.getByTestId('manage_subscription_button'));

    await waitFor(() => expect(screen.getByTestId('manage_subscription_button')).toHaveTextContent('Redirigiendo…'));
    expect(calls).toEqual([{ url: '/api/stripe/portal', method: 'POST' }]);
    expect(screen.getByTestId('manage_subscription_button')).toBeDisabled();
  });

  test('a refused portal session shows an alert and re-enables the button', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'no customer' }), { status: 400 })) as unknown as typeof fetch;
    renderWithProviders(<ManageSubscriptionButton />);

    fireEvent.click(screen.getByTestId('manage_subscription_button'));

    const alerta = await screen.findByTestId('manage_subscription_error_message');
    expect(alerta).toHaveTextContent('No se pudo abrir la gestión de tu suscripción. Inténtalo de nuevo.');
    expect(screen.getByTestId('manage_subscription_button')).not.toBeDisabled();
  });

  test('a response without a url is treated as a failure', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    renderWithProviders(<ManageSubscriptionButton />);

    fireEvent.click(screen.getByTestId('manage_subscription_button'));

    expect(await screen.findByTestId('manage_subscription_error_message')).toBeTruthy();
  });

  test('FRESCO-1285: after 20 s without an answer it says so and lets the person retry', async () => {
    const limit = new AbortController();
    const timeout = spyOn(AbortSignal, 'timeout').mockReturnValue(limit.signal);
    globalThis.fetch = (async (_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
    })) as unknown as typeof fetch;
    renderWithProviders(<ManageSubscriptionButton />);

    fireEvent.click(screen.getByTestId('manage_subscription_button'));
    await waitFor(() => expect(screen.getByTestId('manage_subscription_button')).toBeDisabled());
    expect(timeout).toHaveBeenCalledWith(20_000);
    limit.abort(new DOMException('The operation timed out.', 'TimeoutError'));

    expect(await screen.findByTestId('manage_subscription_error_message')).toHaveTextContent('Está tardando más de lo normal. Inténtalo de nuevo.');
    expect(screen.getByTestId('manage_subscription_button')).not.toBeDisabled();
    timeout.mockRestore();
  });

  test('a network failure shows the same alert', async () => {
    globalThis.fetch = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    renderWithProviders(<ManageSubscriptionButton />);

    fireEvent.click(screen.getByTestId('manage_subscription_button'));

    expect(await screen.findByTestId('manage_subscription_error_message')).toBeTruthy();
    expect(screen.getByTestId('manage_subscription_button')).toHaveTextContent('Gestionar mi suscripción');
  });
});
