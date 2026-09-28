/**
 * Server-only admin allowlist check for Next.js code paths (Server
 * Components, Route Handlers). Mirrors `requireAdminUser()`
 * (`supabase/functions/_shared/admin.ts`) exactly — same comma-separated
 * `ADMIN_USER_ID` allowlist, same "no `is_admin` DB column" boundary
 * (FRESCO-237) — but reads `process.env` (Node) instead of `Deno.env`
 * (Edge Function runtime), so the two can't share a literal module.
 *
 * Utility, silent-fail shape (CLAUDE.md §10): returns a boolean rather than
 * throwing, since callers here gate a page render, not a mutation.
 */
export function isAdminUser(userId: string): boolean {
  const allowlist = (process.env.ADMIN_USER_ID ?? '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  return allowlist.includes(userId);
}
