/**
 * FRESCO-816 (audit-6 A6-S13): how recently a session token was issued.
 *
 * `reassign-guest-data` only verifies the target account's token (ADR-0022), and a
 * valid access token stays valid for up to an hour. Ownership of an account is
 * proven by signing in NOW, so a token the caller picked up long ago (a leaked or
 * stolen one) must not be enough to move data into that account. The client signs
 * in and calls the function straight away, so a short window costs a genuine
 * conversion nothing.
 *
 * Reads `iat` from the payload WITHOUT verifying the signature: call it only on a
 * token `auth.getUser()` has already accepted, which is what verifies it.
 */

/** A genuine conversion calls this seconds after the sign-in; 5 minutes is generous. */
export const MAX_TOKEN_AGE_SECONDS = 300

/** Tolerated clock difference between the Auth server that issued the token and this runtime. */
const CLOCK_SKEW_SECONDS = 60

/** The `iat` claim (seconds since the epoch), or `null` when the token has no readable one. */
export function readIssuedAt(token: string): number | null {
  const payload = token.split('.')[1]
  if (!payload) return null

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const claims = JSON.parse(atob(padded)) as { iat?: unknown }
    return typeof claims.iat === 'number' && Number.isFinite(claims.iat) ? claims.iat : null
  }
  catch {
    return null
  }
}

interface RecencyOptions {
  /** Injectable clock for tests; seconds since the epoch. */
  nowSeconds?: number
  maxAgeSeconds?: number
}

/** True when the token was issued within `maxAgeSeconds` (and not from the future). Missing `iat` is not recent. */
export function isTokenRecent(token: string, options: RecencyOptions = {}): boolean {
  const { nowSeconds = Math.floor(Date.now() / 1000), maxAgeSeconds = MAX_TOKEN_AGE_SECONDS } = options
  const issuedAt = readIssuedAt(token)
  if (issuedAt === null) return false

  const age = nowSeconds - issuedAt
  return age <= maxAgeSeconds && age >= -CLOCK_SKEW_SECONDS
}
