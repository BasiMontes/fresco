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

// ── @edge-case "Inicio de sesión falla con credenciales incorrectas" (FRESCO-463) ──
//
// A real `signInWithPassword` call against Supabase Auth with a
// never-registered email: it returns `invalid_credentials` (400), which
// `lib/auth-errors.ts` maps to the Spanish "Email o contraseña incorrectos.".
// No account is touched and nothing is written, so this is safe to run
// against the shared project on every CI pass.

Given(/^que un usuario introduce un email o contraseña incorrectos$/, async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(`no-existe-${crypto.randomUUID()}@example.com`);
  await page.getByTestId('password_input').fill('Definitely-Wrong-000!');
});

When(/^confirma el formulario de \/login$/, async ({ page }) => {
  await page.getByTestId('login_submit_button').click();
});

Then(/^ve un mensaje de error claro$/, async ({ page }) => {
  await expect(page.getByTestId('login_error_message')).toBeVisible();
  await expect(page.getByTestId('login_error_message')).toContainText('incorrectos');
});

Then(/^permanece en \/login sin sesión activa$/, async ({ page }) => {
  await expect(page).toHaveURL(/\/login(\?|$)/);
  const cookies = await page.context().cookies();
  const hasSupabaseAuthCookie = cookies.some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'),
  );
  expect(hasSupabaseAuthCookie).toBe(false);
});

// ── @edge-case "Doble-click rápido en Iniciar sesión..." (FRESCO-463) ──
//
// FRESCO-114: `handleSubmit` sets a synchronous `isSubmittingRef` guard
// before its first `await`, so a second click in the same JS tick returns
// immediately. Two synchronous `HTMLButtonElement.click()` calls fire two
// `submit` events but must produce exactly ONE POST to `/auth/v1/token`.

Given(/^que un usuario completa email y contraseña válidos en \/login$/, async ({ page }) => {
  if (!process.env.DEV_USER_EMAIL || !process.env.DEV_USER_PASSWORD) {
    throw new Error('DEV_USER_EMAIL / DEV_USER_PASSWORD must be set in .env for this scenario.');
  }
  await page.goto('/login');
  await page.getByTestId('email_input').fill(process.env.DEV_USER_EMAIL);
  await page.getByTestId('password_input').fill(process.env.DEV_USER_PASSWORD);
});

const tokenRequestUrls: string[] = [];

When(/^hace dos clicks sincrónicos sobre "Iniciar sesión" sin esperar entre ambos$/, async ({ page }) => {
  tokenRequestUrls.length = 0;
  page.on('request', (request) => {
    if (/\/auth\/v1\/token\?grant_type=password/.test(request.url())) {
      tokenRequestUrls.push(request.url());
    }
  });
  // Two DOM clicks in a single evaluate call = same tick, no await between —
  // exactly what `disabled={isSubmitting}` alone (React re-render) misses.
  await page.getByTestId('login_submit_button').evaluate((btn: HTMLButtonElement) => {
    btn.click();
    btn.click();
  });
  await page.waitForURL('**/menu');
  // A late second request would arrive after navigation — give it a beat.
  await page.waitForTimeout(500);
});

Then(/^solo se dispara una llamada de autenticación$/, async () => {
  expect(tokenRequestUrls).toHaveLength(1);
});
