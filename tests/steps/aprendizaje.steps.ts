import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

/**
 * Step definitions for `.context/qa/regression.feature` — @aprendizaje,
 * STORY-FRESCO-15.
 *
 * Unlike @registro (signup), this hits the REAL backend — no network
 * mocking. Marking a slot cocinada/descartada is a cheap, real, terminal DB
 * write (no email send, no rate limit), and the "survives reload" scenario
 * genuinely needs a real persisted write to prove anything. The only real
 * constraint: a (dia, tipo) slot can never go back to pendiente once marked
 * (Business Rules: "queda fijado"), so each automated run permanently
 * consumes one of the current ISO week's 21 slots. Rather than hardcode a
 * slot (which would break the moment someone/something else marks it), the
 * "pendiente slot" step picks whichever slot still shows its mark buttons —
 * self-adapting across repeated runs, and a real week always has fresh
 * slots again once a new meal plan is generated for the following week.
 *
 * `ctx` lives in the shared `aprendizajeCtx` fixture (see
 * `tests/fixtures.ts`) — this file no longer defines its own custom `test`
 * instance (two independent `base.extend()` calls across step files break
 * `bddgen`'s test-instance resolution; see `tests/fixtures.ts`'s header).
 */

const { Given, When, Then } = createBdd(test);

async function loginAndGoToCalendar(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(process.env.LOCAL_USER_EMAIL!);
  await page.getByTestId('password_input').fill(process.env.LOCAL_USER_PASSWORD!);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL('**/menu');
  await page.goto('/calendar');
}

Given(/^que el usuario tiene un menú semanal generado con un plato en estado pendiente$/, async ({ page, aprendizajeCtx: ctx }) => {
  await loginAndGoToCalendar(page);

  const pendingMark = page.locator('[data-testid$="_mark_cocinada"]').first();
  const testid = await pendingMark.getAttribute('data-testid');
  if (!testid) {
    throw new Error('No quedan huecos pendientes en el plan de esta semana para el usuario de prueba.');
  }
  // Strip the trailing "_mark_cocinada" to get the shared slot testid prefix.
  ctx.slotPrefix = testid.replace(/_mark_cocinada$/, '');
});

When(/^marca ese plato como cocinado$/, async ({ page, aprendizajeCtx: ctx }) => {
  await page.getByTestId(`${ctx.slotPrefix}_mark_cocinada`).click();
});

When(/^marca ese plato como descartado$/, async ({ page, aprendizajeCtx: ctx }) => {
  await page.getByTestId(`${ctx.slotPrefix}_mark_descartada`).click();
});

Then(/^el plato se muestra como cocinado$/, async ({ page, aprendizajeCtx: ctx }) => {
  await expect(page.getByTestId(`${ctx.slotPrefix}_estado_badge`)).toHaveText('Cocinado');
});

Then(/^el plato se muestra como descartado$/, async ({ page, aprendizajeCtx: ctx }) => {
  await expect(page.getByTestId(`${ctx.slotPrefix}_estado_badge`)).toHaveText('Descartado');
});

Then(/^no puede volver a cambiar el estado de ese mismo plato$/, async ({ page, aprendizajeCtx: ctx }) => {
  await expect(page.getByTestId(`${ctx.slotPrefix}_mark_cocinada`)).toHaveCount(0);
  await expect(page.getByTestId(`${ctx.slotPrefix}_mark_descartada`)).toHaveCount(0);
});

Given(/^que el usuario ya marcó un plato como cocinado o descartado$/, async ({ page, aprendizajeCtx: ctx }) => {
  await loginAndGoToCalendar(page);

  const pendingMark = page.locator('[data-testid$="_mark_cocinada"]').first();
  const testid = await pendingMark.getAttribute('data-testid');
  if (!testid) {
    throw new Error('No quedan huecos pendientes en el plan de esta semana para el usuario de prueba.');
  }
  ctx.slotPrefix = testid.replace(/_mark_cocinada$/, '');

  await page.getByTestId(`${ctx.slotPrefix}_mark_cocinada`).click();
  await expect(page.getByTestId(`${ctx.slotPrefix}_estado_badge`)).toHaveText('Cocinado');
});

When(/^recarga la página y observa ese mismo plato$/, async ({ page }) => {
  await page.reload();
});

Then(/^no ve ningún control para volver a marcarlo$/, async ({ page, aprendizajeCtx: ctx }) => {
  await expect(page.getByTestId(`${ctx.slotPrefix}_mark_cocinada`)).toHaveCount(0);
  await expect(page.getByTestId(`${ctx.slotPrefix}_mark_descartada`)).toHaveCount(0);
});

Then(/^el plato queda fijado en su estado actual$/, async ({ page, aprendizajeCtx: ctx }) => {
  // Real persistence check (not optimistic client state) — the page was
  // just reloaded, so this read comes from the Server Component's own
  // getMealPlanForWeek() call against the real DB.
  await expect(page.getByTestId(`${ctx.slotPrefix}_estado_badge`)).toHaveText('Cocinado');
});

Given(/^que el usuario es de nivel gratuito \(Free\)$/, async () => {
  // Precondition only: the QA test user's profile.plan defaults to 'free'
  // (no onboarding profile row sets it otherwise) — asserted, not set here.
});

When(/^visita \/calendar$/, async ({ page }) => {
  await loginAndGoToCalendar(page);
});

Then(/^ve un aviso sobre marcar cocinado\/descartado en el plan Free$/, async ({ page }) => {
  await expect(page.getByTestId('learning_free_tier_notice')).toBeVisible();
});

Then(/^ese aviso aclara que el marcado se guarda igual, y que lo exclusivo de Pro es el aprendizaje$/, async ({ page }) => {
  // FRESCO-103: the notice used to claim marking was Pro-only and "your
  // current menu isn't affected" — false, the mark always persisted
  // regardless of plan. Corrected to state the real behavior (mark
  // persists in Free too) and the real Pro differentiator (future-menu
  // learning from those marks).
  await expect(page.getByTestId('learning_free_tier_notice')).toContainText('se guarda igual en el plan Free');
});
