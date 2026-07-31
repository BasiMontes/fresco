import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

/**
 * Step definitions for `.context/qa/regression.feature` — @generacion-menu,
 * "El frontend muestra la franja sin receta segura" (FR-8.2 / AC Scenario 4,
 * FRESCO-23).
 *
 * Uses a DEDICATED test account (`PRO_TEST_USER_EMAIL`/`_PASSWORD`), not the
 * shared `LOCAL_USER_EMAIL` one — that account's current-week plan is the
 * exact fixture `@aprendizaje`'s scenarios depend on for pendiente slots;
 * seeding a null-recipe row there collided for real once this session
 * already (see `.context/bitacora.md`, 2026-07-31 automation entry).
 *
 * Doesn't try to force Gemini into emitting the sentinel live (unreliable,
 * data-dependent — see `review.md`/`compliance-matrix.md` on FRESCO-23).
 * Seeds the exact row shape `generate-meal-plan/index.ts` would write
 * directly via REST, scoped by the dedicated account's own token (same
 * RLS-respecting pattern as `shopping-list.steps.ts`'s fixture reset — no
 * service role).
 */

const { Given, When, Then } = createBdd(test);

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const TIPOS = ['desayuno', 'comida', 'cena'] as const;

/** Monday of the current ISO week, `YYYY-MM-DD` — matches `lib/date/iso-week.ts`'s convention. */
function currentWeekMonday(): { semanaIso: string, fechaInicio: string } {
  const now = new Date();
  const day = now.getUTCDay() || 7; // Sunday (0) -> 7
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - day + 1);
  const fechaInicio = monday.toISOString().slice(0, 10);

  // ISO week number (same algorithm as lib/date/iso-week.ts).
  const target = new Date(monday);
  target.setUTCDate(target.getUTCDate() + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((target.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
  );
  return { semanaIso: `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`, fechaInicio };
}

async function getAccessToken(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const response = await request.post(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      data: { email: process.env.PRO_TEST_USER_EMAIL, password: process.env.PRO_TEST_USER_PASSWORD },
    },
  );
  const body = await response.json() as { access_token: string };
  return body.access_token;
}

async function restHeaders(accessToken: string) {
  return {
    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function currentUserId(request: import('@playwright/test').APIRequestContext, accessToken: string): Promise<string> {
  const res = await request.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json() as { id: string };
  return body.id;
}

Given(/^que un menú persistido tiene una franja con recipe_id null$/, async ({ request }) => {
  if (!process.env.PRO_TEST_USER_EMAIL || !process.env.PRO_TEST_USER_PASSWORD) {
    throw new Error('PRO_TEST_USER_EMAIL / PRO_TEST_USER_PASSWORD must be set in .env for this scenario.');
  }

  const accessToken = await getAccessToken(request);
  const headers = await restHeaders(accessToken);
  const userId = await currentUserId(request, accessToken);
  const { semanaIso, fechaInicio } = currentWeekMonday();

  // Reset this account's current-week fixture — same pattern as
  // shopping-list.steps.ts's resetShoppingListFixture.
  await request.delete(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/meal_plans?id=not.is.null`, { headers });

  // A real recipe id from the live catalog — never hardcoded (the founder's
  // batch-seeding process can reshuffle `recipes` at any time).
  const recipesRes = await request.get(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/recipes?select=id&limit=1`,
    { headers },
  );
  const [recipe] = await recipesRes.json() as { id: string }[];
  if (!recipe) { throw new Error('No recipes available in the catalog to seed the fixture.'); }

  const planRes = await request.post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/meal_plans`, {
    headers: { ...headers, Prefer: 'return=representation' },
    data: {
      user_id: userId,
      semana_iso: semanaIso,
      fecha_inicio: fechaInicio,
      advertencias: ['No hay ninguna receta segura para el desayuno del lunes con tus restricciones declaradas.'],
    },
  });
  if (!planRes.ok()) { throw new Error(`Failed to seed meal_plans: ${planRes.status()} ${await planRes.text()}`); }
  const [plan] = await planRes.json() as { id: string }[];

  const slots = DIAS.flatMap(dia => TIPOS.map(tipo => ({
    meal_plan_id: plan.id,
    // /menu always renders "lunes" as "today" (app/(app)/menu/page.tsx),
    // regardless of the real weekday — the null slot must land there for
    // the @menu assertion below to see it.
    recipe_id: dia === 'lunes' && tipo === 'desayuno' ? null : recipe.id,
    dia,
    tipo_plato: tipo,
  })));

  const slotsRes = await request.post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/meal_plan_recipes`, {
    headers,
    data: slots,
  });
  if (!slotsRes.ok()) {
    throw new Error(`Failed to seed meal_plan_recipes: ${slotsRes.status()} ${await slotsRes.text()}`);
  }
});

When(/^el usuario visita \/menu o \/calendar$/, async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(process.env.PRO_TEST_USER_EMAIL!);
  await page.getByTestId('password_input').fill(process.env.PRO_TEST_USER_PASSWORD!);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL('**/menu');
});

Then(/^ve esa franja marcada como "Sin receta segura", sin crashear$/, async ({ page }) => {
  await expect(page.getByTestId('menu_slot_desayuno_sin_receta')).toBeVisible();
  await expect(page.getByTestId('menu_advertencias_banner')).toBeVisible();
});

Then(/^no puede arrastrarla ni marcarla como cocinada\/descartada$/, async ({ page }) => {
  await page.goto('/calendar');
  await expect(page.getByTestId('calendar_slot_lunes_desayuno_sin_receta')).toBeVisible();
  // No mark buttons for a slot with no recipe — nothing to mark cocinado/
  // descartado on.
  await expect(page.getByTestId('calendar_slot_lunes_desayuno_mark_cocinada')).toHaveCount(0);
  await expect(page.getByTestId('calendar_slot_lunes_desayuno_mark_descartada')).toHaveCount(0);
  // The drag handle is disabled — dnd-kit's useDraggable(disabled: true).
  await expect(
    page.getByTestId('calendar_slot_lunes_desayuno').getByRole('button', { name: 'Arrastrar para reordenar' }),
  ).toBeDisabled();
});
