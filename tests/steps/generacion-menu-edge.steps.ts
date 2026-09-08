import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { currentWeekMonday, restHeaders } from '../test-helpers';
import { generateCurrentWeekPlan } from '../test-user-factory';

/**
 * Step definitions for `.context/qa/regression.feature` — @generacion-menu
 * @edge-case, "Ya existe un plan para la semana solicitada".
 *
 * FRESCO-463 (FRESCO-321 ratchet). API-only: no page, no UI — the guard is
 * `generate-meal-plan/index.ts` (a second call for the same
 * `user_id + semana_iso` returns 409, `unique_user_semana`). A throwaway
 * factory user (FRESCO-308) generates its own real plan, then re-POSTs.
 */

const { Given, When, Then } = createBdd(test);

interface Ctx { testUser: TestUser | null, secondAttemptStatus: number }
const ctx: Ctx = { testUser: null, secondAttemptStatus: 0 };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

Given(/^que el usuario ya generó un menú para la semana actual$/, async ({ request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await generateCurrentWeekPlan(request, testUser);
});

When(/^intenta generar de nuevo sin eliminar el plan existente$/, async ({ request }) => {
  const { semanaIso, fechaInicio } = currentWeekMonday();
  const res = await request.post(`${SUPABASE_URL}/functions/v1/generate-meal-plan`, {
    headers: restHeaders(ctx.testUser!.accessToken),
    data: { semana_iso: semanaIso, fecha_inicio: fechaInicio },
    timeout: 120_000,
  });
  ctx.secondAttemptStatus = res.status();
});

Then(/^el sistema responde 409 y no crea un plan duplicado$/, async ({ request }) => {
  expect(ctx.secondAttemptStatus).toBe(409);

  const { semanaIso } = currentWeekMonday();
  const plansRes = await request.get(
    `${SUPABASE_URL}/rest/v1/meal_plans?select=id&user_id=eq.${ctx.testUser!.id}&semana_iso=eq.${semanaIso}`,
    { headers: restHeaders(ctx.testUser!.accessToken) },
  );
  expect((await plansRes.json() as unknown[]).length).toBe(1);
});
