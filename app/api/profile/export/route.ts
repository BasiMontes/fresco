import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/profile/export — `/profile` danger zone "Backup JSON" (FRESCO-70).
 * Server-side Supabase client only (no service role): every query below is
 * subject to the caller's own RLS policies, so it can only ever read her own
 * rows — the same posture as every other server-side read in this app
 * (`lib/api/*`). Bundles `user_profiles`, `meal_plans` (nested
 * `meal_plan_recipes`), `shopping_lists`, and `recetas_propias` into one
 * downloadable JSON file.
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

  const exportPayload = {
    exported_at: new Date().toISOString(),
    user_profile: profileResult.data,
    meal_plans: mealPlansResult.data ?? [],
    shopping_lists: shoppingListsResult.data ?? [],
    recetas_propias: recetasResult.data ?? [],
  };

  const filename = `fresco-datos-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
