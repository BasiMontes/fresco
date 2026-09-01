/**
 * Sanitizes an attacker-controllable `next` / redirect query parameter down
 * to a same-origin relative path, or `/` when it is anything else.
 *
 * FRESCO-364 (audit-4 A4-L1): the earlier inline guard in
 * `app/auth/confirm/route.ts` checked `startsWith('/') && !startsWith('//')`
 * but not the leading backslash — browsers treat `\` as `/`, so
 * `next=/\evil.com` slipped through and `new URL()` resolved it to an
 * external origin, an open redirect right after a successful auth verify.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) {
    return '/';
  }

  // Backslashes have no legitimate place in an in-app path, and browsers
  // treat them as `/` — `\evil.com` / `\\evil.com` / `/\evil.com` are
  // protocol-relative redirects in disguise. Reject the lot outright.
  if (raw.includes('\\')) {
    return '/';
  }

  // Must be an absolute in-app path, and not protocol-relative (`//host`).
  if (!raw.startsWith('/') || raw.startsWith('//')) {
    return '/';
  }

  // Belt-and-suspenders: resolve against a throwaway origin and confirm the
  // path never escaped it (catches `/../` traversal, embedded credentials,
  // and anything else `new URL` would still relocate).
  try {
    const resolved = new URL(raw, 'http://localhost');
    if (resolved.origin !== 'http://localhost') {
      return '/';
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  }
  catch {
    return '/';
  }
}
