// FRESCO-799 (audit-6 A6-S7): Cloudflare Turnstile captcha on the Supabase Auth
// endpoints that create or probe accounts (anonymous sign-in, sign-up,
// password sign-in, password reset, resend). Guest sign-in is free and
// unattended (ADR-0003), so per-user limits are only as strong as the cost of
// a new user; the captcha is what puts a price on one.
//
// The captcha is opt-in per build: with no site key there is no widget and no
// token, so a deploy can ship this code before the Supabase setting is on.
// Supabase enforces it for every Auth call once it is enabled, so the switch
// in the hosted dashboard is flipped only after the widget is live everywhere.

/** Public (safe for the browser). Inlined at build time. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

export function isCaptchaConfigured(siteKey: string = TURNSTILE_SITE_KEY): boolean {
  return siteKey.trim().length > 0;
}

/**
 * The `captchaToken` option the Supabase Auth methods take. `undefined` (not an
 * empty string) when there is no token, so the field is omitted from the request.
 */
export function captchaOptions(token: string | null): { captchaToken: string | undefined } {
  return { captchaToken: token ?? undefined };
}
