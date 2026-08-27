import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { currentUserId, getAccessToken, isoWeekOf, mondayOfWeekContaining, restHeaders } from '../test-helpers';

/**
 * Step definitions for `.context/qa/regression.feature` — @registro-progresivo,
 * the 4 scenarios `registro-progresivo.steps.ts` didn't cover: the
 * save-your-menu banner, and the email-conflict / reassignment trio
 * (FRESCO-19/FRESCO-20).
 *
 * FRESCO-89 (2026-08-07): the 3 conflict/reassignment scenarios below are
 * `test.skip()`'d, not deleted. Verified live (twice, including with the
 * original combined `updateUser({ email, password })` call) that Supabase
 * queues the pending email change with a 200 and no error even when the
 * target email already belongs to another confirmed account — the same
 * anti-enumeration behavior this suite already works around for `signUp()`.
 * `email_exists` now only surfaces inside `handleVerifyOtp`
 * (`app/signup/page.tsx`), which requires the real 6-digit code sent to
 * `PRO_TEST_USER_EMAIL`'s inbox — this test suite has no fixture that reads
 * a real inbox, for this account or any other. Automating this again needs
 * that fixture built first; until then it's manual QA
 * (`.context/qa/regression.feature`).
 */

const { Given, When, Then } = createBdd(test);

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const TIPOS = ['desayuno', 'comida', 'cena'] as const;

/**
 * Real anonymous session (FRESCO-17, ADR-0003).
 *
 * FRESCO-197: `/onboarding` now opens on the guest-vs-account choice
 * (`IdentityStep`). The anonymous session is created by clicking "Continuar
 * como invitada" (`signInAnonymously()`), not silently on mount — so click
 * it first, then wait for the real session cookie to land.
 */
async function ensureAnonymousSession(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/onboarding');
  await page.getByTestId('onboarding_continue_as_guest_button').click();
  await expect
    .poll(async () => {
      const cookies = await page.context().cookies();
      return cookies.some(cookie => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'));
    })
    .toBe(true);
}

/** Completes the 4-step onboarding + a REAL Gemini generation as the current anonymous guest. */
async function generateRealGuestMenu(page: import('@playwright/test').Page): Promise<void> {
  await ensureAnonymousSession(page);
  // 3 clicks reaches step 4 ("Paso 4 de 4"), where "Generar mi menú" lives
  // — onboarding gained a step (cocinas favoritas split out on its own)
  // since this was 2 clicks/3 steps.
  await page.getByTestId('next_button').click();
  await page.getByTestId('next_button').click();
  await page.getByTestId('next_button').click();
  // FRESCO-263/265: the weekly budget on step 4 is now required and gates
  // `generate_menu_button` (disabled while `!presupuestoValid`).
  await page.getByTestId('presupuesto_input').fill('80');
  await page.getByTestId('generate_menu_button').click();
  await page.waitForURL('**/menu', { timeout: 200_000 });
}

/**
 * Seeds `PRO_TEST_USER_EMAIL`'s CURRENT week plan with real recipes, so a
 * guest's own current-week generation genuinely conflicts with it — needed
 * for "la cuenta real conserva exactamente su plan original" to mean
 * anything (otherwise there's nothing on the real side to preserve).
 */
async function seedProUserCurrentWeekPlan(request: import('@playwright/test').APIRequestContext): Promise<void> {
  const accessToken = await getAccessToken(request, process.env.PRO_TEST_USER_EMAIL!, process.env.PRO_TEST_USER_PASSWORD!);
  const headers = restHeaders(accessToken);
  const userId = await currentUserId(request, accessToken);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  await request.delete(`${url}/rest/v1/meal_plans?id=not.is.null`, { headers });

  const recipesRes = await request.get(`${url}/rest/v1/recipes?select=id&limit=1`, { headers });
  const [recipe] = await recipesRes.json() as { id: string }[];
  if (!recipe) { throw new Error('No recipes available in the catalog to seed the fixture.'); }

  const monday = mondayOfWeekContaining(new Date());
  const planRes = await request.post(`${url}/rest/v1/meal_plans`, {
    headers: { ...headers, Prefer: 'return=representation' },
    data: {
      user_id: userId,
      semana_iso: isoWeekOf(new Date()),
      fecha_inicio: monday.toISOString().slice(0, 10),
      advertencias: [],
    },
  });
  if (!planRes.ok()) { throw new Error(`Failed to seed PRO_TEST_USER's plan: ${planRes.status()} ${await planRes.text()}`); }
  const [plan] = await planRes.json() as { id: string }[];

  const slots = DIAS.flatMap(dia => TIPOS.map(tipo => ({ meal_plan_id: plan.id, recipe_id: recipe.id, dia, tipo_plato: tipo })));
  const slotsRes = await request.post(`${url}/rest/v1/meal_plan_recipes`, { headers, data: slots });
  if (!slotsRes.ok()) { throw new Error(`Failed to seed PRO_TEST_USER's slots: ${slotsRes.status()} ${await slotsRes.text()}`); }
}

/** Drives the guest through /signup with PRO_TEST_USER_EMAIL until the conflict UI appears. */
async function reachEmailConflict(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/signup');
  await page.getByTestId('email_input').fill(process.env.PRO_TEST_USER_EMAIL!);
  await page.getByTestId('password_input').fill(`Qa-New-Password-${Date.now()}!`);
  await page.getByTestId('signup_submit_button').click();
  await expect(page.getByTestId('signup_email_conflict_message')).toBeVisible();
}

// ── "La invitada ve una invitación a guardar su menú" ──────────────────────

Given(/^que una invitada con sesión anónima tiene un menú ya generado$/, async ({ page }) => {
  test.setTimeout(240_000);
  await generateRealGuestMenu(page);
});

When(/^permanece en \/menu$/, async ({ page }) => {
  await page.goto('/menu');
});

Then(/^ve un banner "Crea una cuenta para no perder este menú"$/, async ({ page }) => {
  await expect(page.getByTestId('guest_save_menu_banner')).toContainText('Crea una cuenta para no perder este menú');
});

Then(/^un enlace a \/signup$/, async ({ page }) => {
  await expect(page.getByTestId('guest_save_menu_banner').getByRole('link')).toHaveAttribute('href', '/signup');
});

// ── "El email de conversión ya pertenece a una cuenta real distinta" ───────

Given(/^que una invitada intenta convertir su sesión con un email ya registrado$/, async ({ page }) => {
  test.skip(true, 'FRESCO-89: email_exists now only surfaces after a real OTP verification — no inbox-reading fixture in this suite (see file header).');
  await ensureAnonymousSession(page);
  await page.goto('/signup');
  await page.getByTestId('email_input').fill(process.env.PRO_TEST_USER_EMAIL!);
  await page.getByTestId('password_input').fill(`Qa-New-Password-${Date.now()}!`);
});

When(/^confirma el formulario de \/signup$/, async ({ page }) => {
  await page.getByTestId('signup_submit_button').click();
});

Then(/^ve un mensaje claro explicando el conflicto$/, async ({ page }) => {
  await expect(page.getByTestId('signup_email_conflict_message')).toBeVisible();
});

Then(/^se le ofrece continuar con la cuenta existente ingresando su contraseña$/, async ({ page }) => {
  await expect(page.getByTestId('conflict_password_input')).toBeVisible();
  await expect(page.getByTestId('signup_reassign_button')).toBeVisible();
});

// ── "La invitada resuelve el conflicto con la contraseña correcta..." ──────

Given(
  /^que la invitada ve el conflicto de email y conoce la contraseña de esa cuenta$/,
  async ({ page, request }) => {
    test.skip(true, 'FRESCO-89: email_exists now only surfaces after a real OTP verification — no inbox-reading fixture in this suite (see file header).');
    test.setTimeout(240_000);
    if (!process.env.PRO_TEST_USER_EMAIL || !process.env.PRO_TEST_USER_PASSWORD) {
      throw new Error('PRO_TEST_USER_EMAIL / PRO_TEST_USER_PASSWORD must be set in .env for this scenario.');
    }
    await seedProUserCurrentWeekPlan(request);
    await generateRealGuestMenu(page); // same current week -> a genuine conflict for the reassignment RPC to resolve
    await reachEmailConflict(page);
  },
);

When(/^la ingresa y confirma$/, async ({ page }) => {
  await page.getByTestId('conflict_password_input').fill(process.env.PRO_TEST_USER_PASSWORD!);
  await page.getByTestId('signup_reassign_button').click();
});

Then(/^sus datos de invitada \(menú, perfil\) se reasignan a la cuenta real$/, async ({ page }) => {
  await page.waitForURL('**/menu');
});

Then(/^su sesión anónima y perfil huérfano se eliminan$/, async () => {
  // Not independently checkable from the browser (no admin access from
  // Playwright) — covered by the manual live-verification note above
  // (SQL-confirmed in the original FRESCO-20 session) and by
  // reassign_guest_data()'s own migration, which deletes both in the same
  // transaction as the plan reassignment this scenario already exercises.
});

Then(/^la cuenta real conserva exactamente su plan original, sin duplicarse$/, async ({ request }) => {
  const accessToken = await getAccessToken(request, process.env.PRO_TEST_USER_EMAIL!, process.env.PRO_TEST_USER_PASSWORD!);
  const headers = restHeaders(accessToken);
  const semanaIso = isoWeekOf(new Date());
  const res = await request.get(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/meal_plans?select=id&semana_iso=eq.${semanaIso}`,
    { headers },
  );
  const plans = await res.json() as { id: string }[];
  expect(plans).toHaveLength(1);
});

Then(/^es redirigida a \/menu como la cuenta real$/, async ({ page }) => {
  expect(page.url()).toContain('/menu');
  // A real (non-anonymous) account never sees the guest save-your-menu banner.
  await expect(page.getByTestId('guest_save_menu_banner')).toHaveCount(0);
});

// ── "La invitada ingresa una contraseña incorrecta al intentar reasignar" ──

Given(/^que la invitada ve el conflicto de email$/, async ({ page }) => {
  test.skip(true, 'FRESCO-89: email_exists now only surfaces after a real OTP verification — no inbox-reading fixture in this suite (see file header).');
  await ensureAnonymousSession(page);
  await reachEmailConflict(page);
});

When(/^ingresa una contraseña incorrecta para esa cuenta$/, async ({ page }) => {
  await page.getByTestId('conflict_password_input').fill('Definitely-Wrong-Password-999!');
  await page.getByTestId('signup_reassign_button').click();
});

Then(/^ve un error claro$/, async ({ page }) => {
  await expect(page.getByTestId('signup_reassign_error_message')).toBeVisible();
});

Then(/^no se mueve ni se modifica ningún dato$/, async ({ page }) => {
  // Still on /signup, still showing the conflict UI — never silently
  // succeeded or navigated away.
  expect(page.url()).toContain('/signup');
  await expect(page.getByTestId('conflict_password_input')).toBeVisible();
});
