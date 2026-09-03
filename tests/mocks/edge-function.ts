/**
 * FRESCO-411 — harness for unit-testing a Supabase Edge Function's
 * `index.ts` orchestration under `bun test`.
 *
 * Each `index.ts` runs `Deno.serve(handler)` at module top level and never
 * exports the handler. `captureDenoServe()` installs a minimal `Deno`
 * global (only what the `_shared` modules touch: `env.get`, `serve`) whose
 * `serve` stashes the handler; import the `index.ts` after calling it, then
 * read the handler with `getEdgeHandler()`.
 *
 * Deno-only globals the functions rely on — `crypto.randomUUID`, `atob`,
 * `fetch`, `Request`/`Response` — already exist under bun.
 */

interface DenoShim {
  env: { get: (key: string) => string | undefined }
  serve: (handler: EdgeHandler) => { finished: Promise<void> }
}

export type EdgeHandler = (req: Request) => Promise<Response> | Response;

let captured: EdgeHandler | null = null;

function installDeno(): void {
  const g = globalThis as unknown as { Deno?: DenoShim };
  g.Deno ??= {
    env: { get: (key: string) => process.env[key] },
    serve: () => ({ finished: Promise.resolve() }),
  };
}

/** Call BEFORE `await import('<fn>/index.ts')`. */
export function captureDenoServe(): void {
  installDeno();
  captured = null;
  (globalThis as unknown as { Deno: DenoShim }).Deno.serve = (handler: EdgeHandler) => {
    captured = handler;
    return { finished: Promise.resolve() };
  };
}

export function getEdgeHandler(): EdgeHandler {
  if (!captured) {
    throw new Error('Deno.serve was not called — did the index.ts import run after captureDenoServe()?');
  }
  return captured;
}

export interface EdgeUser {
  id: string
  is_anonymous?: boolean
}

export interface FakeEdgeClientConfig {
  /** `auth.getUser()` result. */
  user?: EdgeUser | null
  authError?: unknown
  /** Keyed by RPC name → `{ data, error }`. Unlisted RPCs resolve `{ data: null, error: null }`. */
  rpc?: Record<string, { data?: unknown, error?: unknown }>
  /** Keyed by table → the row(s) a `select` chain resolves to. */
  rows?: Record<string, unknown>
  /** Keyed by table → a `select` error. */
  selectError?: Record<string, unknown>
  /** Keyed by table → the error the terminal `.eq()` of an `update` resolves with. */
  updateError?: Record<string, unknown>
  /** `auth.admin.deleteUser()` result. */
  adminDeleteError?: unknown
}

export interface FakeEdgeClient {
  client: unknown
  /** `[table, payload]` for every `.from(t).update(p)...` that ran. */
  updates: Array<[string, Record<string, unknown>]>
  /** `[name, args]` for every `.rpc(name, args)` that ran. */
  rpcCalls: Array<[string, unknown]>
  deletedUserIds: string[]
}

/**
 * A configurable stand-in for the Deno-side Supabase client an Edge Function
 * gets from `createRequestClient` / `createServiceRoleClient`. Models only
 * the call shapes the `index.ts` handlers use.
 */
export function fakeEdgeClient(config: FakeEdgeClientConfig = {}): FakeEdgeClient {
  const updates: FakeEdgeClient['updates'] = [];
  const rpcCalls: FakeEdgeClient['rpcCalls'] = [];
  const deletedUserIds: string[] = [];

  function selectChain(table: string): Record<string, unknown> {
    const resolve = async () => ({
      data: config.rows?.[table] ?? null,
      error: config.selectError?.[table] ?? null,
    });
    const chain: Record<string, unknown> = {
      eq: () => chain,
      neq: () => chain,
      limit: () => chain,
      single: resolve,
      maybeSingle: resolve,
      then: async (f: (v: unknown) => unknown) => resolve().then(f),
    };
    return chain;
  }

  function updateChain(table: string, payload: Record<string, unknown>): Record<string, unknown> {
    const terminate = async () => {
      updates.push([table, payload]);
      return { error: config.updateError?.[table] ?? null };
    };
    const chain: Record<string, unknown> = {
      eq: () => chain,
      then: async (f: (v: unknown) => unknown) => terminate().then(f),
    };
    return chain;
  }

  const client = {
    auth: {
      getUser: async () => ({ data: { user: config.user ?? null }, error: config.authError ?? null }),
      admin: {
        deleteUser: async (id: string) => {
          deletedUserIds.push(id);
          return { error: config.adminDeleteError ?? null };
        },
      },
    },
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push([name, args]);
      return { data: config.rpc?.[name]?.data ?? null, error: config.rpc?.[name]?.error ?? null };
    },
    from: (table: string) => ({
      select: () => selectChain(table),
      update: (payload: Record<string, unknown>) => updateChain(table, payload),
    }),
  };

  return { client, updates, rpcCalls, deletedUserIds };
}

/** A `Request` shaped like what the Supabase Edge Runtime hands the handler. */
export function edgeRequest(body: unknown, init: RequestInit & { auth?: string | null } = {}): Request {
  const { auth = 'Bearer test.jwt.token', headers, ...rest } = init;
  const h = new Headers(headers);
  if (auth !== null && !h.has('Authorization')) {
    h.set('Authorization', auth);
  }
  return new Request('https://fn.test.supabase.co/', {
    method: 'POST',
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
    ...rest,
  });
}
