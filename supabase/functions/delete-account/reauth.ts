// FRESCO-397 (A4-L11): pure helpers for the recent-re-authentication check.
// The network side (verifying the token is authentic via `auth.getUser()`)
// stays in index.ts; everything here is signature-free payload math so it can
// be unit-tested without a Supabase client.

/**
 * `iat` (seconds since epoch) from a JWT payload, base64url-decoded WITHOUT
 * verifying the signature. Authenticity is established separately by
 * `auth.getUser()` before this value is trusted. Returns null for a token
 * that is malformed or missing a numeric `iat`.
 */
export function jwtIssuedAt(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    let b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    b64 += '='.repeat((4 - (b64.length % 4)) % 4)
    const iat = (JSON.parse(atob(b64)) as { iat?: unknown }).iat
    return typeof iat === 'number' ? iat : null
  }
  catch {
    return null
  }
}

/**
 * True only if `token` carries a readable `iat` no older than `maxAgeSeconds`
 * relative to `nowSeconds`. A token issued in the future (clock skew beyond a
 * minute, or a forged payload) is also rejected.
 */
export function isTokenRecent(
  token: string,
  maxAgeSeconds: number,
  nowSeconds: number = Date.now() / 1000,
): boolean {
  const iat = jwtIssuedAt(token)
  if (iat === null) return false
  const ageSeconds = nowSeconds - iat
  return ageSeconds >= -60 && ageSeconds <= maxAgeSeconds
}
