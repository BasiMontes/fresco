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
