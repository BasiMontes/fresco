import type { PostHogProvider as PostHogProviderType } from './posthog-provider';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import posthog from 'posthog-js';
import { CookieConsentProvider, useCookieConsent } from '@/components/legal/cookie-consent-context';
import { clearAllCookies, renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';

/** Exposes accept/reject as clickable buttons so a test can drive a full decision cycle. */
function ConsentControls() {
  const { accept, reject } = useCookieConsent();
  return (
    <>
      <button type="button" data-testid="test_accept" onClick={accept}>accept</button>
      <button type="button" data-testid="test_reject" onClick={reject}>reject</button>
    </>
  );
}

/**
 * FRESCO-428 / ADR-0025 — `posthog.init()` must never fire before the
 * consent decision is `'accepted'`. `posthog-js` is globally stubbed in
 * `bun-test-setup.ts`; `spyOn` wraps that same stub instance so call counts
 * are real assertions, not just "does not throw".
 */
describe('PostHogProvider — consent gate', () => {
  // FRESCO-796: set per test, not while the describe is collected. `process.env`
  // is shared by every test file a worker runs, and `lib/posthog/*.test.ts`
  // delete this key, so a value set at collection time was gone by the time
  // these tests ran whenever one of those files ran in between.
  const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  // FRESCO-796: the provider keeps an `initialized` flag at module level (so
  // StrictMode cannot init twice). Whichever test accepted consent first set it
  // for the rest of the file, so "calls init" failed whenever another accepting
  // test ran before it. A fresh instance per test (the query string makes Bun
  // load the module again) gives every test the first-render state.
  let freshCount = 0;
  let PostHogProvider: typeof PostHogProviderType;
  beforeEach(async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
    // FRESCO-1024: the provider calls `watchAuthState`, which reaches the Supabase client. A file that
    // ran earlier and mocked `@/lib/supabase/client` without `onAuthStateChange` made that call reject
    // after the test, and Bun charged the unhandled error to these tests. Own a complete client here.
    void mock.module('@/lib/supabase/client', () => ({
      createClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: null } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        },
      }),
    }));
    freshCount += 1;
    ({ PostHogProvider } = await import(`./posthog-provider?fresh=${freshCount}`) as typeof import('./posthog-provider'));
  });

  // The "regression" test below is the only one in this file that actually
  // writes the consent cookie (via accept()/reject() clicks) — clean up so
  // it can't leak into another test FILE's assertions. `bun test` runs all
  // given files in one process sharing the same happy-dom `document`, in
  // file-path order rather than CLI-argument order — found live: this test
  // running before `lib/consent/cookie-consent.test.ts` alphabetically left
  // `fresco_cookie_consent=accepted` on `document.cookie`, failing that
  // file's very first "starts with no decision" assertion.
  afterEach(() => {
    clearAllCookies();
    if (originalKey === undefined) {
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    }
    else {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey;
    }
  });

  test('does not call posthog.init while consent is undecided', () => {
    const initSpy = spyOn(posthog, 'init');

    renderWithProviders(
      <CookieConsentProvider initialDecision={null}>
        <PostHogProvider>
          <div>child</div>
        </PostHogProvider>
      </CookieConsentProvider>,
    );

    expect(initSpy).not.toHaveBeenCalled();
    initSpy.mockRestore();
  });

  test('does not call posthog.init while consent is rejected', () => {
    const initSpy = spyOn(posthog, 'init');

    renderWithProviders(
      <CookieConsentProvider initialDecision="rejected">
        <PostHogProvider>
          <div>child</div>
        </PostHogProvider>
      </CookieConsentProvider>,
    );

    expect(initSpy).not.toHaveBeenCalled();
    initSpy.mockRestore();
  });

  test('calls posthog.init once consent is accepted', async () => {
    const initSpy = spyOn(posthog, 'init');

    renderWithProviders(
      <CookieConsentProvider initialDecision="accepted">
        <PostHogProvider>
          <div>child</div>
        </PostHogProvider>
      </CookieConsentProvider>,
    );

    // FRESCO-496: `posthog.init()` now fires inside a lazy
    // `import('posthog-js')`'s `.then()` — flush the microtask queue first.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(initSpy).toHaveBeenCalled();
    initSpy.mockRestore();
  });

  test('re-accepting after a withdrawal calls opt_in_capturing (regression)', async () => {
    // Found in code review (FRESCO-428): once `posthog.init()` has fired
    // once, the module-level `initialized` flag skips it on every later
    // accept — so nothing reversed the `opt_out_capturing()` a withdrawal
    // calls, and capture silently stayed off for a reject-then-accept cycle.
    const optInSpy = spyOn(posthog, 'opt_in_capturing');
    const user = setupUser();

    renderWithProviders(
      <CookieConsentProvider initialDecision={null}>
        <PostHogProvider>
          <div>child</div>
        </PostHogProvider>
        <ConsentControls />
      </CookieConsentProvider>,
    );

    await user.click(screen.getByTestId('test_accept'));
    await user.click(screen.getByTestId('test_reject'));
    await user.click(screen.getByTestId('test_accept'));
    // FRESCO-496: opt_in_capturing() now fires inside a lazy
    // `import('posthog-js')`'s `.then()` — flush the microtask queue first.
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(optInSpy).toHaveBeenCalled();
    optInSpy.mockRestore();
  });
});

/**
 * FRESCO-366 / A4-B4, FRESCO-240 — identity linkage. The provider listens to Supabase auth changes once
 * consent is accepted and links the browser to the user, with `plan` / `is_guest` as person properties.
 */
describe('PostHogProvider — identity linkage', () => {
  type AuthHandler = (event: string, session: { user: { id: string, is_anonymous?: boolean } } | null) => void;

  const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  let PostHogProvider: typeof PostHogProviderType;
  let emit: AuthHandler;
  let profileReads: number;
  let storedPlan: string | null;

  beforeEach(async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
    profileReads = 0;
    storedPlan = 'pro';
    emit = () => { throw new Error('the provider never subscribed to auth changes'); };
    void mock.module('@/lib/supabase/client', () => ({
      createClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: null } }),
          onAuthStateChange: (handler: AuthHandler) => {
            emit = handler;
            return { data: { subscription: { unsubscribe: () => {} } } };
          },
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                profileReads += 1;
                return { data: storedPlan ? { plan: storedPlan } : null };
              },
            }),
          }),
        }),
      }),
    }));
    // The plain module, not a `?fresh=` copy: nothing here depends on the `initialized` flag, and the
    // coverage report only attributes lines to the real path.
    ({ PostHogProvider } = await import('./posthog-provider'));
  });

  afterEach(() => {
    clearAllCookies();
    if (originalKey === undefined) {
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    }
    else {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey;
    }
  });

  async function mountAccepted() {
    renderWithProviders(
      <CookieConsentProvider initialDecision="accepted">
        <PostHogProvider>
          <div>child</div>
        </PostHogProvider>
      </CookieConsentProvider>,
    );
    // The auth listener is opened after two lazy imports: wait until it is wired.
    await waitFor(() => expect(() => emit('TEST_PROBE', null)).not.toThrow());
  }

  const registered = { user: { id: 'user-1' } };
  const guest = { user: { id: 'guest-1', is_anonymous: true } };

  test('links a registered user with their plan as a person property', async () => {
    const identifySpy = spyOn(posthog, 'identify');
    await mountAccepted();

    emit('SIGNED_IN', registered);

    await waitFor(() => expect(identifySpy).toHaveBeenCalledWith('user-1', { is_guest: false, plan: 'pro' }));
    identifySpy.mockRestore();
  });

  test('a guest is linked as a guest on the free plan, without reading a profile', async () => {
    const identifySpy = spyOn(posthog, 'identify');
    await mountAccepted();

    emit('SIGNED_IN', guest);

    await waitFor(() => expect(identifySpy).toHaveBeenCalledWith('guest-1', { is_guest: true, plan: 'free', signup_method: 'guest' }));
    expect(profileReads).toBe(0);
    identifySpy.mockRestore();
  });

  test('the same user is linked once, however many auth events repeat', async () => {
    const identifySpy = spyOn(posthog, 'identify');
    await mountAccepted();

    emit('SIGNED_IN', registered);
    emit('TOKEN_REFRESHED', registered);
    emit('USER_UPDATED', registered);
    await waitFor(() => expect(identifySpy).toHaveBeenCalledTimes(1));
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(identifySpy).toHaveBeenCalledTimes(1);
    expect(profileReads).toBe(1);
    identifySpy.mockRestore();
  });

  test('signing out forgets the user, so the next sign-in is linked again', async () => {
    const identifySpy = spyOn(posthog, 'identify');
    await mountAccepted();

    emit('SIGNED_IN', registered);
    await waitFor(() => expect(identifySpy).toHaveBeenCalledTimes(1));

    emit('SIGNED_OUT', null);
    emit('SIGNED_IN', registered);

    await waitFor(() => expect(identifySpy).toHaveBeenCalledTimes(2));
    identifySpy.mockRestore();
  });

  test('a returning user with a stored session counts as a session start, exactly on INITIAL_SESSION', async () => {
    const captureSpy = spyOn(posthog, 'capture');
    await mountAccepted();

    emit('SIGNED_IN', registered);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(captureSpy).not.toHaveBeenCalledWith('session_started', undefined);

    emit('INITIAL_SESSION', registered);
    await waitFor(() => expect(captureSpy).toHaveBeenCalledWith('session_started', undefined));
    captureSpy.mockRestore();
  });

  test('an INITIAL_SESSION with no session records nothing', async () => {
    const captureSpy = spyOn(posthog, 'capture');
    const identifySpy = spyOn(posthog, 'identify');
    await mountAccepted();

    emit('INITIAL_SESSION', null);
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(captureSpy).not.toHaveBeenCalled();
    expect(identifySpy).not.toHaveBeenCalled();
    captureSpy.mockRestore();
    identifySpy.mockRestore();
  });

  test('a failing posthog init is logged and never breaks the page', async () => {
    // First load calls init(); a later one (the module is shared in this describe) calls opt_in_capturing().
    const initSpy = spyOn(posthog, 'init').mockImplementation(() => { throw new Error('sdk exploded'); });
    const optInSpy = spyOn(posthog, 'opt_in_capturing').mockImplementation(() => { throw new Error('sdk exploded'); });
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    renderWithProviders(
      <CookieConsentProvider initialDecision="accepted">
        <PostHogProvider>
          <div data-testid="still_here">child</div>
        </PostHogProvider>
      </CookieConsentProvider>,
    );

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('[posthog-provider] failed to load posthog-js', expect.any(Error)));
    expect(screen.getByTestId('still_here')).toBeInTheDocument();
    initSpy.mockRestore();
    optInSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('without a PostHog key nothing loads, even with consent accepted', async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const initSpy = spyOn(posthog, 'init');

    renderWithProviders(
      <CookieConsentProvider initialDecision="accepted">
        <PostHogProvider>
          <div>child</div>
        </PostHogProvider>
      </CookieConsentProvider>,
    );
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(initSpy).not.toHaveBeenCalled();
    expect(() => emit('TEST_PROBE', null)).toThrow('never subscribed');
    initSpy.mockRestore();
  });
});
