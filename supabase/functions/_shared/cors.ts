// Shared CORS headers for Edge Function calls. Originally a wildcard origin
// ("dev-time convenience", api-contracts.md §0) — narrowed per FRESCO-33 to
// the app's real origins now that they're known.
//
// One entry per real deployed environment (see `git_strategy.description`
// in `.agents/project.yaml` for the three-tier URL map):
//   - fresco-pro.vercel.app  — production (main)
//   - fresco-pre.vercel.app  — staging
//   - fresco-dev.vercel.app  — dev
//
// FRESCO-297: `fresco-dev.vercel.app` was missing — the three-tier upgrade
// (2026-08-21) made dev a real environment but this list was never updated,
// so every Edge Function call from dev got a preflight-200 with no
// `Access-Control-Allow-Origin` header and the browser hard-blocked the
// real request (`TypeError: Failed to fetch` — user saw "No pudimos
// conectar con el servidor"). Same failure mode FRESCO-193 fixed for
// `fresco-pre`. `fresco-staging.vercel.app` removed here: it is an old
// stale alias (`.agents/project.yaml` — "do not use it").
const DEPLOYED_ORIGINS = [
  'https://fresco-pro.vercel.app',
  'https://fresco-pre.vercel.app',
  'https://fresco-dev.vercel.app',
]

const LOCAL_DEV_ORIGIN = 'http://localhost:3000'

/**
 * FRESCO-364 (audit-4 A4-L2): `http://localhost:3000` must never be an
 * allowed origin on the HOSTED deployment — a page served from localhost
 * could otherwise make credentialed calls to the production backend.
 *
 * The Edge Functions are a single deployment shared by every environment,
 * so the per-environment signal is `SUPABASE_URL` (platform-injected):
 *   - hosted   → `https://<ref>.supabase.co`
 *   - local stack (`supabase start`, incl. CI) → `http://kong:8000`
 *
 * Local development that needs to call Edge Functions from a browser must
 * therefore run against the local Supabase stack (`supabase start`), not
 * the hosted project — the same setup CI uses.
 */
export function isHostedSupabase(supabaseUrl: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\b/i.test(supabaseUrl)
}

/**
 * The one origin to echo back in `Access-Control-Allow-Origin` for this
 * request, or `null` when the origin is not allowed (browsers treat a
 * missing ACAO as a hard CORS block). Pure — the caller passes the
 * platform `SUPABASE_URL` so this stays unit-testable without `Deno`.
 */
export function resolveAllowedOrigin(requestOrigin: string | null, supabaseUrl: string): string | null {
  if (!requestOrigin) {
    return null
  }
  const allowed = isHostedSupabase(supabaseUrl)
    ? DEPLOYED_ORIGINS
    : [...DEPLOYED_ORIGINS, LOCAL_DEV_ORIGIN]
  return allowed.includes(requestOrigin) ? requestOrigin : null
}

function supabaseUrl(): string {
  return (typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_URL') : undefined) ?? ''
}

/**
 * Origin-aware CORS headers. `Access-Control-Allow-Origin` can only ever
 * echo back one specific origin (never a list) — an unrecognized origin
 * gets no ACAO header at all, which browsers treat as a hard CORS block.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  const allowedOrigin = resolveAllowedOrigin(req.headers.get('origin'), supabaseUrl())
  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin
  }
  return headers
}

/** Returns the CORS preflight response, or null if this isn't a preflight request. */
export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) })
  }
  return null
}
