// Shared CORS headers for Edge Function calls. Originally a wildcard origin
// ("dev-time convenience", api-contracts.md §0) — narrowed per FRESCO-33 to
// the app's real origins now that they're known.
//
// One entry per real deployed environment (see `git_strategy.description`
// in `.agents/project.yaml` for the three-tier URL map):
//   - fresco-pro.vercel.app  — production (main)
//   - fresco-pre.vercel.app  — staging
//   - fresco-dev.vercel.app  — dev
//   - http://localhost:3000  — local dev against real Edge Functions
//
// FRESCO-297: `fresco-dev.vercel.app` was missing — the three-tier upgrade
// (2026-08-21) made dev a real environment but this list was never updated,
// so every Edge Function call from dev got a preflight-200 with no
// `Access-Control-Allow-Origin` header and the browser hard-blocked the
// real request (`TypeError: Failed to fetch` — user saw "No pudimos
// conectar con el servidor"). Same failure mode FRESCO-193 fixed for
// `fresco-pre`. `fresco-staging.vercel.app` removed here: it is an old
// stale alias (`.agents/project.yaml` — "do not use it").
const ALLOWED_ORIGINS = new Set([
  'https://fresco-pro.vercel.app',
  'https://fresco-pre.vercel.app',
  'https://fresco-dev.vercel.app',
  'http://localhost:3000',
])

/**
 * Origin-aware CORS headers. `Access-Control-Allow-Origin` can only ever
 * echo back one specific origin (never a list) — an unrecognized origin
 * gets no ACAO header at all, which browsers treat as a hard CORS block.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
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
