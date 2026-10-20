import type { UserDataExport } from '@/lib/api/profile-export';
import { NextResponse } from 'next/server';
import { readUserDataForExport } from '@/lib/api/profile-export';
import { rowsToCsv } from '@/lib/csv/export-csv';
import { createClient } from '@/lib/supabase/server';

const RATE_LIMIT_ENDPOINT = 'profile-export';
const RATE_LIMIT_PER_HOUR = 10;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

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

  // FRESCO-1017 (A7-ABUSE-04): the export reads every table the user owns, so it is the costly
  // read of the app. ADR-0010: atomic check-and-increment, fail closed (only an explicit `true`
  // passes), before the reads. Registered in rate_limit_endpoints at the same ceiling.
  const { data: allowed, error: rateLimitError } = await supabase.rpc('check_and_increment_rate_limit', {
    p_user_id: user.id,
    p_endpoint: RATE_LIMIT_ENDPOINT,
    p_limit: RATE_LIMIT_PER_HOUR,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (rateLimitError) {
    console.error('[/api/profile/export] rate-limit check failed', rateLimitError);
    return NextResponse.json({ error: 'No se pudieron leer tus datos.' }, { status: 500 });
  }
  if (allowed !== true) {
    return NextResponse.json({ error: 'Has descargado tus datos varias veces seguidas, inténtalo de nuevo en un rato.' }, { status: 429 });
  }

  let exported: UserDataExport;
  try {
    exported = await readUserDataForExport(supabase, user.id);
  }
  catch (readError) {
    console.error('[/api/profile/export] read failed', readError);
    return NextResponse.json({ error: 'No se pudieron leer tus datos.' }, { status: 500 });
  }

  const mealPlans = exported.mealPlans as MealPlanRow[];
  const mealPlanRecipes = mealPlans.flatMap(({ id, meal_plan_recipes: recipes }) =>
    (recipes ?? []).map(recipe => ({ meal_plan_id: id, ...recipe })));
  const mealPlansWithoutNesting = mealPlans.map(({ meal_plan_recipes: _recipes, ...rest }) => rest);

  const sections: { name: string, rows: Record<string, unknown>[] }[] = [
    // FRESCO-910: the address is on `auth.users`, not in any table the export reads.
    { name: 'account', rows: user.email ? [{ email: user.email }] : [] },
    { name: 'user_profile', rows: exported.profile ? [exported.profile] : [] },
    { name: 'meal_plans', rows: mealPlansWithoutNesting },
    { name: 'meal_plan_recipes', rows: mealPlanRecipes },
    { name: 'shopping_lists', rows: exported.shoppingLists },
    { name: 'recetas_propias', rows: exported.recetasPropias },
    { name: 'favorites', rows: exported.favorites },
    { name: 'user_consents', rows: exported.consents },
    { name: 'push_subscriptions', rows: exported.pushSubscriptions },
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
      // FRESCO-1036: personal data of one account. Without this the platform default is
      // `public, max-age=0, must-revalidate`, which lets a shared cache hold the file.
      'Cache-Control': 'private, no-store',
    },
  });
}
