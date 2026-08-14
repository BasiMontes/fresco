// Shared CORS headers for Edge Function calls. Originally a wildcard origin
// ("dev-time convenience", api-contracts.md §0) — narrowed per FRESCO-33 to
// the app's real origins now that they're known. `.agents/project.yaml`'s
// `environments.production.web_url` (fresco-pro.vercel.app) and
// `environments.staging.web_url` (fresco-staging.vercel.app) are both
// listed, plus `fresco-pre.vercel.app` — a second alias of the same
// production deployment (`solo-main`-style Vercel project, confirmed via
// `vercel inspect`: both alias the same deployment id) that the team has
// used interchangeably with `fresco-pro.vercel.app` for QA since 2026-08-04
// but that was never added here, silently CORS-blocking every Edge Function
// call made from it. `http://localhost:3000` covers local dev against real
// Edge Functions.
const ALLOWED_ORIGINS = new Set([
  'https://fresco-pro.vercel.app',
  'https://fresco-pre.vercel.app',
  'https://fresco-staging.vercel.app',
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
