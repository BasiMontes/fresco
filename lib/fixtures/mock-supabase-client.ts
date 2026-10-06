import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { mockAuthGetUser } from '@/lib/fixtures/mock-supabase-auth';

/**
 * FRESCO-809 — single `createMockClient` for the unit tests of `lib/`.
 *
 * Replaces seven bespoke copies whose only real difference was the shape of
 * the query chain they hard-coded (`select().eq().maybeSingle()`, `insert()`,
 * `upsert()`, `.or().limit()`, `rpc()`...). Here every method on the query
 * builder is recorded and returns the same builder, and the builder is
 * thenable, so awaiting it at ANY point of the chain resolves to the one
 * configured result. Assert on what the code under test called through
 * `callsOf(method)` instead of re-deriving a chain per file.
 */
export interface MockClientOptions {
  /** Signed-in user id. Omit for an unauthenticated session. */
  userId?: string
  /** Row(s) the query resolves with. Ignored when `errorMessage` is set. */
  data?: unknown
  /** Exact count the query or RPC resolves with. Ignored when `errorMessage` is set. */
  count?: number | null
  /** When set, every query resolves with `{ error: { message } }` and no data. */
  errorMessage?: string
  /** Postgres/PostgREST error code attached to the error. */
  errorCode?: string
}

export function createMockClient(options: MockClientOptions = {}) {
  const calls: { method: string, args: unknown[] }[] = [];

  const resolveResult = () => options.errorMessage
    ? { data: null, count: null, error: { message: options.errorMessage, code: options.errorCode } }
    : { data: options.data ?? null, count: options.count ?? null, error: null };

  const record = (method: string, args: unknown[]) => {
    calls.push({ method, args });
  };

  const builder: object = new Proxy({}, {
    get(_target, property) {
      if (property === 'then') {
        return async (onFulfilled: (value: unknown) => unknown, onRejected: (reason: unknown) => unknown) =>
          Promise.resolve(resolveResult()).then(onFulfilled, onRejected);
      }
      if (typeof property === 'symbol') {
        return undefined;
      }
      return (...args: unknown[]) => {
        record(property, args);
        return builder;
      };
    },
  });

  const auth = mockAuthGetUser(options.userId);
  const mock = {
    auth: {
      getUser: async () => {
        record('auth.getUser', []);
        return auth.getUser();
      },
    },
    from: (table: string) => {
      record('from', [table]);
      return builder;
    },
    rpc: (...args: unknown[]) => {
      record('rpc', args);
      return builder;
    },
  };

  return {
    client: mock as unknown as SupabaseClient<Database>,
    calls,
    /** Argument lists of every call to `method`, in call order. */
    callsOf: (method: string) => calls.filter(call => call.method === method).map(call => call.args),
  };
}
