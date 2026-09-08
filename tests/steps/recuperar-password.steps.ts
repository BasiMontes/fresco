import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

/**
 * Step definitions for `.context/qa/regression.feature` — @login
 * @recuperar-password, "Solicitar el enlace de recuperación de contraseña".
 *
 * FRESCO-352 (ratchet de FRESCO-321). Happy path of the password-recovery
 * request form at `/forgot-password`. Supabase Auth never actually sends an
 * email here (`resetPasswordForEmail` is fire-and-forget and the UI shows an
 * anti-enumeration message regardless), so this only asserts the form
 * accepts a real registered email and renders the generic confirmation — the
 * edge-case sibling ("no revela si el email existe") stays manual.
 */

const { Given, When, Then } = createBdd(test);

interface Ctx { email: string }
const ctx: Ctx = { email: '' };

Given(/^que un usuario visita \/forgot-password$/, async ({ page, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.email = testUser.email;
  await page.goto('/forgot-password');
});

When(/^introduce su email registrado y confirma el formulario$/, async ({ page }) => {
  await page.getByTestId('forgot_password_email_input').fill(ctx.email);
  await page.getByTestId('forgot_password_submit_button').click();
});

Then(/^ve un mensaje genérico confirmando que si la cuenta existe, recibirá un enlace$/, async ({ page }) => {
  await expect(page.getByTestId('forgot_password_confirmation_message')).toBeVisible();
  await expect(page.getByTestId('forgot_password_confirmation_message')).toContainText('Si existe una cuenta con ese email');
});

// The exact copy `/forgot-password` shows after a submit — asserted verbatim
// by the anti-enumeration scenario to prove it does NOT vary with whether
// the email has an account.
const GENERIC_CONFIRMATION
  = 'Si existe una cuenta con ese email, te llegará un enlace para restablecer tu contraseña en unos minutos.';

// ── @edge-case "no revela si el email existe (anti-enumeración)" (FRESCO-463) ──
//
// `resetPasswordForEmail` is fire-and-forget and `app/forgot-password/page.tsx`
// renders the same confirmation regardless of the result — Supabase itself
// never reveals whether the address has an account. An unregistered email
// triggers no send, so this is safe to run against the shared project.

Given(/^que un visitante introduce un email que no está registrado en \/forgot-password$/, async ({ page }) => {
  await page.goto('/forgot-password');
  await page.getByTestId('forgot_password_email_input').fill(`nunca-registrado-${crypto.randomUUID()}@example.com`);
});

When(/^confirma el formulario de recuperación$/, async ({ page }) => {
  await page.getByTestId('forgot_password_submit_button').click();
});

Then(/^ve exactamente el mismo mensaje genérico que con un email real$/, async ({ page }) => {
  await expect(page.getByTestId('forgot_password_confirmation_message')).toHaveText(GENERIC_CONFIRMATION);
});

// ── @edge-case "exige un formato válido antes de enviar" (FRESCO-463) ──
//
// The email field is `required type="email"`, so submitting it empty is
// blocked by the browser's native constraint validation — `handleSubmit`
// never runs and no POST to `/auth/v1/recover` is made.

const recoverRequestUrls: string[] = [];

Given(/^que un usuario deja vacío el campo de email en \/forgot-password$/, async ({ page }) => {
  await page.goto('/forgot-password');
  await page.getByTestId('forgot_password_email_input').fill('');
});

When(/^intenta confirmar el formulario de recuperación$/, async ({ page }) => {
  recoverRequestUrls.length = 0;
  page.on('request', (request) => {
    if (/\/auth\/v1\/recover(?:\?|$)/.test(request.url())) {
      recoverRequestUrls.push(request.url());
    }
  });
  await page.getByTestId('forgot_password_submit_button').click();
  await page.waitForTimeout(500);
});

Then(/^el navegador bloquea el envío con la validación nativa del campo \(required \+ type=email\), sin llamar al backend$/, async ({ page }) => {
  expect(recoverRequestUrls).toHaveLength(0);
  const emailValid = await page.getByTestId('forgot_password_email_input').evaluate(
    (el: HTMLInputElement) => el.validity.valid,
  );
  expect(emailValid).toBe(false);
  await expect(page.getByTestId('forgot_password_confirmation_message')).toHaveCount(0);
});
