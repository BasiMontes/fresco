/**
 * FRESCO-803 (audit-6 A6-D7) — what `GET /api/health` reports.
 *
 * Two facts: the app answered (you are reading this), and Supabase answered a
 * real read. The Supabase probe is a one-row read of the public `recipes`
 * catalog with the anon key, so it exercises the API gateway, PostgREST and
 * Postgres the same way a visitor's request does, without any secret beyond
 * the public anon key the browser already holds.
 *
 * The report never carries an error message or a URL: a monitor needs
 * "ok / down" and the commit, and a public endpoint must not explain what is
 * broken. The detail goes to the platform logs.
 */

export type HealthStatus = 'ok' | 'down';

export interface HealthReport {
  status: HealthStatus
  /** First 7 characters of the deployed commit, or `null` outside Vercel. */
  commit: string | null
  environment: string | null
  checks: { app: 'ok', supabase: HealthStatus }
}

export interface CheckHealthInput {
  supabaseUrl: string
  anonKey: string
  commitSha?: string | undefined
  environment?: string | undefined
  /** Injected in tests. */
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 3000;

async function supabaseAnswers({ supabaseUrl, anonKey, fetchImpl, timeoutMs }: Required<Pick<CheckHealthInput, 'supabaseUrl' | 'anonKey' | 'fetchImpl' | 'timeoutMs'>>): Promise<boolean> {
  try {
    const response = await fetchImpl(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/recipes?select=id&limit=1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    return response.ok;
  }
  catch {
    return false;
  }
}

export async function checkHealth(input: CheckHealthInput): Promise<HealthReport> {
  const supabase = await supabaseAnswers({
    supabaseUrl: input.supabaseUrl,
    anonKey: input.anonKey,
    fetchImpl: input.fetchImpl ?? fetch,
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  })
    ? 'ok'
    : 'down';

  return {
    status: supabase === 'ok' ? 'ok' : 'down',
    commit: input.commitSha ? input.commitSha.slice(0, 7) : null,
    environment: input.environment ?? null,
    checks: { app: 'ok', supabase },
  };
}
