import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

/**
 * Step definitions for `.context/qa/regression.feature` — @registro,
 * "Alta de nuevo usuario desde /signup".
 *
 * Unlike @login, this scenario does NOT hit the real Supabase signUp
 * endpoint. Manual testing on 2026-07-29 found this project's Supabase
 * instance makes a real call unsafe to run repeatedly:
 *   (a) `.test` / `.local` email domains are rejected by its email
 *       validator (`email_address_invalid`), so a fake-domain email can't
 *       be used;
 *   (b) a real-domain email triggers a genuine confirmation email send,
 *       which hits this project's very low free-tier rate limit almost
 *       immediately.
 * There is also no `service_role` key in `.env` to clean up the
 * `auth.users` rows a real signup would leave behind. So instead of calling
 * the real backend, we intercept the network request to Supabase Auth via
 * `page.route()`: the real form and the real client code in
 * `app/signup/page.tsx` (`createClient().auth.signUp(...)`) still run for
 * real in the browser, but the actual HTTP call is fulfilled with a canned
 * successful response — no real account created, no real email sent, fully
 * repeatable. Do NOT "fix" this into a real `auth.signUp()` call without
 * first provisioning a service_role key and a dedicated, non-rate-limited
 * test project.
 *
 * `ctx` lives in the shared `signupCtx` fixture (see `tests/fixtures.ts`) —
 * this file no longer defines its own custom `test` instance.
 */

const { Given, When, Then } = createBdd(test);

Given(/^que un visitante sin cuenta rellena email y contraseña en \/signup$/, async ({ page, signupCtx: ctx }) => {
  await page.goto('/signup');

  ctx.email = `qa-signup-${Date.now()}@example.com`;
  ctx.password = 'Qa-Signup-Password-123!';

  // Match on a regex, not a `**/auth/v1/signup` glob: FRESCO-264's
  // `emailRedirectTo` option makes supabase-js append `?redirect_to=...` to
  // the signup URL, and a trailing-segment glob never matches a URL with a
  // query string — the real call then slips past both the route mock and
  // this wait.
  const signupUrlPattern = /\/auth\/v1\/signup(\?|$)/;

  // Must be registered before the submit click (When step) fires the request.
  ctx.signupRequest = page.waitForRequest(signupUrlPattern);

  // Mock the network call to Supabase Auth — see file header for why.
  await page.route(signupUrlPattern, async (route) => {
    const fakeUserId = '00000000-0000-4000-8000-000000000000';
    const nowIso = new Date().toISOString();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'fake-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'fake-refresh-token',
        user: {
          id: fakeUserId,
          aud: 'authenticated',
          role: 'authenticated',
          email: ctx.email,
          email_confirmed_at: nowIso,
          phone: '',
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: {},
          // A non-empty identities array marks a genuinely NEW signup — an
          // empty array is Supabase's real signal for "this email already
          // belongs to a confirmed account" (FRESCO-24-adjacent fix in
          // app/signup/page.tsx checks exactly this). Must stay non-empty
          // here or this mocked "successful new signup" response gets
          // misread as the duplicate-email case.
          identities: [{
            identity_id: 'fake-identity-id',
            id: fakeUserId,
            user_id: fakeUserId,
            identity_data: { email: ctx.email, sub: fakeUserId },
            provider: 'email',
            last_sign_in_at: nowIso,
            created_at: nowIso,
            updated_at: nowIso,
          }],
          created_at: nowIso,
          updated_at: nowIso,
        },
      }),
    });
  });

  await page.getByTestId('email_input').fill(ctx.email);
  await page.getByTestId('password_input').fill(ctx.password);
  // Required since the ToS checkbox was added — handleSubmit's `if
  // (!acceptedTerms) return` blocks the real signUp() call (and this
  // route/waitForRequest never fires) before it ever reaches the network,
  // no matter how the rest of the form is filled.
  await page.getByTestId('accept_terms_checkbox').check();
});

When(/^confirma el formulario$/, async ({ page }) => {
  await page.getByTestId('signup_submit_button').click();
});

Then(/^se crea la cuenta en Supabase Auth$/, async ({ signupCtx: ctx }) => {
  // Proves the client asked Supabase Auth to create the account with the
  // exact data typed into the form — at the wire level, without a real
  // backend round-trip.
  const request = await ctx.signupRequest;
  const body = request.postDataJSON() as { email?: string, password?: string };
  expect(body.email).toBe(ctx.email);
  expect(body.password).toBe(ctx.password);
});

Then(/^el sistema le redirige a \/onboarding$/, async ({ page }) => {
  await page.waitForURL('**/onboarding');
});

// ── FRESCO-32: leaked-password rejection ────────────────────────────────────

// >= MIN_PASSWORD_LENGTH (10, FRESCO-363) so the length pre-check doesn't fire
// first — the HIBP range API is route-stubbed below with this string's own
// SHA-1 suffix, so any value reads as "breached".
const BREACHED_PASSWORD = 'breached-passw0rd';

async function sha1Suffix(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input));
  const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return hex.slice(5);
}

Given(/^que un visitante introduce una contraseña filtrada conocida en \/signup$/, async ({ page }) => {
  await page.goto('/signup');

  // A real request to Supabase Auth signup fails the test — the leaked-password
  // check must block before it. (No canned fulfill: reaching here IS the bug.)
  await page.route(/\/auth\/v1\/signup(\?|$)/, async () => {
    throw new Error('signUp was reached — the leaked-password check did not block it');
  });

  // Stub the Pwned Passwords range API so the test never depends on the real
  // HIBP dataset: return this password's own SHA-1 suffix with a real hit count.
  const suffix = await sha1Suffix(BREACHED_PASSWORD);
  await page.route('**/api.pwnedpasswords.com/range/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/plain', body: `${suffix}:98765\r\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:1` });
  });

  await page.getByTestId('email_input').fill(`qa-pwned-${Date.now()}@example.com`);
  await page.getByTestId('password_input').fill(BREACHED_PASSWORD);
  await page.getByTestId('accept_terms_checkbox').check();
});

Then(/^ve un aviso de que esa contraseña apareció en filtraciones y la cuenta no se crea$/, async ({ page }) => {
  await expect(page.getByTestId('signup_error_message')).toContainText('filtraciones');
  await expect(page).toHaveURL(/\/signup$/);
});

// ── @edge-case "Alta falla porque el email ya está registrado" (FRESCO-463) ──
//
// Supabase Auth's documented anti-enumeration behavior: `signUp()` with an
// email that already belongs to a confirmed account returns 200 with an
// obfuscated user object, `identities: []`, and no session — NOT an error.
// `app/signup/page.tsx` detects `data.user?.identities?.length === 0` and
// shows "Ya existe una cuenta con ese email." instead of dead-ending on
// /onboarding without a session. Same route-mock rationale as the happy
// path above (file header) — no real backend call, fully repeatable.

Given(/^que un visitante intenta darse de alta con un email ya existente$/, async ({ page }) => {
  await page.goto('/signup');

  const signupUrlPattern = /\/auth\/v1\/signup(\?|$)/;
  await page.route(signupUrlPattern, async (route) => {
    const nowIso = new Date().toISOString();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      // The bare user object Supabase returns for the duplicate-email case:
      // obfuscated, `identities: []`, no session envelope.
      body: JSON.stringify({
        id: '00000000-0000-4000-8000-0000000000ff',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'ya-registrado@example.com',
        phone: '',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
        identities: [],
        created_at: nowIso,
        updated_at: nowIso,
      }),
    });
  });

  await page.getByTestId('email_input').fill('ya-registrado@example.com');
  await page.getByTestId('password_input').fill('Qa-Existing-Account-123!');
  await page.getByTestId('accept_terms_checkbox').check();
});

Then(/^ve el mensaje de error que devuelve Supabase Auth$/, async ({ page }) => {
  await expect(page.getByTestId('signup_error_message')).toContainText('Ya existe una cuenta');
});

Then(/^no se crea una cuenta duplicada$/, async ({ page }) => {
  await expect(page).toHaveURL(/\/signup(\?|$)/);
  const cookies = await page.context().cookies();
  const hasSupabaseAuthCookie = cookies.some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'),
  );
  expect(hasSupabaseAuthCookie).toBe(false);
});
