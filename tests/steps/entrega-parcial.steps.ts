import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { currentUserId, currentWeekMonday, getAccessToken, restHeaders } from '../test-helpers';

/**
 * Step definitions for `.context/qa/regression.feature` — @generacion-menu,
 * "El frontend muestra la franja sin receta segura" (FR-8.2 / AC Scenario 4,
 * FRESCO-23).
 *
 * Uses a DEDICATED test account (`PRO_USER_EMAIL`/`_PASSWORD`), not the
 * shared `DEV_USER_EMAIL` one — that account's current-week plan is the
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

Given(/^que un menú persistido tiene una franja con recipe_id null$/, async ({ request }) => {
  if (!process.env.PRO_USER_EMAIL || !process.env.PRO_USER_PASSWORD) {
    throw new Error('PRO_USER_EMAIL / PRO_USER_PASSWORD must be set in .env for this scenario.');
  }

  const accessToken = await getAccessToken(request, process.env.PRO_USER_EMAIL, process.env.PRO_USER_PASSWORD);
  const headers = restHeaders(accessToken);
  const userId = await currentUserId(request, accessToken);
  const { semanaIso, fechaInicio } = currentWeekMonday();

  // Reset this account's current-week fixture — same pattern as
  // shopping-list.steps.ts's resetShoppingListFixture.
  await request.delete(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/meal_plans?id=not.is.null`, { headers });

  // /menu's "hoy" grid only renders the slots selected in planning_selection
  // (FRESCO-172, FRESCO-199) — found live leaking real state from another
  // scenario/session: this account's selection had shrunk to {comida,cena}
  // on every day, so the seeded null-recipe desayuno slot below never
  // rendered at all, no matter how correctly it was seeded. Reset to all 3
  // meals on all 7 days so this scenario doesn't depend on whatever a prior
  // run left behind.
  await request.patch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`, {
    headers,
    data: {
      planning_selection: Object.fromEntries(
        ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map(
          dia => [dia, ['desayuno', 'comida', 'cena']],
        ),
      ),
    },
  });

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
  await page.getByTestId('email_input').fill(process.env.PRO_USER_EMAIL!);
  await page.getByTestId('password_input').fill(process.env.PRO_USER_PASSWORD!);
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
  // No drag handle at all for desayuno (FRESCO-159) — not merely disabled.
  // Was `useDraggable(disabled: true)` (a disabled-but-present button) when
  // this scenario was written; FRESCO-159 later removed the button from
  // the DOM entirely for every desayuno slot, regardless of recipe_id.
  await expect(
    page.getByTestId('calendar_slot_lunes_desayuno').getByRole('button', { name: 'Arrastrar para reordenar' }),
  ).toHaveCount(0);
});
