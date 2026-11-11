import type { Page } from '@playwright/test';
import type { TestUser } from '../test-user-factory';
import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { loginToApp } from '../test-helpers';

/**
 * Step definitions for `.context/qa/regression.feature` — @perfil, the happy
 * paths of `/profile` (EPIC-FRESCO-52): edit diet/allergen preferences,
 * download the CSV data backup, log out.
 *
 * FRESCO-355 (3rd batch of the FRESCO-321 ratchet). Throwaway free-plan
 * factory user (FRESCO-308).
 */

const { Given, When, Then } = createBdd(test);

interface ExportFile { filename: string, content: string }
interface Ctx { testUser: TestUser | null, exportFile: ExportFile | null }
const ctx: Ctx = { testUser: null, exportFile: null };

async function loginAndGoToProfile(page: Page, testUser: TestUser): Promise<void> {
  await loginToApp(page, testUser);
  await page.goto('/profile');
}

Given(/^que Laura está en \/profile$/, async ({ page, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await loginAndGoToProfile(page, testUser);
});

Given(/^que Laura está en \/profile con sesión activa$/, async ({ page, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await loginAndGoToProfile(page, testUser);
});

// FRESCO-972 (UX-18): at 360 px the row printed "Cerrar sesión" as a label and as the button.
Given(/^\/profile muestra un único "Cerrar sesión"$/, async ({ page }) => {
  await expect(page.getByTestId('logout_button')).toBeVisible();
  await expect(page.locator('main').getByText('Cerrar sesión', { exact: true })).toHaveCount(1);
});

// FRESCO-972 (UX-19): the in-page nav jumps to the section.
Given(/^la navegación del perfil lleva a la sección Cuenta$/, async ({ page }) => {
  await page.getByTestId('profile_section_link_cuenta').click();
  await expect(page).toHaveURL(/#cuenta$/);
  await expect(page.getByTestId('logout_button')).toBeInViewport();
});

// ── When ─────────────────────────────────────────────────────────────────

// FRESCO-1070: the diet and allergen form lives on /profile/preferences, reached from a row of /profile.
When(/^abre "Preferencias" desde su perfil$/, async ({ page }) => {
  await page.getByTestId('profile_row_preferencias').click();
  await expect(page).toHaveURL(/\/profile\/preferences$/);
});

When(/^activa un chip de dieta y confirma "Actualizar Preferencias"$/, async ({ page }) => {
  await page.getByTestId('preferencia_dieta_option').first().click();
  // FRESCO-917: a diet chip is health data; the form asks for the consent first.
  await page.getByTestId('health_consent_checkbox').click();
  await expect(page.getByTestId('health_consent_checkbox')).toBeChecked();
  await page.getByTestId('actualizar_preferencias_button').click();
});

When(/^pulsa "Descargar" en Backup CSV$/, async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export_data_link').click();
  const download = await downloadPromise;
  // FRESCO-1189: keep the file itself so the Then step can read it (it used to be saved to /tmp and never opened).
  const path = await download.path();
  ctx.exportFile = { filename: download.suggestedFilename(), content: await readFile(path, 'utf8') };
});

When(/^pulsa "Salir"$/, async ({ page }) => {
  await page.getByTestId('logout_button').click();
});

// ── Then ─────────────────────────────────────────────────────────────────

// FRESCO-862: from `md` up the sidebar account menu offers logout; the profile row is
// `md:hidden` so the screen does not show two "Cerrar sesión".
Then(/^\/profile no muestra su propio botón "Salir" y el menú de cuenta del sidebar sí$/, async ({ page }) => {
  await expect(page.getByTestId('logout_button')).toBeHidden();
  await expect(page.getByTestId('sidebar_account_trigger')).toBeVisible();
});

Then(/^la preferencia queda guardada y sigue activa tras recargar la página$/, async ({ page }) => {
  await expect(page.getByTestId('preferencias_saved_message')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-testid="preferencia_dieta_option"][aria-pressed="true"]').first()).toBeVisible();
});

// FRESCO-1189: this step used to check only the URL, so an empty or wrong file would have passed. It reads the
// downloaded CSV: the file name, the sections every account has (`# account` with ITS email, `# user_profile`),
// and that no session or service secret leaked into the export of personal data.
Then(/^recibe un CSV con su cuenta y su perfil y sin ningún token de sesión$/, async () => {
  const file = ctx.exportFile;
  expect(file, 'the Backup CSV step did not capture a download').not.toBeNull();
  const { filename, content } = file as ExportFile;

  expect(filename).toMatch(/^fresco-datos-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(content.length).toBeGreaterThan(200);
  expect(content.startsWith('# exported_at: ')).toBe(true);
  expect(content).toContain('# account\n');
  expect(content).toContain('# user_profile\n');
  expect(content).toContain(ctx.testUser?.email ?? 'no-email');
  expect(content).not.toMatch(/access_token|refresh_token|service_role|Bearer |encrypted_password/i);
});

Then(/^la cookie de sesión se elimina y vuelve a \/login$/, async ({ page }) => {
  await page.waitForURL('**/login');
  const cookies = await page.context().cookies();
  const hasAuthCookie = cookies.some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token') && c.value.length > 0);
  expect(hasAuthCookie).toBe(false);
});

// ── FRESCO-355 mini-batch: delete account ────────────────────────────────

Given(/^que Laura confirma el borrado con su email exacto y su contraseña$/, async ({ page, testUserFactory }) => {
  test.setTimeout(60_000);
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await loginAndGoToProfile(page, testUser);
  await page.getByTestId('delete_account_open_button').click();
  await expect(page.getByTestId('delete_account_dialog')).toBeVisible();
  await page.getByTestId('delete_account_email_input').fill(testUser.email);
  // FRESCO-397 (A4-L11): the Edge Function now requires a fresh
  // re-authentication; the dialog re-logs with this password.
  await page.getByTestId('delete_account_password_input').fill(testUser.password);
});

When(/^el sistema ejecuta la Edge Function delete-account$/, async ({ page }) => {
  await page.getByTestId('delete_account_confirm_button').click();
});

Then(/^su auth\.users se elimina y el cascade de FK limpia user_profiles\/meal_plans\/shopping_lists\/recetas_propias$/, async ({ request }) => {
  const testUser = ctx.testUser!;
  const adminHeaders = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };
  // delete-account runs async (Edge Function + sign-out + redirect) — poll.
  await expect.poll(
    async () => (await request.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${testUser.id}`, { headers: adminHeaders })).status(),
    { timeout: 15_000 },
  ).toBe(404);
});

Then(/^la sesión se cierra y es redirigida a \/login con un mensaje de despedida$/, async ({ page }) => {
  await page.waitForURL(/\/login\?account_deleted=1/);
  await expect(page.getByTestId('account_deleted_message')).toBeVisible();
});

// ── @edge-case "Borrar cuenta exige email exacto + contraseña" (FRESCO-463) ──
//
// `delete-account-dialog.tsx`: `isConfirmed = phraseMatches && (isAnonymous
// || password.length > 0)`, and `confirm` is `disabled={!isConfirmed}`. This
// scenario only exercises the gating — it never clicks confirm, so nothing
// is deleted.

Given(/^que Laura abre el diálogo "Borrar cuenta definitivamente"$/, async ({ page, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await loginAndGoToProfile(page, testUser);
  await page.getByTestId('delete_account_open_button').click();
  await expect(page.getByTestId('delete_account_dialog')).toBeVisible();
});

When(/^escribe un email distinto al suyo$/, async ({ page }) => {
  await page.getByTestId('delete_account_email_input').fill('otra-persona@example.com');
});

When(/^escribe su propio email exacto pero deja la contraseña vacía$/, async ({ page }) => {
  await page.getByTestId('delete_account_email_input').fill(ctx.testUser!.email);
  await page.getByTestId('delete_account_password_input').fill('');
});

When(/^escribe también su contraseña$/, async ({ page }) => {
  await page.getByTestId('delete_account_password_input').fill(ctx.testUser!.password);
});

Then(/^el botón de confirmación sigue deshabilitado$/, async ({ page }) => {
  await expect(page.getByTestId('delete_account_confirm_button')).toBeDisabled();
});

Then(/^el botón de confirmación se habilita$/, async ({ page }) => {
  await expect(page.getByTestId('delete_account_confirm_button')).toBeEnabled();
});
