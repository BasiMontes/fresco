import { NextResponse } from 'next/server';
import { readJobStatuses } from '@/lib/jobs/heartbeat';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * GET /api/health/jobs — is each scheduled job still running? (FRESCO-915, definitive audit C-11.)
 * Public and unauthenticated on purpose, like `/api/health`: the GitHub monitor has no session.
 * `200` when every job reported recently or has not reported yet (`pending`), `503` when one went
 * stale or the heartbeats cannot be read, so the monitor alerts on the status code alone.
 *
 * The body carries statuses only (`ok`, `stale`, `pending`), never a timestamp, an age or an error:
 * a public endpoint says "ok or not", and the detail goes to the platform logs. Never cached.
 *
 * It reads `job_heartbeat` with the service role because that table is closed to every client role;
 * what leaves this route is the status, not a row.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const jobs = await readJobStatuses(createServiceClient());
    const stale = Object.entries(jobs).filter(([, status]) => status === 'stale').map(([job]) => job);

    if (stale.length > 0) {
      console.error('[/api/health/jobs] a scheduled job has not reported in time', JSON.stringify(stale));
    }

    return NextResponse.json({ status: stale.length > 0 ? 'stale' : 'ok', jobs }, {
      status: stale.length > 0 ? 503 : 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  catch (error) {
    console.error('[/api/health/jobs] could not read the job heartbeats', error);
    return NextResponse.json({ status: 'unknown' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
