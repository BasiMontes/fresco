import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { fakeSupabase } from '@/tests/mocks/supabase-query-builder';

/**
 * FRESCO-410 — `GET /api/profile/export` builds the `/profile` "Backup CSV"
 * from the caller's own (RLS-scoped) rows. `rowsToCsv` (`lib/csv/export-csv`)
 * keeps its own tests; this pins the handler: the auth gate, the read-error
 * path, and the multi-section CSV shape + download headers.
 */

let supa = fakeSupabase({}, { getUser: async () => ({ data: { user: { id: 'user_1' } } }) });
void mock.module('@/lib/supabase/server', () => ({ createClient: async () => supa.client }));

const { GET } = await import('./route');

function withUser(user: { id: string } | null, tables = {}) {
  return fakeSupabase(tables, { getUser: async () => ({ data: { user } }) });
}

beforeEach(() => {
  supa = withUser({ id: 'user_1' });
});

describe('GET /api/profile/export', () => {
  test('401 when there is no authenticated session', async () => {
    supa = withUser(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  test('500 when a read fails', async () => {
    supa = withUser({ id: 'user_1' }, { user_profiles: { selectError: new Error('rls denied') } });
    const res = await GET();
    expect(res.status).toBe(500);
  });

  test('returns a CSV attachment with one section per non-empty table', async () => {
    supa = withUser({ id: 'user_1' }, {
      user_profiles: { rows: { id: 'user_1', plan: 'pro' } },
      meal_plans: { rows: [{ id: 'mp_1', semana_iso: '2026-W01', meal_plan_recipes: [{ id: 'r_1', receta: 'x' }] }] },
      shopping_lists: { rows: [] },
      recetas_propias: { rows: [] },
    });

    const res = await GET();
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="fresco-datos-\d{4}-\d{2}-\d{2}\.csv"/);
    expect(body).toContain('# exported_at:');
    expect(body).toContain('# user_profile\n');
    expect(body).toContain('# meal_plans\n');
    // meal_plan_recipes is flattened out of the nested meal_plans rows
    expect(body).toContain('# meal_plan_recipes\n');
    expect(body).toContain('meal_plan_id');
    // empty tables produce no section
    expect(body).not.toContain('# shopping_lists');
  });
});
