import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

/**
 * Step definitions for `.context/qa/regression.feature` — @login,
 * "Inicio de sesión correcto con credenciales válidas".
 *
 * Credentials come from the QA test user provisioned in `.env`
 * (`DEV_USER_EMAIL` / `DEV_USER_PASSWORD`) — never hardcoded here.
 */
const { Given, When, Then } = createBdd();

Given(/^que existe un usuario registrado con email y contraseña válidos$/, async () => {
  // Precondition only: the QA test user already exists in Supabase Auth,
  // provisioned out of band via .env. Fail fast if the fixture is missing.
  if (!process.env.DEV_USER_EMAIL || !process.env.DEV_USER_PASSWORD) {
    throw new Error(
      'DEV_USER_EMAIL / DEV_USER_PASSWORD must be set in .env for this scenario.',
    );
  }
});

When(/^introduce esas credenciales en \/login y confirma el formulario$/, async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(process.env.DEV_USER_EMAIL!);
  await page.getByTestId('password_input').fill(process.env.DEV_USER_PASSWORD!);
  await page.getByTestId('login_submit_button').click();
});

Then(/^el sistema le redirige a \/menu$/, async ({ page }) => {
  await page.waitForURL('**/menu');
});

Then(/^la sesión queda activa$/, async ({ page }) => {
  // @supabase/ssr's browser client stores the session in a cookie
  // (`sb-<project-ref>-auth-token`), not localStorage — assert it exists.
  const cookies = await page.context().cookies();
  const hasSupabaseAuthCookie = cookies.some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'),
  );
  expect(hasSupabaseAuthCookie).toBe(true);
});
