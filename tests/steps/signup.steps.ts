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

  // Must be registered before the submit click (When step) fires the request.
  ctx.signupRequest = page.waitForRequest('**/auth/v1/signup');

  // Mock the network call to Supabase Auth — see file header for why.
  await page.route('**/auth/v1/signup', async (route) => {
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
          identities: [],
          created_at: nowIso,
          updated_at: nowIso,
        },
      }),
    });
  });

  await page.getByTestId('email_input').fill(ctx.email);
  await page.getByTestId('password_input').fill(ctx.password);
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
