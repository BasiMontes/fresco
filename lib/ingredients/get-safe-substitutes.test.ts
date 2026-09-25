import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
import { getSafeSubstitutes, IngredientSubstitutionError } from './get-safe-substitutes';

/** Minimal mock client exposing only `.rpc()` — all `getSafeSubstitutes()` calls. */
function createRpcMockClient(options: { data?: unknown, errorMessage?: string } = {}) {
  const rpcCalls: { fn: string, args: unknown }[] = [];
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    rpcCalls.push({ fn, args });
    return { data: options.errorMessage ? null : (options.data ?? []), error: options.errorMessage ? { message: options.errorMessage } : null };
  };

  return { client: { rpc } as unknown as SupabaseClient<Database>, rpcCalls };
}

/**
 * bun-types' `.rejects.toThrow()` is typed as returning `void`, so
 * `await expect(promise).rejects.toThrow(...)` trips this repo's
 * `ts/await-thenable` lint rule. Plain try/catch mirrors `shopping-list.test.ts`.
 */
async function expectRejection(promise: Promise<unknown>): Promise<unknown> {
  let thrownError: unknown;
  try {
    await promise;
  }
  catch (error) {
    thrownError = error;
  }
  expect(thrownError).toBeInstanceOf(Error);
  return thrownError;
}

describe('getSafeSubstitutes', () => {
  test('maps RPC rows to the camelCase shape and calls the RPC with only the ingredient', async () => {
    const { client, rpcCalls } = createRpcMockClient({
      data: [{ ingrediente_sustituto: 'leche de avena', alergenos: [] }],
    });

    const result = await getSafeSubstitutes(client, 'leche');

    expect(result).toEqual([{ ingredienteSustituto: 'leche de avena', alergenos: [] }]);
    expect(rpcCalls).toEqual([{ fn: 'get_safe_ingredient_substitutes', args: { p_ingrediente: 'leche' } }]);
  });

  test('no safe substitute returns an explicit empty array, never throws', async () => {
    const { client } = createRpcMockClient({ data: [] });

    const result = await getSafeSubstitutes(client, 'ingrediente-sin-catalogo');

    expect(result).toEqual([]);
  });

  test('a DB error is surfaced as IngredientSubstitutionError, never swallowed', async () => {
    const { client } = createRpcMockClient({ errorMessage: 'connection reset' });

    const error = await expectRejection(getSafeSubstitutes(client, 'leche'));

    expect(error).toBeInstanceOf(IngredientSubstitutionError);
    expect((error as Error).message).toContain('connection reset');
  });
});
