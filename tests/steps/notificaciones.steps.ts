import type { Page } from '@playwright/test';
import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { restHeaders, serviceRoleHeaders } from '../test-helpers';
import { seedFullWeekMenu } from '../test-user-factory';

/**
 * Step definitions for `.context/qa/regression.feature` — @notificaciones
 * (FRESCO-226 Centro de Avisos):
 * - "Se puede marcar como favorita una receta recomendada..." (FRESCO-355)
 * - the payment-failed notice + bell-icon badge trio (FRESCO-399 / A4-L14,
 *   promoted from @pendiente).
 *
 * Throwaway factory user per scenario (FRESCO-308), seeds its own data.
 */

const { Given, When, Then } = createBdd(test);

interface Ctx { testUser: TestUser | null }
const ctx: Ctx = { testUser: null };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

async function loginAndGoTo(page: Page, testUser: TestUser, path: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(testUser.email);
  await page.getByTestId('password_input').fill(testUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL(url => /\/(?:menu|onboarding)/.test(url.pathname));
  await page.goto(path);
}

Given(/^que Laura ve una receta recomendada en \/notifications$/, async ({ page, request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  // The recommendations notice needs a planning_selection on the profile.
  await request.patch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${testUser.id}`, {
    headers: restHeaders(testUser.accessToken),
    data: { planning_selection: { lunes: ['comida', 'cena'] } },
  });
  await loginAndGoTo(page, testUser, '/notifications');
  await expect(page.getByTestId('notifications_recommended_recipes_notice')).toBeVisible();
});

When(/^pulsa "Guardar en favoritos" en esa tarjeta$/, async ({ page }) => {
  await page.getByTestId('notifications_recommended_recipes_notice')
    .getByRole('button', { name: 'Guardar en favoritos' })
    .first()
    .click();
});

Then(/^la receta se añade a sus favoritos, visible en \/favorites$/, async ({ page }) => {
  await page.goto('/favorites');
  await expect(page.getByTestId('favorites_grid')).toBeVisible();
  await expect(page.getByTestId('favorites_grid').getByRole('link')).toHaveCount(1);
});

// ── FRESCO-399 (A4-L14): payment-failed notice + bell-icon badge ──────────

Given(/^que Laura tiene plan Pro y su último cobro de suscripción falló$/, async ({ request, testUserFactory }) => {
  const testUser = await testUserFactory({ plan: 'pro' });
  ctx.testUser = testUser;
  // `payment_failed_at` is a subscription-protected column (ADR-0007's
  // `protect_subscription_columns` trigger) — service-role write only, the
  // same mechanism the factory itself uses to set `plan`. No real Stripe call.
  const res = await request.patch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${testUser.id}`, {
    headers: { ...serviceRoleHeaders(), Prefer: 'return=minimal' },
    data: { payment_failed_at: new Date().toISOString() },
  });
  if (!res.ok()) { throw new Error(`[notificaciones] seed payment_failed_at: ${res.status()} ${await res.text()}`); }
});

When(/^abre \/notifications$/, async ({ page }) => {
  await loginAndGoTo(page, ctx.testUser!, '/notifications');
});

Then(/^ve el aviso "Tu último pago falló" en primer lugar, antes que el resto de secciones$/, async ({ page }) => {
  const notice = page.getByTestId('notifications_payment_failed_notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Tu último pago falló');
  // page.tsx renders it above every curated section — assert the DOM order
  // against the welcome card, which a fresh factory user always also has.
  const welcome = page.getByTestId('notifications_welcome_card');
  await expect(welcome).toBeVisible();
  const [noticeBox, welcomeBox] = await Promise.all([notice.boundingBox(), welcome.boundingBox()]);
  expect(noticeBox!.y).toBeLessThan(welcomeBox!.y);
});

Then(/^ve el botón "Gestionar mi suscripción" para ir al Billing Portal de Stripe$/, async ({ page }) => {
  await expect(page.getByTestId('manage_subscription_button')).toBeVisible();
});

Given(/^que Laura tiene un aviso de bienvenida sin ver y su menú de la semana generado$/, async ({ request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  // `/menu` only renders the header (and the bell) in its has-plan branch.
  await seedFullWeekMenu(request, testUser);
  // `aviso_bienvenida_visto` DB-defaults to false → getHasUnseenNotifications() true.
});

Given(/^que Laura ya vio la bienvenida, ya descartó las rutas y no tiene pagos fallidos, con su menú de la semana generado$/, async ({ request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await seedFullWeekMenu(request, testUser);
  // Both notice-state booleans are user-writable (not subscription-protected);
  // free plan + no payment_failed_at means the third OR term is false too.
  const res = await request.patch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${testUser.id}`, {
    headers: { ...restHeaders(testUser.accessToken), Prefer: 'return=minimal' },
    data: { aviso_bienvenida_visto: true, aviso_rutas_descartado: true },
  });
  if (!res.ok()) { throw new Error(`[notificaciones] seed avisos vistos: ${res.status()} ${await res.text()}`); }
});

When(/^abre \/menu$/, async ({ page }) => {
  await loginAndGoTo(page, ctx.testUser!, '/menu');
});

Then(/^ve un punto rojo sobre el icono de Notificaciones de la cabecera, sin ningún número$/, async ({ page }) => {
  const badge = page.getByTestId('notificaciones_badge');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText('');
});

Then(/^el icono de Notificaciones se ve sin ningún punto rojo$/, async ({ page }) => {
  await expect(page.getByTestId('notificaciones_button')).toBeVisible();
  await expect(page.getByTestId('notificaciones_badge')).toHaveCount(0);
});
