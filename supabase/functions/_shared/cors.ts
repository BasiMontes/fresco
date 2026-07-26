// Shared CORS headers for local/dev-time Edge Function calls.
// Source: fresco-edge-function-generate.md, fresco-shopping-list.md,
// fresco-aprendizaje.md (all three founder drafts repeat this block
// verbatim — centralized here instead). api-contracts.md §0 documents this
// as "dev-time convenience; source docs do not scope this further for
// production" — narrowing Access-Control-Allow-Origin for a real production
// deploy is a follow-up, not invented here.

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Returns the CORS preflight response, or null if this isn't a preflight request. */
export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  return null
}
