import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';

/**
 * FRESCO-794 (ADR-0040) — the identity step asks for the age confirmation and
 * the Terms / Privacy acceptance before it creates anything, and records them as
 * soon as a session exists. Only the Supabase client is faked; `/api/consents`
 * is a stubbed `fetch`.
 */

const signInAnonymously = mock(async () => ({ error: null as unknown }));
const signUp = mock(async (_args: unknown): Promise<{ data: { user: unknown, session: unknown }, error: unknown }> => ({ data: { user: { identities: [{}] }, session: null }, error: null }));
const updateUser = mock(async (_attrs: unknown) => ({ data: {}, error: null }));
let session: unknown = null;
let userMetadata: unknown = {};

void mock.module('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session } }),
      getUser: async () => ({ data: { user: { user_metadata: userMetadata } } }),
      signInAnonymously,
      signUp,
      updateUser,
    },
  }),
}));

const { IdentityStep } = await import('./identity-step');

const realFetch = globalThis.fetch;
let consentCalls: unknown[] = [];
let consentStatus = 200;

beforeEach(() => {
  signInAnonymously.mockClear();
  signUp.mockClear();
  updateUser.mockClear();
  session = null;
  userMetadata = {};
  consentCalls = [];
  consentStatus = 200;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    if (url === '/api/consents') {
      consentCalls.push(JSON.parse(init.body as string));
      return new Response(null, { status: consentStatus });
    }
    return new Response(null, { status: 404 }); // breached-password check fails open
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('IdentityStep — guest', () => {
  test('without the consents ticked, it says what is missing and creates nothing', async () => {
    const onResolved = mock(() => {});
    const user = setupUser();
    renderWithProviders(<IdentityStep onResolved={onResolved} />);

    await user.click(screen.getByTestId('onboarding_continue_as_guest_button'));

    expect(screen.getByTestId('confirm_age_error_message')).toBeTruthy();
    expect(screen.getByTestId('accept_terms_error_message')).toBeTruthy();
    expect(signInAnonymously).not.toHaveBeenCalled();
    expect(consentCalls).toHaveLength(0);
    expect(onResolved).not.toHaveBeenCalled();
  });

  test('neither checkbox starts ticked', () => {
    renderWithProviders(<IdentityStep onResolved={mock(() => {})} />);

    expect(screen.getByTestId<HTMLInputElement>('confirm_age_checkbox').checked).toBe(false);
    expect(screen.getByTestId<HTMLInputElement>('accept_terms_checkbox').checked).toBe(false);
  });

  test('with only one ticked, it still refuses and names the other', async () => {
    const user = setupUser();
    renderWithProviders(<IdentityStep onResolved={mock(() => {})} />);

    await user.click(screen.getByTestId('confirm_age_checkbox'));
    await user.click(screen.getByTestId('onboarding_continue_as_guest_button'));

    expect(screen.queryByTestId('confirm_age_error_message')).toBeNull();
    expect(screen.getByTestId('accept_terms_error_message')).toBeTruthy();
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  test('ticked: starts the guest session, records age + Terms + Privacy, then resolves', async () => {
    const onResolved = mock(() => {});
    const user = setupUser();
    renderWithProviders(<IdentityStep onResolved={onResolved} />);

    await user.click(screen.getByTestId('confirm_age_checkbox'));
    await user.click(screen.getByTestId('accept_terms_checkbox'));
    await user.click(screen.getByTestId('onboarding_continue_as_guest_button'));

    await waitFor(() => expect(onResolved).toHaveBeenCalled());
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    expect(consentCalls).toEqual([{ kinds: ['age_14', 'terms', 'privacy'] }]);
  });

  test('a failed consent write blocks progress, and the retry reuses the guest session', async () => {
    consentStatus = 500;
    const onResolved = mock(() => {});
    const user = setupUser();
    renderWithProviders(<IdentityStep onResolved={onResolved} />);

    await user.click(screen.getByTestId('confirm_age_checkbox'));
    await user.click(screen.getByTestId('accept_terms_checkbox'));
    await user.click(screen.getByTestId('onboarding_continue_as_guest_button'));

    await waitFor(() => expect(screen.getByTestId('onboarding_identity_error_message')).toBeTruthy());
    expect(onResolved).not.toHaveBeenCalled();
    expect(signInAnonymously).toHaveBeenCalledTimes(1);

    // The guest session now exists; the retry must not burn another anonymous sign-in.
    session = { user: { id: 'guest' } };
    consentStatus = 200;
    await user.click(screen.getByTestId('onboarding_continue_as_guest_button'));

    await waitFor(() => expect(onResolved).toHaveBeenCalled());
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });
});

describe('IdentityStep — account', () => {
  async function openAccountForm() {
    const user = setupUser();
    renderWithProviders(<IdentityStep onResolved={mock(() => {})} />);
    await user.click(screen.getByTestId('onboarding_create_account_button'));
    return user;
  }

  async function fillCredentials(user: ReturnType<typeof setupUser>) {
    await user.type(screen.getByTestId('email_input'), 'nueva@example.com');
    await user.type(screen.getByTestId('password_input'), 'una-clave-larga-123');
  }

  test('without the consents ticked, it does not call signUp', async () => {
    const user = await openAccountForm();
    await fillCredentials(user);

    await user.click(screen.getByTestId('onboarding_create_account_submit_button'));

    expect(screen.getByTestId('confirm_age_error_message')).toBeTruthy();
    expect(screen.getByTestId('accept_terms_error_message')).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });

  test('ticked: signUp carries the consents in the metadata, since there is usually no session yet', async () => {
    const user = await openAccountForm();
    await fillCredentials(user);
    await user.click(screen.getByTestId('confirm_age_checkbox'));
    await user.click(screen.getByTestId('accept_terms_checkbox'));

    await user.click(screen.getByTestId('onboarding_create_account_submit_button'));

    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
    const args = signUp.mock.calls[0][0] as { options: { data: Record<string, unknown> } };
    expect(args.options.data).toEqual({ consent_pending: ['age_14', 'terms', 'privacy'] });
    // Pending email confirmation: no session, so nothing is posted yet.
    expect(consentCalls).toHaveLength(0);
  });

  test('when signUp returns a session, the parked consents are recorded straight away', async () => {
    signUp.mockResolvedValueOnce({ data: { user: { identities: [{}] }, session: { access_token: 't' } }, error: null });
    userMetadata = { consent_pending: ['age_14', 'terms', 'privacy'] };
    const user = await openAccountForm();
    await fillCredentials(user);
    await user.click(screen.getByTestId('confirm_age_checkbox'));
    await user.click(screen.getByTestId('accept_terms_checkbox'));

    await user.click(screen.getByTestId('onboarding_create_account_submit_button'));

    await waitFor(() => expect(consentCalls).toEqual([{ kinds: ['age_14', 'terms', 'privacy'] }]));
    expect(updateUser).toHaveBeenCalledWith({ data: { consent_pending: null } });
  });
});
