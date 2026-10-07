import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

/**
 * Step definitions for `.context/qa/regression.feature` — @registro-progresivo,
 * the scenarios `registro-progresivo.steps.ts` didn't cover: the
 * save-your-menu banner and the signup edge cases (FRESCO-463).
 *
 * FRESCO-817: the email-conflict / reassignment trio (FRESCO-19/FRESCO-20) is
 * not automated here. `email_exists` only surfaces after a real 6-digit OTP
 * verification (FRESCO-89) and this suite has no fixture that reads a real
 * inbox, so those three scenarios are `@solo-manual` in
 * `.context/qa/regression.feature` and their steps were removed.
 */

const { Given, When, Then } = createBdd(test);

/**
 * Real anonymous session (FRESCO-17, ADR-0003).
 *
 * FRESCO-197: `/onboarding` now opens on the guest-vs-account choice
 * (`IdentityStep`). The anonymous session is created by clicking "Continuar
 * como invitada" (`signInAnonymously()`), not silently on mount — so click
 * it first, then wait for the real session cookie to land.
 */
async function ensureAnonymousSession(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/onboarding');
  // FRESCO-794: age 14+ and Terms/Privacy come before anything is created.
  await page.getByTestId('confirm_age_checkbox').check();
  await page.getByTestId('accept_terms_checkbox').check();
  await page.getByTestId('onboarding_continue_as_guest_button').click();
  await expect
    .poll(async () => {
      const cookies = await page.context().cookies();
      return cookies.some(cookie => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'));
    })
    .toBe(true);
}

/** Completes the 3-step onboarding + a REAL Gemini generation as the current anonymous guest. */
async function generateRealGuestMenu(page: import('@playwright/test').Page): Promise<void> {
  await ensureAnonymousSession(page);
  // FRESCO-371: back to a 3-step wizard ("Paso 3 de 3") — cuisines folded
  // into the diet step. 2 clicks reaches the final step, then FRESCO-755's
  // summary where "Empezar" lives.
  await page.getByTestId('next_button').click();
  await page.getByTestId('next_button').click();
  // FRESCO-371: the weekly budget is optional again and no longer gates
  // `generate_menu_button` — left blank here.
  await page.getByTestId('view_summary_button').click();
  await page.getByTestId('generate_menu_button').click();
  await page.waitForURL('**/menu', { timeout: 200_000 });
}

// ── "La invitada ve una invitación a guardar su menú" ──────────────────────

Given(/^que una invitada con sesión anónima tiene un menú ya generado$/, async ({ page }) => {
  test.setTimeout(240_000);
  await generateRealGuestMenu(page);
});

When(/^permanece en \/menu$/, async ({ page }) => {
  await page.goto('/menu');
});

Then(/^ve un banner "Crea una cuenta para no perder este menú"$/, async ({ page }) => {
  await expect(page.getByTestId('guest_save_menu_banner')).toContainText('Crea una cuenta para no perder este menú');
});

Then(/^un enlace a \/signup$/, async ({ page }) => {
  await expect(page.getByTestId('guest_save_menu_banner').getByRole('link')).toHaveAttribute('href', '/signup');
});

// Shared with the `@registro` "email ya registrado" scenario (signup.steps.ts's feature).
When(/^confirma el formulario de \/signup$/, async ({ page }) => {
  await page.getByTestId('signup_submit_button').click();
});

// ── @edge-case "Una password débil se rechaza antes del roundtrip de OTP" (FRESCO-463) ──
//
// FRESCO-123: `app/signup/page.tsx` `handleSubmit` runs `isPasswordTooShort`
// (client mirror of the server `minimum_password_length`, `lib/validation/
// password-policy.ts`) BEFORE the anonymous-conversion `updateUser({ email })`
// call that would send a real OTP email — so a too-short password never
// reaches the OTP screen.

/** A password below `MIN_PASSWORD_LENGTH` (10) — the exact value doesn't matter, only that it's short. */
const SHORT_PASSWORD = '123';

Given(/^que una invitada rellena \/signup con un email nuevo y una password demasiado corta$/, async ({ page }) => {
  await ensureAnonymousSession(page);
  await page.goto('/signup');
  await page.getByTestId('email_input').fill(`hola.frescoapp+e2e-${crypto.randomUUID()}@gmail.com`);
  await page.getByTestId('password_input').fill(SHORT_PASSWORD);
  await page.getByTestId('confirm_age_checkbox').check();
  await page.getByTestId('accept_terms_checkbox').check();
});

Then(/^se rechaza de inmediato, sin llegar a la pantalla de OTP$/, async ({ page }) => {
  await expect(page.getByTestId('signup_error_message')).toContainText('caracteres');
  await expect(page.getByTestId('otp_code_input')).toHaveCount(0);
  await expect(page).toHaveURL(/\/signup(\?|$)/);
});

// ── @edge-case "El botón de confirmar código OTP solo se habilita con 6 dígitos" (FRESCO-463) ──
//
// The OTP screen is reached by the real anonymous-conversion branch
// (`user?.is_anonymous` → `updateUser({ email })` → `setStep('otp')`). That
// PUT is route-mocked to a success so no real email-change verification mail
// is sent; the button's `disabled={isVerifyingOtp || otpCode.length !== 6}`
// logic is pure client state and needs no backend.

Given(/^que la invitada está en la pantalla de OTP$/, async ({ page }) => {
  await ensureAnonymousSession(page);

  const newEmail = `hola.frescoapp+e2e-${crypto.randomUUID()}@gmail.com`;
  const nowIso = new Date().toISOString();

  // Keep the leaked-password pre-check offline + deterministic: no suffix in
  // the range body matches this password's SHA-1, so it reads as not-pwned.
  await page.route('**/api.pwnedpasswords.com/range/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/plain', body: '0000000000000000000000000000000000A:1' });
  });

  // `updateUser({ email })` on the anonymous user → PUT /auth/v1/user. Supabase
  // really queues the email change and returns 200; mock it so the flow
  // advances to the OTP step without dispatching a real verification email.
  // The initial GET /auth/v1/user (getUser) must still hit the real backend —
  // that's what proves the session is anonymous.
  await page.route(/\/auth\/v1\/user(\?|$)/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-4000-8000-0000000000aa',
        aud: 'authenticated',
        role: 'authenticated',
        email: '',
        new_email: newEmail,
        phone: '',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
        identities: [],
        created_at: nowIso,
        updated_at: nowIso,
      }),
    });
  });

  await page.goto('/signup');
  await page.getByTestId('email_input').fill(newEmail);
  await page.getByTestId('password_input').fill(`E2e-Otp-Screen-${Date.now()}!`);
  await page.getByTestId('confirm_age_checkbox').check();
  await page.getByTestId('accept_terms_checkbox').check();
  await page.getByTestId('signup_submit_button').click();
  await expect(page.getByTestId('otp_code_input')).toBeVisible();
});

When(/^escribe menos de 6 dígitos$/, async ({ page }) => {
  await page.getByTestId('otp_code_input').fill('123');
});

Then(/^el botón "Confirmar código" permanece deshabilitado$/, async ({ page }) => {
  await expect(page.getByTestId('signup_verify_otp_button')).toBeDisabled();
});

Then(/^al completar los 6 dígitos el botón se habilita$/, async ({ page }) => {
  await page.getByTestId('otp_code_input').fill('123456');
  await expect(page.getByTestId('signup_verify_otp_button')).toBeEnabled();
});
