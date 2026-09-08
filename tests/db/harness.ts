/**
 * DB-integration test harness (FRESCO-464) — `bun test`, real Postgres, NOT e2e.
 *
 * This is the project's first test layer that runs against a real database
 * instead of a mocked `db.rpc` / mocked PostgREST client. It exists to satisfy
 * `.agents/skills/sprint-development/references/rpc-authorization.md` §5: a
 * `SECURITY DEFINER` function with a caller-supplied identity/scope parameter
 * needs a test that *attempts the spoof against the real database* — a mocked
 * call proves nothing about the function.
 *
 * ## What it talks to
 *
 * ONLY the Supabase CLI local stack (`supabase start`) on `127.0.0.1:54321`.
 * `assertLocalStack()` hard-refuses any non-localhost URL, the same last line of
 * defence `scripts/seed-e2e-users.ts` uses — a developer's `.env` normally
 * points `NEXT_PUBLIC_SUPABASE_URL` at the hosted project, and this harness
 * creates + deletes auth users, so it must never reach a hosted database.
 *
 * ## Credentials
 *
 * Supabase's public local-dev demo constants only (`iss: supabase-demo`),
 * read from the committed `.env.ci`. No hosted-project keys anywhere.
 *
 * ## Cleanup model (mirrors `tests/test-user-factory.ts`)
 *
 * Create a GoTrue auth user via the admin API → seed rows under that id with
 * the user's own token → `cleanupAll()` deletes the auth users → every
 * user-data table has an `ON DELETE CASCADE` FK back to `auth.users.id` /
 * `user_profiles.id`, so one admin delete removes everything the test created.
 * Uses `fetch` (not Playwright's `APIRequestContext`) so it runs under
 * `bun test`.
 */

import { join } from 'node:path';

export interface DbTestUser {
  id: string
  email: string
  /** A `password` grant access token → the `authenticated` Postgres role. */
  token: string
}

export interface CreateDbTestUserOptions {
  /** @default 'free' */
  plan?: 'free' | 'pro' | 'family'
}

export interface RpcResult {
  status: number
  /** Parsed JSON body when the response had one, else the raw text, else null. */
  body: unknown
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** A user access token → `authenticated` role. Omit + `serviceRole` for the seed/teardown path. */
  token?: string
  serviceRole?: boolean
  body?: unknown
  prefer?: string
}

const LOCAL_STACK_URL = 'http://127.0.0.1:54321';

/**
 * Bun's native `fetch`. Under `bun test`, `bun-test-setup.ts` stashes it here
 * before happy-dom swaps the global for an XHR-backed impl that rejects the
 * plain-HTTP local stack as mixed content. Outside the runner the global is
 * already native, so the fallback is a no-op.
 */
const nativeFetch: typeof fetch
  = (globalThis as { __FRESCO_NATIVE_FETCH__?: typeof fetch }).__FRESCO_NATIVE_FETCH__ ?? globalThis.fetch;

function resolveUrl(): string {
  const url = process.env.DB_IT_SUPABASE_URL ?? LOCAL_STACK_URL;
  assertLocalStack(url);
  return url.replace(/\/$/, '');
}

/**
 * Refuses anything that is not the local CLI stack. A hosted URL here would
 * mean this harness is about to create and delete real auth users on a shared
 * project. Same guard shape as `scripts/seed-e2e-users.ts`.
 */
export function assertLocalStack(url: string): void {
  let host: string;
  try {
    host = new URL(url).hostname;
  }
  catch {
    throw new Error(`[db-harness] DB_IT_SUPABASE_URL is not a valid URL: ${url}`);
  }
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(
      `[db-harness] refusing to run against a non-local Supabase host: ${host}. `
      + 'DB-integration tests only run against the `supabase start` local stack.',
    );
  }
}

let cachedCiEnv: Record<string, string> | undefined;

async function ciEnv(): Promise<Record<string, string>> {
  if (cachedCiEnv) {
    return cachedCiEnv;
  }
  const parsed: Record<string, string> = {};
  try {
    const text = await Bun.file(join(import.meta.dir, '../../.env.ci')).text();
    for (const line of text.split('\n')) {
      const eq = line.indexOf('=');
      if (eq === -1) {
        continue;
      }
      const key = line.slice(0, eq).trim();
      if (/^[A-Z0-9_]+$/.test(key)) {
        parsed[key] = line.slice(eq + 1).trim();
      }
    }
  }
  catch {
    // No .env.ci (unexpected — it is committed). Fall through to process.env.
  }
  cachedCiEnv = parsed;
  return parsed;
}

async function anonKey(): Promise<string> {
  const env = await ciEnv();
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('[db-harness] no anon key: .env.ci is missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return key;
}

async function serviceRoleKey(): Promise<string> {
  const env = await ciEnv();
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('[db-harness] no service-role key: .env.ci is missing SUPABASE_SERVICE_ROLE_KEY');
  }
  return key;
}

/** GET `/rest/v1/` → 200 means PostgREST (and Postgres behind it) is up. */
export async function stackReachable(): Promise<boolean> {
  try {
    const res = await nativeFetch(`${resolveUrl()}/rest/v1/`, {
      headers: { apikey: await anonKey() },
      signal: AbortSignal.timeout(2500),
    });
    return res.ok;
  }
  catch {
    return false;
  }
}

async function request(path: string, opts: RequestOptions = {}): Promise<RpcResult> {
  const method = opts.method ?? 'GET';
  const apikey = opts.serviceRole ? await serviceRoleKey() : await anonKey();
  const bearer = opts.serviceRole ? apikey : opts.token;
  const headers: Record<string, string> = { apikey, 'Content-Type': 'application/json' };
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }
  if (opts.prefer) {
    headers.Prefer = opts.prefer;
  }

  const res = await nativeFetch(`${resolveUrl()}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    }
    catch {
      body = text;
    }
  }
  return { status: res.status, body };
}

/** Call a PostgREST RPC endpoint. `token` → `authenticated`; omit + `serviceRole: true` for the service path. */
export async function rpc(
  fn: string,
  args: Record<string, unknown>,
  opts: { token?: string, serviceRole?: boolean } = {},
): Promise<RpcResult> {
  return request(`/rest/v1/rpc/${fn}`, {
    method: 'POST',
    token: opts.token,
    serviceRole: opts.serviceRole,
    body: args,
  });
}

/** Table read/write over PostgREST. `query` is the raw querystring, e.g. `id=eq.<uuid>&select=*`. */
export async function rest(
  table: string,
  opts: RequestOptions & { query?: string } = {},
): Promise<RpcResult> {
  const qs = opts.query ? `?${opts.query}` : '';
  return request(`/rest/v1/${table}${qs}`, opts);
}

async function createAuthUser(email: string, password: string): Promise<string> {
  const key = await serviceRoleKey();
  const res = await nativeFetch(`${resolveUrl()}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) {
    throw new Error(`[db-harness] create auth user failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json() as { id: string };
  return json.id;
}

async function deleteAuthUser(id: string): Promise<void> {
  const key = await serviceRoleKey();
  const res = await nativeFetch(`${resolveUrl()}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`[db-harness] delete auth user ${id} failed: ${res.status} ${await res.text()}`);
  }
}

async function passwordGrant(email: string, password: string): Promise<string> {
  const res = await nativeFetch(`${resolveUrl()}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': await anonKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`[db-harness] password grant failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json() as { access_token: string };
  return json.access_token;
}

async function seedProfileRow(
  id: string,
  accessToken: string,
  plan: NonNullable<CreateDbTestUserOptions['plan']>,
): Promise<void> {
  // Two-step seed, exactly as `tests/test-user-factory.ts`: the row is INSERTed
  // with the user's own token and no `plan` override, so it DB-defaults to
  // 'free'. A paid plan is a second write with the service-role key — the only
  // role `protect_subscription_columns` (ADR-0007) lets touch subscription
  // columns.
  const insert = await rest('user_profiles', {
    method: 'POST',
    token: accessToken,
    prefer: 'return=minimal',
    body: { id },
  });
  if (insert.status >= 300) {
    throw new Error(`[db-harness] seed user_profiles(${id}) failed: ${insert.status} ${JSON.stringify(insert.body)}`);
  }
  if (plan === 'free') {
    return;
  }
  const patch = await rest('user_profiles', {
    method: 'PATCH',
    serviceRole: true,
    query: `id=eq.${id}`,
    prefer: 'return=minimal',
    body: { plan },
  });
  if (patch.status >= 300) {
    throw new Error(`[db-harness] set plan=${plan} for ${id} failed: ${patch.status} ${JSON.stringify(patch.body)}`);
  }
}

export interface DbTestContext {
  /** Create + track an isolated auth user with a seeded `user_profiles` row. */
  createUser: (options?: CreateDbTestUserOptions) => Promise<DbTestUser>
  /** Delete every auth user this context created (cascade removes their data). */
  cleanupAll: () => Promise<void>
}

/**
 * One `{ createUser, cleanupAll }` pair per test file. Wire `cleanupAll` into an
 * `afterAll` (or `afterEach`) so a failed assertion never leaks a user into the
 * stack.
 */
export function createDbTestContext(): DbTestContext {
  const createdIds: string[] = [];

  const createUser = async (options: CreateDbTestUserOptions = {}): Promise<DbTestUser> => {
    const email = `hola.frescoapp+dbit-${crypto.randomUUID()}@gmail.com`;
    const password = `Db-It-${crypto.randomUUID()}-Aa1!`;
    const id = await createAuthUser(email, password);
    createdIds.push(id);
    const token = await passwordGrant(email, password);
    await seedProfileRow(id, token, options.plan ?? 'free');
    return { id, email, token };
  };

  const cleanupAll = async (): Promise<void> => {
    await Promise.all(createdIds.map(async (id) => {
      try {
        await deleteAuthUser(id);
      }
      catch (error) {
        console.error(`[db-harness] cleanup failed for ${id}:`, error);
      }
    }));
    createdIds.length = 0;
  };

  return { createUser, cleanupAll };
}

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;

/** Seeds a meal plan for `user` in a far-future week (no collision with any real plan). */
export async function seedMealPlan(
  user: DbTestUser,
  opts: { semanaIso?: string, fechaInicio?: string } = {},
): Promise<{ id: string, semanaIso: string }> {
  const semanaIso = opts.semanaIso ?? '2099-W01';
  const fechaInicio = opts.fechaInicio ?? '2099-01-05';
  const res = await rest('meal_plans', {
    method: 'POST',
    token: user.token,
    prefer: 'return=representation',
    body: { user_id: user.id, semana_iso: semanaIso, fecha_inicio: fechaInicio, advertencias: [] },
  });
  if (res.status >= 300 || !Array.isArray(res.body)) {
    throw new Error(`[db-harness] seedMealPlan failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { id: (res.body[0] as { id: string }).id, semanaIso };
}

/** N catalog recipe ids (the local stack's seed loads 1000). */
export async function catalogRecipeIds(user: DbTestUser, count: number): Promise<string[]> {
  const res = await rest('recipes', { token: user.token, query: `select=id&limit=${count}` });
  if (!Array.isArray(res.body) || res.body.length < count) {
    throw new Error(`[db-harness] catalogRecipeIds: expected ${count}, got ${JSON.stringify(res.body)}`);
  }
  return (res.body as { id: string }[]).map(r => r.id);
}

/**
 * Seeds `meal_plan_recipes` rows for `planId`. Each entry gets a distinct day so
 * the `(meal_plan_id, dia, tipo_plato)` uniqueness never trips.
 */
export async function seedSlots(
  user: DbTestUser,
  planId: string,
  slots: { recipeId: string, tipoPlato: 'desayuno' | 'comida' | 'cena', estado?: string }[],
): Promise<string[]> {
  const rows = slots.map((s, i) => ({
    meal_plan_id: planId,
    recipe_id: s.recipeId,
    dia: DIAS[i % DIAS.length],
    tipo_plato: s.tipoPlato,
    estado: s.estado ?? 'pendiente',
  }));
  const res = await rest('meal_plan_recipes', {
    method: 'POST',
    token: user.token,
    prefer: 'return=representation',
    body: rows,
  });
  if (res.status >= 300 || !Array.isArray(res.body)) {
    throw new Error(`[db-harness] seedSlots failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return (res.body as { id: string }[]).map(r => r.id);
}

/** Seeds a `shopping_lists` row for `planId` owned by `user`. */
export async function seedShoppingList(
  user: DbTestUser,
  planId: string,
  items: unknown[] = [{ nombre: 'Verduras', orden: 1, items: [{ nombre: 'Tomate', comprado: false }] }],
): Promise<string> {
  const res = await rest('shopping_lists', {
    method: 'POST',
    token: user.token,
    prefer: 'return=representation',
    body: { user_id: user.id, meal_plan_id: planId, items },
  });
  if (res.status >= 300 || !Array.isArray(res.body)) {
    throw new Error(`[db-harness] seedShoppingList failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return (res.body[0] as { id: string }).id;
}
