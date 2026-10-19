/**
 * FRESCO-1006 (audit 7b A7-ABUSE-02) — server-side check of a Cloudflare Turnstile token.
 *
 * Supabase verifies the captcha itself on the Auth endpoints it protects (sign-up, sign-in, reset,
 * anonymous sign-in), but not on `updateUser({ email })`, the call that mails a code to an address
 * the guest typed. That call now goes through `POST /api/auth/guest-email`, which checks the token
 * here before it does anything.
 *
 * Three outcomes, so the caller can tell a bad token from a broken check: `invalid` (Cloudflare says
 * the token is wrong, expired or already used) is the person's problem; `unavailable` (no answer, a
 * non-200, Cloudflare's own `internal-error`) is ours, and the caller refuses instead of letting the
 * request through unchecked.
 */
export type TurnstileVerdict = 'ok' | 'invalid' | 'unavailable';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const DEFAULT_TIMEOUT_MS = 5000;

interface SiteverifyResponse {
  'success'?: boolean
  'error-codes'?: string[]
}

export async function verifyTurnstileToken({ token, secret, remoteIp, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }: {
  token: string
  secret: string
  remoteIp?: string | null
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): Promise<TurnstileVerdict> {
  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp) { form.set('remoteip', remoteIp); }

  try {
    const response = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) { return 'unavailable'; }

    const result = await response.json() as SiteverifyResponse;
    if (result.success === true) { return 'ok'; }
    return result['error-codes']?.includes('internal-error') ? 'unavailable' : 'invalid';
  }
  catch {
    return 'unavailable';
  }
}
