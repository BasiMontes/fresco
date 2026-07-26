// Thin Gemini Flash API client shared by generate-meal-plan and
// generate-shopping-list. This is HTTP transport + response-shape unwrapping
// — not prompt-engineering — so unlike each function's own prompt.ts (which
// is deferred, see their TODOs), it is implemented for real here.
//
// Model string + endpoint per fresco-edge-function-generate.md /
// fresco-shopping-list.md. architecture.md §2 flags `gemini-1.5-flash` as a
// versioning risk (Google may deprecate/change it silently) — pinned as-is
// per the founder's explicit choice, not revisited here.

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export interface GeminiGenerationConfig {
  temperature: number
  maxOutputTokens: number
}

export interface GeminiCallResult {
  ok: boolean
  rawText: string
  errorText?: string
}

export interface CallGeminiParams {
  systemPrompt: string
  userPrompt: string
  config: GeminiGenerationConfig
}

/**
 * Calls Gemini Flash with a system+user prompt pair and native JSON output
 * mode (`responseMimeType: 'application/json'`, per NFR-PERF-1 / the
 * "rara vez devuelve JSON malformado" rationale in architecture.md §2).
 * Does not parse or validate the returned text — each caller owns its own
 * JSON-parse + structural validation, since the expected shape differs per
 * endpoint (api-contracts.md §1 vs §2).
 *
 * CLAUDE.md §10: 3+ params → object param, hence the single-object signature.
 */
export async function callGemini({
  systemPrompt,
  userPrompt,
  config,
}: CallGeminiParams): Promise<GeminiCallResult> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    return { ok: false, rawText: '', errorText: 'GEMINI_API_KEY not configured' }
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!response.ok) {
    return { ok: false, rawText: '', errorText: await response.text() }
  }

  const body = await response.json()
  const rawText = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return { ok: true, rawText }
}
