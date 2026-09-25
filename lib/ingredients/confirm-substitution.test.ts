import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { describe, expect, test } from 'bun:test';
import { confirmSubstitution } from './confirm-substitution';
import { IngredientSubstitutionError } from './get-safe-substitutes';

function createRpcMockClient(options: { errorMessage?: string } = {}) {
  const rpcCalls: { fn: string, args: unknown }[] = [];
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    rpcCalls.push({ fn, args });
    return { data: null, error: options.errorMessage ? { message: options.errorMessage } : null };
  };

  return { client: { rpc } as unknown as SupabaseClient<Database>, rpcCalls };
}

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

describe('confirmSubstitution', () => {
  test('calls the RPC with the slot and both ingredient names', async () => {
    const { client, rpcCalls } = createRpcMockClient();

    await confirmSubstitution(client, 'slot-1', 'leche', 'leche de avena');

    expect(rpcCalls).toEqual([{
      fn: 'confirm_ingredient_substitution',
      args: { p_slot_id: 'slot-1', p_ingrediente_original: 'leche', p_ingrediente_sustituto: 'leche de avena' },
    }]);
  });

  test('a rejection from the RPC (unsafe candidate, wrong slot, ineligible state) is surfaced, never swallowed', async () => {
    const { client } = createRpcMockClient({ errorMessage: 'candidate is not a currently safe substitute' });

    const error = await expectRejection(confirmSubstitution(client, 'slot-1', 'leche', 'leche de avena'));

    expect(error).toBeInstanceOf(IngredientSubstitutionError);
    expect((error as Error).message).toContain('candidate is not a currently safe substitute');
  });
});
