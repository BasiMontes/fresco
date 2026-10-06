import { NextResponse } from 'next/server';
import { clientEnv } from '@/lib/env';
import { checkHealth } from '@/lib/health/check-health';

/**
 * GET /api/health — liveness for an external monitor (FRESCO-803, audit-6
 * A6-D7). Public and unauthenticated on purpose: a monitor has no session.
 * 200 when the app and Supabase answer, 503 when Supabase does not, so the
 * monitor alerts on the status code alone. Never cached.
 *
 * Deliberately shallow: it does not touch Stripe or the Edge Functions (a
 * monitor calling them every few minutes would cost real requests); those are
 * covered by Sentry alerts, see `docs/workflows/observability.md`.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const report = await checkHealth({
    supabaseUrl: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA,
    environment: process.env.VERCEL_ENV,
  });

  if (report.status !== 'ok') {
    console.error('[/api/health] a dependency did not answer', JSON.stringify(report.checks));
  }

  return NextResponse.json(report, {
    status: report.status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
