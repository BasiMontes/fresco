import type { Page } from '@playwright/test';
import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { restHeaders } from '../test-helpers';
import { seedFullWeekMenu } from '../test-user-factory';

/**
 * Step definitions for `.context/qa/regression.feature` — @panel-inicio, the
 * happy paths of the Inicio dashboard at `/menu` (EPIC-FRESCO-56/57):
 * personalised greeting, header-icon navigation, the calendar-suggestion
 * banner, the available-recipes card, the three orientation estimates, and
 * the "latest recipes" section.
 *
 * FRESCO-355 (3rd batch of the FRESCO-321 ratchet). Throwaway free-plan
 * factory user (FRESCO-308) with a seeded current-week menu.
 */

const { Given, When, Then } = createBdd(test);

interface Ctx { testUser: TestUser | null }
const ctx: Ctx = { testUser: null };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

async function loginAndGoToInicio(page: Page, testUser: TestUser): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(testUser.email);
  await page.getByTestId('password_input').fill(testUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL(url => /\/(?:menu|onboarding)/.test(url.pathname));
  await page.goto('/menu');
}

async function setProfile(testUser: TestUser, patch: Record<string, unknown>): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${testUser.id}`, {
    method: 'PATCH',
    headers: restHeaders(testUser.accessToken),
    body: JSON.stringify(patch),
  });
}

Given(/^que el usuario guardó su nombre en \/profile$/, async ({ request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await seedFullWeekMenu(request, testUser);
  await setProfile(testUser, { nombre: 'Laura' });
});

Given(/^que el usuario está en \/menu \(Inicio\)$/, async ({ page, request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await seedFullWeekMenu(request, testUser);
  await loginAndGoToInicio(page, testUser);
});

Given(/^que el usuario está en \/menu \(Inicio\) y ve el banner de sugerencia$/, async ({ page, request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await seedFullWeekMenu(request, testUser);
  await loginAndGoToInicio(page, testUser);
  await expect(page.getByTestId('calendar_suggestion_banner')).toBeVisible();
});

Given(/^que el usuario tiene alérgenos e ingredientes marcados en su perfil$/, async ({ request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await seedFullWeekMenu(request, testUser);
  await setProfile(testUser, { alergenos: ['gluten', 'pescado'] });
});

Given(/^que el usuario ve la card de recetas disponibles en Inicio$/, async ({ page, request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await seedFullWeekMenu(request, testUser);
  await loginAndGoToInicio(page, testUser);
  await expect(page.getByTestId('available_recipes_card')).toBeVisible();
});

Given(/^que Laura abre Inicio$/, async ({ page, request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await seedFullWeekMenu(request, testUser);
  await loginAndGoToInicio(page, testUser);
});

Given(/^que Laura ve la sección de últimas recetas en Inicio$/, async ({ page, request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await seedFullWeekMenu(request, testUser);
  await loginAndGoToInicio(page, testUser);
  await expect(page.getByTestId('latest_recipes_section')).toBeVisible();
});

// ── When ─────────────────────────────────────────────────────────────────

When(/^abre \/menu \(Inicio\)$/, async ({ page }) => {
  await loginAndGoToInicio(page, ctx.testUser!);
});

When(/^toca el icono de favoritos o el de notificaciones de la cabecera$/, async ({ page }) => {
  await page.getByTestId('favoritos_button').click();
});

When(/^toca el botón "Ver mi plan semanal"$/, async ({ page }) => {
  await page.getByTestId('calendar_suggestion_banner').getByRole('link', { name: 'Ver mi plan semanal' }).click();
});

When(/^toca la card$/, async ({ page }) => {
  await page.getByTestId('available_recipes_card').click();
});

When(/^mira las cards de estimación$/, async () => { /* asserted in Then */ });

When(/^mira la sección de últimas recetas$/, async () => { /* asserted in Then */ });

When(/^toca "Ver todas"$/, async ({ page }) => {
  await page.getByTestId('latest_recipes_section').getByRole('link', { name: 'Ver todas' }).click();
});

// ── Then ─────────────────────────────────────────────────────────────────

Then(/^ve el saludo con su nombre real \("¡Hola, <nombre>!"\)$/, async ({ page }) => {
  await expect(page.getByRole('heading', { name: '¡Hola, Laura!' })).toBeVisible();
});

Then(/^es llevado a \/favorites o \/notifications respectivamente$/, async ({ page }) => {
  await expect(page).toHaveURL(/\/favorites$/);
});

Then(/^es llevado directamente a \/calendar$/, async ({ page }) => {
  await expect(page).toHaveURL(/\/calendar$/);
});

Then(/^ve el número de recetas disponibles que respetan esas restricciones$/, async ({ page }) => {
  await expect(page.getByTestId('available_recipes_card')).toContainText(/\d/);
});

Then(/^es llevado a la pantalla de Recetas$/, async ({ page }) => {
  await expect(page).toHaveURL(/\/recipes$/);
});

Then(/^es llevada a la pantalla de Recetas$/, async ({ page }) => {
  await expect(page).toHaveURL(/\/recipes$/);
});

Then(/^ve una estimación de gasto semanal, una de ahorro y una de tiempo recuperado, cada una indicando que es un valor orientativo$/, async ({ page }) => {
  await expect(page.getByTestId('savings_estimate_cards')).toHaveCount(3);
});

Then(/^ve las recetas agregadas más recientemente al catálogo, dentro de las que puede comer según su perfil$/, async ({ page }) => {
  await expect(page.getByTestId('latest_recipes_section')).toBeVisible();
  await expect(page.getByTestId('latest_recipes_section').getByRole('link')).not.toHaveCount(0);
});
