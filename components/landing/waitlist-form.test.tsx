import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { act, fireEvent, renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { WaitlistForm } from './waitlist-form';

/**
 * FRESCO-888 — the waitlist form joins only with an email AND the unticked-by-default
 * consent, posts `{ email, consent: true }`, and shows the outcome.
 */

const realFetch = globalThis.fetch;
let lastBody: unknown;

function stubFetch(ok: boolean) {
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    lastBody = JSON.parse(String(init?.body));
    return { ok } as Response;
  }) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  lastBody = undefined;
});

describe('WaitlistForm', () => {
  test('the submit stays disabled until there is an email and the consent is ticked', async () => {
    const user = setupUser();
    renderWithProviders(<WaitlistForm />);
    const submit = screen.getByTestId('waitlist_submit');

    expect(submit).toBeDisabled();
    await user.type(screen.getByTestId('waitlist_email_input'), 'ana@example.com');
    expect(submit).toBeDisabled();
    await user.click(screen.getByTestId('waitlist_consent_checkbox'));
    expect(submit).toBeEnabled();
  });

  test('posts the email with consent and confirms', async () => {
    stubFetch(true);
    const user = setupUser();
    renderWithProviders(<WaitlistForm />);

    await user.type(screen.getByTestId('waitlist_email_input'), 'ana@example.com');
    await user.click(screen.getByTestId('waitlist_consent_checkbox'));
    await user.click(screen.getByTestId('waitlist_submit'));

    expect(await screen.findByTestId('waitlist_joined')).toBeInTheDocument();
    expect(lastBody).toEqual({ email: 'ana@example.com', consent: true, captchaToken: null });
  });

  test('shows an error and keeps the form when the request fails', async () => {
    stubFetch(false);
    const user = setupUser();
    renderWithProviders(<WaitlistForm />);

    await user.type(screen.getByTestId('waitlist_email_input'), 'ana@example.com');
    await user.click(screen.getByTestId('waitlist_consent_checkbox'));
    await user.click(screen.getByTestId('waitlist_submit'));

    expect(await screen.findByTestId('waitlist_error')).toBeInTheDocument();
    expect(screen.getByTestId('waitlist_submit')).toBeEnabled();
  });
});

/**
 * FRESCO-1190: the form sits on the landing page, so Turnstile used to load for every visitor on mount, before the
 * cookie decision and without any interaction, while the privacy policy says it acts when signing in or signing up.
 * It now starts when somebody first touches the form. The Cloudflare script is replaced by a stub on
 * `window.turnstile`, so nothing loads and `render` says when the check really starts.
 */
describe('WaitlistForm and Turnstile (FRESCO-1190)', () => {
  let tokenCallback: ((token: string) => void) | null = null;
  const render = mock((_container: HTMLElement, options: { callback: (token: string) => void }) => {
    tokenCallback = options.callback;
    return 'widget-1';
  });
  const remove = mock(() => {});

  beforeEach(() => {
    tokenCallback = null;
    render.mockClear();
    window.turnstile = { render, remove };
  });
  afterEach(() => {
    delete window.turnstile;
  });

  test('with a site key, merely showing the form starts no check and loads nothing from Cloudflare', () => {
    renderWithProviders(<WaitlistForm captchaConfigured />);

    expect(render).not.toHaveBeenCalled();
    expect(screen.queryByTestId('captcha_widget')).toBeNull();
    expect(document.querySelector('script[src*="challenges.cloudflare.com"]')).toBeNull();
  });

  test('the first focus on the form starts the check', async () => {
    const user = setupUser();
    renderWithProviders(<WaitlistForm captchaConfigured />);

    await user.click(screen.getByTestId('waitlist_email_input'));

    await waitFor(() => expect(render).toHaveBeenCalledTimes(1));
  });

  test('typing without a prior focus (autofill) starts it too', async () => {
    renderWithProviders(<WaitlistForm captchaConfigured />);

    fireEvent.change(screen.getByTestId('waitlist_email_input'), { target: { value: 'ana@example.com' } });

    await waitFor(() => expect(render).toHaveBeenCalledTimes(1));
  });

  test('the submit waits for the token even with email and consent, then opens when it arrives', async () => {
    const user = setupUser();
    renderWithProviders(<WaitlistForm captchaConfigured />);
    await user.type(screen.getByTestId('waitlist_email_input'), 'ana@example.com');
    await user.click(screen.getByTestId('waitlist_consent_checkbox'));
    await waitFor(() => expect(render).toHaveBeenCalled());

    expect(screen.getByTestId('waitlist_submit')).toBeDisabled();

    act(() => tokenCallback?.('token-1'));

    await waitFor(() => expect(screen.getByTestId('waitlist_submit')).toBeEnabled());
  });

  test('the token travels with the request', async () => {
    stubFetch(true);
    const user = setupUser();
    renderWithProviders(<WaitlistForm captchaConfigured />);
    await user.type(screen.getByTestId('waitlist_email_input'), 'ana@example.com');
    await user.click(screen.getByTestId('waitlist_consent_checkbox'));
    await waitFor(() => expect(render).toHaveBeenCalled());
    act(() => tokenCallback?.('token-1'));
    await waitFor(() => expect(screen.getByTestId('waitlist_submit')).toBeEnabled());

    await user.click(screen.getByTestId('waitlist_submit'));

    expect(await screen.findByTestId('waitlist_joined')).toBeInTheDocument();
    expect(lastBody).toEqual({ email: 'ana@example.com', consent: true, captchaToken: 'token-1' });
  });

  test('without a site key nothing changes: no check at all, and the form submits as before', async () => {
    stubFetch(true);
    const user = setupUser();
    renderWithProviders(<WaitlistForm captchaConfigured={false} />);

    await user.type(screen.getByTestId('waitlist_email_input'), 'ana@example.com');
    await user.click(screen.getByTestId('waitlist_consent_checkbox'));

    expect(render).not.toHaveBeenCalled();
    expect(screen.getByTestId('waitlist_submit')).toBeEnabled();
  });
});
