import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

/**
 * Step definitions for `.context/qa/regression.feature` — @registro-progresivo,
 * "La invitada convierte su sesión anónima en una cuenta real".
 *
 * The "Cuando confirma el formulario" step is shared with @registro
 * (defined in signup.steps.ts) — Cucumber matches step text across every
 * loaded step file, not per-scenario, so it isn't redefined here.
 *
 * Real anonymous session (FRESCO-17, ADR-0003) and a real generated menu —
 * needed so "conserva el menú que ya había generado como invitada" has
 * something real to prove. Only the final `updateUser({ email, password })`
 * call is mocked, same criterion already established for @registro: it
 * would send a genuine confirmation email against this project's very low
 * free-tier rate limit otherwise.
 */

const { Given, Then } = createBdd(test);

Given(
  /^que una invitada con sesión anónima y un email nuevo rellena email y contraseña en \/signup$/,
  async ({ page, signupCtx: ctx }) => {
    // Generation itself is fast post-ADR-0005 (~2-3s, deterministic slot
    // selection, no Gemini call for a guest — the Pro learning explanation
    // is the only Gemini call left, and guests are never Pro). The margin
    // here covers the rest of the scenario (anonymous session bootstrap,
    // the real /signup navigation, the mocked conversion call), not a long
    // generation wait.
    test.setTimeout(60_000);

    await page.goto('/onboarding');
    // FRESCO-17's anonymous sign-in fires from a mount effect, not before
    // paint — a real human filling 3 steps always outruns it, but a script
    // clicking through in milliseconds can win the race and reach "Generar
    // mi menú" with no session yet (found live: the generate call never
    // even fired). Wait for the real session cookie first.
    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();
        return cookies.some(cookie => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'));
      })
      .toBe(true);
    await page.getByTestId('next_button').click();
    await page.getByTestId('next_button').click();
    await page.getByTestId('generate_menu_button').click();
    // ~2-3s observed live post-ADR-0005 — margin kept generous for CI
    // variance, not tuned to the old thinking-model latency.
    await page.waitForURL('**/menu', { timeout: 20_000 });

    await page.goto('/signup');

    ctx.email = `qa-convert-${Date.now()}@example.com`;
    ctx.password = 'Qa-Convert-Password-123!';

    ctx.signupRequest = page.waitForRequest(request =>
      request.url().includes('/auth/v1/user') && request.method() === 'PUT');

    // Mock only the conversion call — see file header for why.
    await page.route('**/auth/v1/user', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }
      const fakeUserId = '00000000-0000-4000-9000-000000000000';
      const nowIso = new Date().toISOString();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: fakeUserId,
          aud: 'authenticated',
          role: 'authenticated',
          email: ctx.email,
          email_confirmed_at: nowIso,
          is_anonymous: false,
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: {},
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
        }),
      });
    });

    await page.getByTestId('email_input').fill(ctx.email);
    await page.getByTestId('password_input').fill(ctx.password);
  },
);

Then(/^su sesión anónima se actualiza a una cuenta real \(mismo user_id\)$/, async ({ page, signupCtx: ctx }) => {
  const request = await ctx.signupRequest;
  const body = request.postDataJSON() as { email?: string, password?: string };
  expect(body.email).toBe(ctx.email);
  expect(body.password).toBe(ctx.password);
  await page.waitForURL('**/menu');
});

Then(/^conserva el menú que ya había generado como invitada$/, async ({ page }) => {
  // Real content check — the menu generated in the Given step is still
  // there, not a fresh empty state (which would mean the conversion lost
  // the guest's data instead of preserving it).
  await expect(page.getByText('Hoy')).toBeVisible();
  await expect(page.getByTestId('menu_empty_state')).toHaveCount(0);
});
