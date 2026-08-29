import type { Page } from '@playwright/test';
import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { seedFullWeekMenu } from '../test-user-factory';

/**
 * Step definitions for `.context/qa/regression.feature` — @calendario,
 * "El sistema rechaza un intercambio entre franjas de tipo distinto".
 *
 * FRESCO-308: this scenario used to reset+reseed the shared `PRO_USER_EMAIL`
 * account's current-week plan — the exact kind of write that raced against
 * other scenarios sharing that same account (a live RLS 403 was observed
 * here). It now creates its own throwaway user via `testUserFactory`
 * (`tests/test-user-factory.ts`) and seeds THAT user's plan instead, so it
 * no longer shares mutable state with anything else in the suite.
 */

const { Given, When, Then } = createBdd(test);

interface Ctx { comidaNombre: string, cenaNombre: string, testUser: TestUser | null }
const ctx: Ctx = { comidaNombre: '', cenaNombre: '', testUser: null };

async function loginAndGoToCalendar(page: Page, testUser: TestUser): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(testUser.email);
  await page.getByTestId('password_input').fill(testUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL('**/menu');
  await page.goto('/calendar');
}

Given(/^que el usuario tiene un menú semanal generado con los 21 huecos llenos$/, async ({ page, request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  const { comidaNombre, cenaNombre } = await seedFullWeekMenu(request, testUser);
  ctx.comidaNombre = comidaNombre;
  ctx.cenaNombre = cenaNombre;
  await loginAndGoToCalendar(page, testUser);
});

// Source is comida, not desayuno — FRESCO-159 removed desayuno's drag
// handle entirely (see regression.feature's own note on this scenario), so
// desayuno can no longer initiate a drag at all. comida→cena still
// exercises the real thing under test (tipo_plato mismatch rejection,
// both client drop-target disabling and the SQL-level check).
When(/^arrastra el plato de una comida sobre el hueco de una cena$/, async ({ page }) => {
  await page
    .getByTestId('calendar_slot_lunes_comida')
    .getByRole('button', { name: 'Arrastrar para reordenar' })
    .dragTo(page.getByTestId('calendar_slot_lunes_cena').getByRole('button', { name: 'Arrastrar para reordenar' }));
});

Then(/^el intercambio no se realiza$/, async ({ page }) => {
  await expect(page.getByTestId('calendar_slot_lunes_comida')).toContainText(ctx.comidaNombre);
});

Then(/^ambos huecos conservan su receta y su franja originales$/, async ({ page }) => {
  await expect(page.getByTestId('calendar_slot_lunes_comida')).toContainText(ctx.comidaNombre);
  await expect(page.getByTestId('calendar_slot_lunes_cena')).toContainText(ctx.cenaNombre);
});

// ── Paginación día a día con flechas (FRESCO-271) ──────────────────────────
//
// Reemplaza el scenario de scroll táctil que cubría FRESCO-170/FRESCO-222:
// ambos fixes intentaron mantener la etiqueta DESAYUNO/COMIDA/CENA fija
// resincronizándola contra un `scrollLeft` que seguía cambiando, y ambos se
// rompieron de nuevo (FRESCO-271, tercer reporte del mismo síntoma).
// FRESCO-271 quita el scroll horizontal por completo — el grid pagina de a
// un día por click de flecha, sin nada que sincronizar. Un click normal
// reproduce esto igual en cualquier viewport, ya no hace falta touch real
// ni un contexto mobile-emulado dedicado.

When(/^pulsa la flecha de día siguiente$/, async ({ page }) => {
  await page.getByTestId('calendar_day_nav_next').click();
});

Then(/^el grid muestra días más allá del lunes$/, async ({ page }) => {
  await expect(page.getByText('Martes')).toBeVisible();
});
