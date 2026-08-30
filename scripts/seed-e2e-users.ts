#!/usr/bin/env bun
/**
 * seed-e2e-users.ts — FRESCO-310
 *
 * Creates the two fixed test accounts the Playwright/BDD e2e suite needs
 * (`DEV_USER_EMAIL` / `PRO_USER_EMAIL`, see tests/steps/*.steps.ts) on a LOCAL
 * or CI Supabase stack, right after `supabase db reset`. This is the local
 * equivalent of the shared prod test accounts the suite used to depend on —
 * it lets `test:e2e` run against `127.0.0.1:54321` with no prod backend.
 *
 * Why a script and not pure `seed.sql`:
 *   - `auth.users` + GoTrue `auth.identities` rows are version-sensitive to
 *     hand-write; the GoTrue admin API (`POST /auth/v1/admin/users`,
 *     `email_confirm: true` — the exact call `tests/test-user-factory.ts`
 *     already makes) always produces a valid, loginable user.
 *   - `user_profiles` / `rate_limit_exempt_users` are then written straight to
 *     Postgres via `Bun.sql` (running as the `postgres` superuser, so RLS and
 *     the locked-down grants on `rate_limit_exempt_users` are not in the way).
 *     The `protect_subscription_columns` trigger (ADR-0007) is BEFORE UPDATE
 *     only, so setting `plan` on the initial INSERT is allowed.
 *
 * Idempotent: every run first deletes any existing account with these emails
 * (FK `ON DELETE CASCADE` from every user-owned table cleans the rest), then
 * recreates from scratch.
 *
 * Usage:  bun scripts/seed-e2e-users.ts
 *
 * Env (all have local-demo defaults so a bare `supabase start` + this script
 * just works; CI passes the same values via .env.ci):
 *   SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL   local API URL (default 127.0.0.1:54321)
 *   SUPABASE_SERVICE_ROLE_KEY                  local service_role JWT
 *   SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY   local anon JWT (login check)
 *   SUPABASE_DB_URL                            default postgresql://postgres:postgres@127.0.0.1:54322/postgres
 *   DEV_USER_EMAIL / DEV_USER_PASSWORD         free-plan account
 *   PRO_USER_EMAIL / PRO_USER_PASSWORD         pro-plan account
 */

import { SQL } from 'bun';

// Standard Supabase local-dev demo keys (identical on every machine — issuer
// `supabase-demo`). Only used as a fallback when the env var is absent.
const LOCAL_DEMO_SERVICE_ROLE_KEY
  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const LOCAL_DEMO_ANON_KEY
  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

/** `process.env.X` but treating "" (and whitespace) as absent. */
function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

const API_URL = (env('SUPABASE_URL') ?? env('NEXT_PUBLIC_SUPABASE_URL') ?? 'http://127.0.0.1:54321').replace(/\/$/, '');
const SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY') ?? LOCAL_DEMO_SERVICE_ROLE_KEY;
const ANON_KEY = env('SUPABASE_ANON_KEY') ?? env('NEXT_PUBLIC_SUPABASE_ANON_KEY') ?? LOCAL_DEMO_ANON_KEY;
const DB_URL = env('SUPABASE_DB_URL') ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

// Hard safety rail: this script CREATES and DELETES auth users. It must only
// ever touch a local stack. `bun` auto-loads `.env`, which on a dev machine
// holds the PROD project URL — without this guard, a bare
// `bun scripts/seed-e2e-users.ts` would aim admin-API calls at production.
function assertLocal(label: string, value: string): void {
  if (!/(?:127\.0\.0\.1|localhost|::1)(?::\d+)?(?:\/|$)/.test(value)) {
    console.error(
      `[seed-e2e-users] refusing to run: ${label} is not a local address:\n  ${value}\n`
      + 'This script only seeds a local / CI Supabase stack. Run `supabase start` and\n'
      + 'either unset SUPABASE_URL / SUPABASE_DB_URL or point them at 127.0.0.1.',
    );
    process.exit(1);
  }
}
assertLocal('SUPABASE_URL', API_URL);
assertLocal('SUPABASE_DB_URL', DB_URL);

interface SeedUser {
  label: string
  email: string
  password: string
  plan: 'free' | 'pro'
}

const USERS: SeedUser[] = [
  {
    label: 'DEV',
    email: env('DEV_USER_EMAIL') ?? 'hola.frescoapp+e2e-dev@gmail.com',
    password: env('DEV_USER_PASSWORD') ?? 'E2e-Local-Dev-Aa1!',
    plan: 'free',
  },
  {
    label: 'PRO',
    email: env('PRO_USER_EMAIL') ?? 'hola.frescoapp+e2e-pro@gmail.com',
    password: env('PRO_USER_PASSWORD') ?? 'E2e-Local-Pro-Aa1!',
    plan: 'pro',
  },
];

function adminHeaders(): Record<string, string> {
  return {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function createAuthUser(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) {
    throw new Error(`[seed-e2e-users] create ${email} failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json() as { id: string };
  return body.id;
}

async function assertLogin(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json() as { access_token?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`[seed-e2e-users] login check for ${email} failed: ${res.status} ${JSON.stringify(body)}`);
  }
}

async function main(): Promise<void> {
  console.log(`[seed-e2e-users] target: ${API_URL}  db: ${DB_URL.replace(/:[^:@/]+@/, ':***@')}`);
  const sql = new SQL(DB_URL);

  try {
    const emails = USERS.map(u => u.email);

    // 1. Wipe any prior run — cascades through every user-owned table.
    await sql`delete from auth.users where email in ${sql(emails)}`;

    for (const user of USERS) {
      // 2. Fresh GoTrue user (valid identity + hashed password).
      const id = await createAuthUser(user.email, user.password);

      // 3. Profile row. `plan` is settable on INSERT (ADR-0007 trigger is
      //    BEFORE UPDATE only). Runs as `postgres` → RLS bypassed.
      await sql`
        insert into public.user_profiles (id, plan)
        values (${id}, ${user.plan})
        on conflict (id) do update set plan = excluded.plan
      `;

      // 4. Exempt from the generate-meal-plan rate limit (FRESCO-310).
      await sql`
        insert into public.rate_limit_exempt_users (user_id, note)
        values (${id}, ${`local e2e ${user.label} account: ${user.email}`})
        on conflict (user_id) do nothing
      `;

      await assertLogin(user.email, user.password);
      console.log(`[seed-e2e-users] ${user.label.padEnd(3)} ${user.email}  id=${id}  plan=${user.plan}  ✓ login`);
    }
  }
  finally {
    await sql.end();
  }

  console.log('[seed-e2e-users] done.');
}

await main();
