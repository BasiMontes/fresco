import type { APIRequestContext, Page } from '@playwright/test';
import { devices, expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { currentWeekMonday, getAccessToken, restHeaders } from '../test-helpers';

/**
 * Step definitions for `.context/qa/regression.feature` — @calendario,
 * "El sistema rechaza un intercambio entre franjas de tipo distinto".
 *
 * Uses the dedicated `PRO_TEST_USER_EMAIL` account (same reset-and-reseed
 * convention `entrega-parcial.steps.ts` and `aprendizaje-pro.steps.ts`
 * already use for it) rather than the shared `LOCAL_USER_EMAIL` — that
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
  if (!process.env.PRO_TEST_USER_EMAIL || !process.env.PRO_TEST_USER_PASSWORD) {
    throw new Error('PRO_TEST_USER_EMAIL / PRO_TEST_USER_PASSWORD must be set in .env for this scenario.');
  }

  const accessToken = await getAccessToken(request, process.env.PRO_TEST_USER_EMAIL, process.env.PRO_TEST_USER_PASSWORD);
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
  await page.getByTestId('email_input').fill(process.env.PRO_TEST_USER_EMAIL!);
  await page.getByTestId('password_input').fill(process.env.PRO_TEST_USER_PASSWORD!);
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

// ── Scroll táctil horizontal mobile (regresión de FRESCO-170, BLOCKER) ─────
//
// FRESCO-170 was found broken TWICE by real QA sweeps (2026-08-10, then
// re-confirmed 2026-08-11 after a first "fix" that only addressed the
// sticky label, not the underlying dead touch-scroll) before the real root
// cause (touch-action: none on the drag handle + a PointerSensor with no
// activation distinction between mouse and touch) got fixed for real —
// verified live against production this session (CDP touch dispatch,
// scrollLeft 0 -> 312, Lunes -> Martes/Miércoles visible). Zero regression
// coverage existed for it before this scenario.
//
// Needs a real mobile-emulated context (viewport + hasTouch) — the default
// `chromium`/Desktop Chrome project has neither, so this scenario opens its
// own context instead of using the shared `page` fixture, same reasoning
// `entrega-parcial.steps.ts` documents for using a dedicated account: don't
// let one scenario's special requirement change what every other scenario
// gets by default.
let mobilePage: Page;

Given(
  /^que el usuario tiene un menú semanal generado con los 21 huecos llenos, en un viewport mobile con touch$/,
  async ({ page, request }) => {
    await seedFullWeek(request);

    const browser = page.context().browser();
    if (!browser) { throw new Error('No hay una instancia de browser disponible para abrir un contexto mobile-emulado.'); }
    const mobileContext = await browser.newContext({ ...devices['iPhone 15'] });
    mobilePage = await mobileContext.newPage();
    await loginAndGoToCalendar(mobilePage);
  },
);

When(/^desliza el dedo horizontalmente sobre el grid$/, async () => {
  const scroller = mobilePage.getByTestId('calendar_grid_scroller');
  await expect(scroller).toBeVisible();
  const box = await scroller.boundingBox();
  if (!box) { throw new Error('No se encontró el contenedor de scroll horizontal del calendario.'); }

  // Real touch dispatch via CDP, not a mouse-wheel/drag simulation — this
  // is the exact method that caught the real bug live (mouse-wheel and
  // plain `dragTo` both looked fine while real touch was completely dead).
  // y is near the TOP of the scroller (the día/tipo header row), not
  // height/2 — the scroller is much taller than one viewport (7 days × 3
  // meal rows), so its vertical center sits off-screen below the fold, AND
  // a mid-height y risks landing on a draggable card's own handle instead
  // of empty scroll-track space. Same near-top y this scenario used when
  // verified live against production (box.y + ~140).
  const cdp = await mobilePage.context().newCDPSession(mobilePage);
  const y = box.y + 40;
  const startX = box.x + box.width - 20;
  const endX = box.x + 20;

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y }] });
  await mobilePage.waitForTimeout(50);
  for (let x = startX; x >= endX; x -= 20) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await mobilePage.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mobilePage.waitForTimeout(300);
});

Then(/^el grid se desplaza y muestra días más allá del lunes$/, async () => {
  const scroller = mobilePage.getByTestId('calendar_grid_scroller');
  await expect.poll(async () => scroller.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  await expect(mobilePage.getByText('Martes')).toBeVisible();
  await mobilePage.context().close();
});
