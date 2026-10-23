/**
 * FRESCO-410 — a minimal chainable stand-in for a Supabase client, for
 * route-handler unit tests. Records every `.update(...)` payload and the
 * `.eq('id'|'...', value)` it was filtered by, and lets each test pin what
 * a read resolves to per table.
 *
 * Only the call shapes the `app/api/**` route handlers actually use are
 * modelled: `.from(t).select(cols).eq(c,v).maybeSingle()`,
 * `.from(t).select(cols).eq(c,v)`, `.from(t).select(cols).not(c,op,v)`,
 * `.from(t).update(payload).eq(c,v)`, and chained `.eq(...).eq(...)`.
 * Anything else throws so a drift in the route surfaces loudly.
 */

export interface RecordedUpdate {
  table: string
  payload: Record<string, unknown>
  filters: Array<{ column: string, value: unknown }>
}

export interface TableFixture {
  /** Result rows (or single row) a `select` on this table resolves to. */
  rows?: unknown
  /** Error a `select` on this table resolves with. */
  selectError?: unknown
  /** Error the terminal `.eq()` of an `update` on this table resolves with. */
  updateError?: unknown
  /** Error an `upsert` on this table resolves with. */
  upsertError?: unknown
}

export type FakeRpc = (name: string, args: unknown) => Promise<{ data: unknown, error: unknown }>;

export interface RecordedUpsert {
  table: string
  payload: Record<string, unknown>
  options: Record<string, unknown> | undefined
}

export interface FakeSupabase {
  client: {
    from: (table: string) => unknown
    rpc: FakeRpc
    auth?: unknown
  }
  updates: RecordedUpdate[]
  /** Every `.upsert(payload, options)` that ran. */
  upserts: RecordedUpsert[]
  /** `[name, args]` for every `.rpc(name, args)` that ran. */
  rpcCalls: Array<[string, unknown]>
  /** Every `.gte(column, value)` a select applied (FRESCO-1021: the waiver recency filter). */
  gteFilters: Array<{ table: string, column: string, value: unknown }>
}

/** Default `rpc`: every call resolves `{ data: true }` (e.g. a rate-limit check that allows). */
const ALLOW_ALL_RPC: FakeRpc = async () => ({ data: true, error: null });

export function fakeSupabase(tables: Record<string, TableFixture> = {}, auth?: unknown, rpc: FakeRpc = ALLOW_ALL_RPC): FakeSupabase {
  const updates: RecordedUpdate[] = [];
  const upserts: RecordedUpsert[] = [];
  const rpcCalls: Array<[string, unknown]> = [];
  const gteFilters: Array<{ table: string, column: string, value: unknown }> = [];

  function selectResult(table: string) {
    const fx = tables[table] ?? {};
    return { data: fx.rows ?? null, error: fx.selectError ?? null };
  }

  function selectChain(table: string) {
    const resolve = async () => selectResult(table);
    const chain: Record<string, unknown> = {
      eq: () => chain,
      gte: (column: string, value: unknown) => {
        gteFilters.push({ table, column, value });
        return chain;
      },
      not: () => chain,
      in: () => chain,
      is: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: resolve,
      single: resolve,
      then: async (onFulfilled: (v: unknown) => unknown) => resolve().then(onFulfilled),
    };
    return chain;
  }

  function updateChain(table: string, payload: Record<string, unknown>) {
    const filters: Array<{ column: string, value: unknown }> = [];
    const terminate = async () => {
      updates.push({ table, payload, filters: [...filters] });
      return { error: tables[table]?.updateError ?? null };
    };
    const chain: Record<string, unknown> = {
      eq: (column: string, value: unknown) => {
        filters.push({ column, value });
        return chain;
      },
      then: async (onFulfilled: (v: unknown) => unknown) => terminate().then(onFulfilled),
    };
    return chain;
  }

  const client = {
    from(table: string) {
      return {
        select: () => selectChain(table),
        update: (payload: Record<string, unknown>) => updateChain(table, payload),
        upsert: async (payload: Record<string, unknown>, options?: Record<string, unknown>) => {
          upserts.push({ table, payload, options });
          return { error: tables[table]?.upsertError ?? null };
        },
      };
    },
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push([name, args]);
      return rpc(name, args);
    },
    ...(auth ? { auth } : {}),
  };

  return { client, updates, upserts, rpcCalls, gteFilters };
}
