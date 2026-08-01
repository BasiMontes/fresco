// Bun/Node-side environment configuration for backend tooling (e.g. a future
// admin/seed script that needs SUPABASE_SERVICE_ROLE_KEY). NOT consumed by
// the Edge Functions, which read `Deno.env.get()` directly per Supabase
// convention — see supabase/functions/_shared/supabase-client.ts. NOT
// consumed by the Next.js app either — client-safe (NEXT_PUBLIC_*) vars have
// their own schema at `lib/env.ts`, kept separate so a secret can never leak
// into the client bundle by accident.
//
// CLAUDE.md §10: public methods fail fast. `loadFrescoEnv()` throws a
// descriptive error the moment it's called with a required var missing,
// rather than letting a script fail later at the first Supabase call with an
// opaque "invalid API key" error. Kept as a callable function (not a
// module-level side effect) so importing just the `FrescoEnv` type doesn't
// force validation to run — callers invoke `loadFrescoEnv()` at their own
// entry point/boot.
//
// Same env var names as the Edge Functions use (SUPABASE_URL, not
// NEXT_PUBLIC_SUPABASE_URL) — see supabase/functions/_shared/supabase-client.ts.
// Documented in .env.example under "Fresco backend tooling (Bun scripts +
// Edge Functions)".

import { z } from 'zod';

const frescoEnvSchema = z.object({
  SUPABASE_URL: z
    .string({ message: 'SUPABASE_URL is required — copy .env.example to .env and fill it in' })
    .url('SUPABASE_URL must be a valid URL (e.g. https://<project-ref>.supabase.co)'),
  SUPABASE_ANON_KEY: z
    .string({ message: 'SUPABASE_ANON_KEY is required — copy .env.example to .env and fill it in' })
    .min(1, 'SUPABASE_ANON_KEY cannot be empty'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({ message: 'SUPABASE_SERVICE_ROLE_KEY is required — copy .env.example to .env and fill it in' })
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY cannot be empty'),
});

export interface FrescoEnv {
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceRoleKey: string
}

/**
 * Validates and loads the Bun-script-side env vars. Throws a single error
 * listing every missing/invalid var (not just the first) the moment it's
 * called — call this at the top of a script's entry point, not buried
 * inside a handler.
 */
export function loadFrescoEnv(): FrescoEnv {
  const result = frescoEnvSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!result.success) {
    const issues = result.error.issues
      .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid Fresco backend environment variables:\n${issues}`);
  }

  return {
    supabaseUrl: result.data.SUPABASE_URL,
    supabaseAnonKey: result.data.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: result.data.SUPABASE_SERVICE_ROLE_KEY,
  };
}
