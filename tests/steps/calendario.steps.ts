import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { currentWeekMonday, getAccessToken, restHeaders } from '../test-helpers';

/**
 * Step definitions for `.context/qa/regression.feature` — @calendario,
 * "El sistema rechaza un intercambio entre franjas de tipo distinto".
 *
 * Uses the dedicated `PRO_USER_EMAIL` account (same reset-and-reseed
 * convention `entrega-parcial.steps.ts` and `aprendizaje-pro.steps.ts`
 * already use for it) rather than the shared `DEV_USER_EMAIL` — that
 * account's current-week plan is the exact fixture `@aprendizaje`'s
 * cocinada/descartada scenarios depend on, and this scenario needs to
 * reset+reseed the whole week to know each slot's exact recipe name before
 * asserting nothing changed.
 */

const { Given, When, Then } = createBdd(test);

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const TIPOS = ['desayuno', 'comida', 'cena'] as const;

interface Ctx { comidaNombre: string, cenaNombre: string }
const ctx: Ctx = { comidaNombre: '', cenaNombre: '' };

/** REST-only seeding, shared by both the desktop and mobile Given below — each does its own login/navigation on its own `page`. */
async function seedFullWeek(request: APIRequestContext): Promise<void> {
  if (!process.env.PRO_USER_EMAIL || !process.env.PRO_USER_PASSWORD) {
    throw new Error('PRO_USER_EMAIL / PRO_USER_PASSWORD must be set in .env for this scenario.');
  }

  const accessToken = await getAccessToken(request, process.env.PRO_USER_EMAIL, process.env.PRO_USER_PASSWORD);
  const headers = restHeaders(accessToken);
  const userRes = await request.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, { headers });
  const { id: userId } = await userRes.json() as { id: string };
  const { semanaIso, fechaInicio } = currentWeekMonday();

  await request.delete(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/meal_plans?id=not.is.null`, { headers });

  // One real recipe per tipo_plato — distinct names so the assertion below
  // can tell "swapped" from "unchanged" unambiguously.
  const recipesByTipo: Record<string, { id: string, nombre: string }> = {};
  for (const tipo of TIPOS) {
    const res = await request.get(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/recipes?select=id,nombre&clasificacion->>tipo_plato=eq.${tipo}&limit=1`,
      { headers },
    );
    const [recipe] = await res.json() as { id: string, nombre: string }[];
    if (!recipe) { throw new Error(`No hay ninguna receta de tipo ${tipo} en el catálogo para sembrar el fixture.`); }
    recipesByTipo[tipo] = recipe;
  }
  ctx.comidaNombre = recipesByTipo.comida.nombre;
  ctx.cenaNombre = recipesByTipo.cena.nombre;

  const planRes = await request.post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/meal_plans`, {
    headers: { ...headers, Prefer: 'return=representation' },
    data: { user_id: userId, semana_iso: semanaIso, fecha_inicio: fechaInicio, advertencias: [] },
  });
  if (!planRes.ok()) { throw new Error(`Failed to seed meal_plans: ${planRes.status()} ${await planRes.text()}`); }
  const [plan] = await planRes.json() as { id: string }[];

  const slots = DIAS.flatMap(dia => TIPOS.map(tipo => ({
    meal_plan_id: plan.id,
    recipe_id: recipesByTipo[tipo].id,
    dia,
    tipo_plato: tipo,
  })));
  const slotsRes = await request.post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/meal_plan_recipes`, { headers, data: slots });
  if (!slotsRes.ok()) { throw new Error(`Failed to seed meal_plan_recipes: ${slotsRes.status()} ${await slotsRes.text()}`); }
}

async function loginAndGoToCalendar(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(process.env.PRO_USER_EMAIL!);
  await page.getByTestId('password_input').fill(process.env.PRO_USER_PASSWORD!);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL('**/menu');
  await page.goto('/calendar');
}

Given(/^que el usuario tiene un menú semanal generado con los 21 huecos llenos$/, async ({ page, request }) => {
  await seedFullWeek(request);
  await loginAndGoToCalendar(page);
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
