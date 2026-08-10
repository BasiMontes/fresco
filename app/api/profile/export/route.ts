import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Escapes one CSV field per RFC 4180: wrap in double quotes and double up
 * any embedded quote whenever the value contains a comma, quote, or
 * newline. `null`/`undefined` become an empty field rather than the
 * literal string "null". Nested objects/arrays (this app's several jsonb
 * columns — `alergenos`, `ingredientes_odiados`, `cocinas_favoritas`, etc.)
 * are JSON-stringified so they still fit in one cell instead of breaking
 * the row shape.
 */
function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) { return ''; }
  const raw = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

/**
 * One table's rows -> a CSV block (header line + one line per row). Columns
 * are derived from the union of every row's own keys rather than a
 * hardcoded list, so this never drifts out of sync with the real Supabase
 * schema. Returns `null` for an empty table — the caller skips the section
 * entirely instead of emitting a header with zero data rows.
 */
function rowsToCsv(rows: Record<string, unknown>[]): string | null {
  if (rows.length === 0) { return null; }

  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const lines = [
    columns.map(toCsvValue).join(','),
    ...rows.map(row => columns.map(column => toCsvValue(row[column])).join(',')),
  ];
  return lines.join('\n');
}

interface MealPlanRow extends Record<string, unknown> {
  id: string
  meal_plan_recipes?: Record<string, unknown>[]
}

/**
 * GET /api/profile/export — `/profile` danger zone "Backup CSV" (FRESCO-70,
 * format changed to CSV per FRESCO-163 — a spreadsheet a user can actually
 * open beats a JSON blob). Server-side Supabase client only (no service
 * role): every query below is subject to the caller's own RLS policies, so
 * it can only ever read her own rows — same posture as every other
 * server-side read in this app (`lib/api/*`).
 *
 * One `.csv` file, not a ZIP of several — avoids pulling in a zip
 * dependency for what's still a small, single-user export. Multiple
 * heterogeneous tables (`user_profile` is one object; `meal_plans` nests
 * `meal_plan_recipes`; `shopping_lists`/`recetas_propias` are flat arrays)
 * don't fit one truly flat CSV, so this emits one `# table_name` section per
 * table, blank-line-separated, each with its own header row — the same
 * "multi-table CSV dump" shape `pg_dump --csv` produces per table. Opens
 * fine in a text editor; a spreadsheet app will still read every row, just
 * with each section's own header repeating down the sheet.
 *
 * `meal_plan_recipes` is flattened out of `meal_plans` into its own
 * top-level section (with `meal_plan_id` as a join column) rather than
 * staying nested — nesting doesn't survive a flat CSV row.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No hay una sesión autenticada.' }, { status: 401 });
  }

  const [profileResult, mealPlansResult, shoppingListsResult, recetasResult] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('meal_plans').select('*, meal_plan_recipes(*)').eq('user_id', user.id),
    supabase.from('shopping_lists').select('*').eq('user_id', user.id),
    supabase.from('recetas_propias').select('*').eq('user_id', user.id),
  ]);

  const firstError = profileResult.error ?? mealPlansResult.error ?? shoppingListsResult.error ?? recetasResult.error;
  if (firstError) {
    console.error('[/api/profile/export] read failed', firstError);
    return NextResponse.json({ error: 'No se pudieron leer tus datos.' }, { status: 500 });
  }

  const mealPlans = (mealPlansResult.data ?? []) as MealPlanRow[];
  const mealPlanRecipes = mealPlans.flatMap(({ id, meal_plan_recipes: recipes }) =>
    (recipes ?? []).map(recipe => ({ meal_plan_id: id, ...recipe })));
  const mealPlansWithoutNesting = mealPlans.map(({ meal_plan_recipes: _recipes, ...rest }) => rest);

  const sections: { name: string, rows: Record<string, unknown>[] }[] = [
    { name: 'user_profile', rows: profileResult.data ? [profileResult.data] : [] },
    { name: 'meal_plans', rows: mealPlansWithoutNesting },
    { name: 'meal_plan_recipes', rows: mealPlanRecipes },
    { name: 'shopping_lists', rows: shoppingListsResult.data ?? [] },
    { name: 'recetas_propias', rows: recetasResult.data ?? [] },
  ];

  const csvBlocks = sections
    .map(({ name, rows }) => {
      const csv = rowsToCsv(rows);
      return csv ? `# ${name}\n${csv}` : null;
    })
    .filter((block): block is string => block !== null);

  const csv = [`# exported_at: ${new Date().toISOString()}`, ...csvBlocks].join('\n\n');
  const filename = `fresco-datos-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
