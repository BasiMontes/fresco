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
//
// FRESCO-1170: opt-in does NOT hold in production. The two routes that check the
// token themselves (`/api/waitlist`, `/api/auth/guest-email`) used to skip the check
// silently on a build with no site key, leaving only the per-IP limits in front of
// an email sent to any address. `captchaMissingInProduction` is how they refuse.

/** Public (safe for the browser). Inlined at build time. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

export function isCaptchaConfigured(siteKey: string = TURNSTILE_SITE_KEY): boolean {
  return siteKey.trim().length > 0;
}

/**
 * FRESCO-1170: true when this is the production deploy (`VERCEL_ENV=production`) and the build carries no Turnstile
 * site key. The routes that verify the token on the server refuse then, instead of treating "no key" as "no
 * captcha": a production build that lost the variable must stop sending email to arbitrary addresses, not go on
 * unchecked. Only the production deploy counts: previews, local runs and the CI build (no `VERCEL_ENV`) keep the
 * opt-in behaviour, so nothing that runs without the key breaks.
 */
export function captchaMissingInProduction(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === 'production' && !isCaptchaConfigured(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '');
}

/**
 * The `captchaToken` option the Supabase Auth methods take. `undefined` (not an
 * empty string) when there is no token, so the field is omitted from the request.
 */
export function captchaOptions(token: string | null): { captchaToken: string | undefined } {
  return { captchaToken: token ?? undefined };
}
