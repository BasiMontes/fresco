import { afterEach, describe, expect, test } from 'bun:test';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
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
    expect(lastBody).toEqual({ email: 'ana@example.com', consent: true });
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
