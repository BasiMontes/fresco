// Next.js/browser-side environment schema — validated once at import time so
// a missing or malformed var fails fast at boot instead of surfacing as
// `undefined` three layers deep inside a fetch call (e.g. the
// `NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL ?? ''` pattern this replaces in
// `lib/api/edge-functions.ts`).
//
// Only NEXT_PUBLIC_* (browser-safe) vars belong here — Next.js inlines them
// into the client bundle at build time via static analysis of the literal
// `process.env.NEXT_PUBLIC_*` expressions below, so this module is safe to
// import from both Server and Client Components.
//
// Server-only secrets (SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL,
// SUPABASE_ANON_KEY) are validated separately in
// `api/config/env.ts` — a Bun-script-only module, never imported here or
// from `app/`/`components/`. Do not merge the two: doing so would risk a
// secret leaking into the client bundle.

import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({ message: 'NEXT_PUBLIC_SUPABASE_URL is required — copy .env.example to .env and fill it in' })
    .url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL (e.g. https://<project-ref>.supabase.co)'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string({ message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required — copy .env.example to .env and fill it in' })
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY cannot be empty'),
  NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL: z
    .string({ message: 'NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL is required — copy .env.example to .env and fill it in' })
    .url('NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL must be a valid URL (e.g. https://<project-ref>.functions.supabase.co)'),
  // FRESCO-241 PR2: optional (not required) — the push opt-in toggle
  // feature-detects its absence and disables itself rather than crashing.
  // Same value as the server-only VAPID_PUBLIC_KEY (.env.example) — VAPID
  // public keys aren't secret, they're just what pushManager.subscribe()
  // needs client-side. Server keeps the private key.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

function parseClientEnv(): ClientEnv {
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL: process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });

  if (!result.success) {
    const issues = result.error.issues
      .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid client environment variables:\n${issues}`);
  }

  return result.data;
}

let cachedClientEnv: ClientEnv | undefined;

/**
 * Validated, typed client-safe env vars. Import this instead of reading
 * `process.env.NEXT_PUBLIC_*` directly.
 *
 * Validation is deferred to the first property READ (not module import),
 * via this Proxy, so that merely importing a module which references
 * `clientEnv` doesn't run validation — e.g. `next build`'s static
 * prerendering pass imports the whole module graph without real secrets
 * present in every CI/scaffolding stage, for pages that never actually read
 * a var during render. The first real read (a request, or a client
 * component mounting) still throws immediately and loudly if a var is
 * missing/invalid — this is "fail fast at first use," not a silent `?? ''`
 * fallback surfacing as a cryptic error three layers deep.
 */
export const clientEnv: ClientEnv = new Proxy({} as ClientEnv, {
  get(_target, prop: string) {
    cachedClientEnv ??= parseClientEnv();
    return cachedClientEnv[prop as keyof ClientEnv];
  },
});
