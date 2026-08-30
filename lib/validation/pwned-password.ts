/**
 * Leaked-password check against the Pwned Passwords range API (FRESCO-32).
 *
 * Supabase's own `leaked_password_protection` is gated to the Pro plan and
 * this project's org is on Free, so this reproduces the same protection
 * client-side. It uses the range API's **k-anonymity** model: only the first
 * 5 hex chars of the password's SHA-1 hash ever leave the browser — the
 * password itself never does.
 *
 * Fail-open by design: this is a hygiene nudge, not a hard gate. Any network
 * error, timeout, or non-OK response returns `false` (treated as "not
 * known-breached") so a third-party outage can never block account creation.
 */

/** Uppercase hex SHA-1 of `input`, via WebCrypto (browser + edge + Bun). */
async function sha1Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

const RANGE_API = 'https://api.pwnedpasswords.com/range';
const TIMEOUT_MS = 3000;

/** Shown when {@link isPasswordPwned} returns `true`. */
export const PWNED_PASSWORD_MESSAGE
  = 'Esta contraseña ha aparecido en filtraciones de datos conocidas. Elige una diferente.';

/**
 * Resolves `true` only when the password is positively found in the Pwned
 * Passwords dataset. Every uncertain outcome (offline, slow, malformed
 * response) resolves `false` — see the fail-open note in the file header.
 */
export async function isPasswordPwned(password: string): Promise<boolean> {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let body: string;
    try {
      const response = await fetch(`${RANGE_API}/${prefix}`, {
        // Padding masks the real result-set size, a documented range-API
        // privacy option (https://haveibeenpwned.com/API/v3#PwnedPasswordsPadding).
        headers: { 'Add-Padding': 'true' },
        signal: controller.signal,
      });
      if (!response.ok) {
        return false;
      }
      body = await response.text();
    }
    finally {
      clearTimeout(timer);
    }

    // Each line is `SUFFIX:COUNT`. Padding entries carry `COUNT === 0`.
    return body.split('\n').some((line) => {
      const [lineSuffix, count] = line.split(':');
      return lineSuffix?.trim().toUpperCase() === suffix && Number(count?.trim()) > 0;
    });
  }
  catch (error) {
    console.error('[isPasswordPwned] check skipped', error);
    return false;
  }
}
