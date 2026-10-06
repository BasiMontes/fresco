import type { Recipe } from '@schemas';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';
import type { Database } from '@/lib/supabase/types';
import { getFavoriteRecipeIds } from '@/lib/api/favorites';
import { getMealPlanForWeek } from '@/lib/api/meal-plan';
import { getAvailableRecipesCount, getLatestAvailableRecipes } from '@/lib/api/recipes';
import { getHasUnseenNotifications, getUserDietaryPreferences, getUserNombre } from '@/lib/api/user-profile';
import { getSpendTrend } from '@/lib/menu/get-spend-trend';

interface LoadMenuPageDataArgs {
  userId: string | undefined
  semanaIso: string
}

/**
 * Every server-side read `/menu` needs. They are mutually independent once
 * `userId` is resolved — run them concurrently rather than paying for
 * sequential round trips. Each keeps its own fallback via `.catch()` (same
 * conservative-default judgment call as before) so one call's rejection
 * can't take the others down with it.
 */
export async function loadMenuPageData(supabase: SupabaseClient<Database>, { userId, semanaIso }: LoadMenuPageDataArgs) {
  const [nombre, recetasDisponibles, ultimasRecetas, plan, favoriteIds, dietaryPreferences, hasUnseenNotifications, spendTrend] = await Promise.all([
    getUserNombre(supabase, userId).catch((error) => {
      // Same conservative fallback as every other server-side profile read on
      // this page: a real read failure falls back to `null` (generic
      // "¡Hola!" greeting) rather than crashing the page.
      console.error('[/menu] getUserNombre failed, defaulting to null', error);
      return null;
    }),
    getAvailableRecipesCount(supabase, userId).catch((error) => {
      // Same conservative fallback as every other server-side read on this
      // page: a real read failure hides the card rather than crashing the
      // page or showing a misleading "0" (which would read as an empty
      // catalog, not a transient error).
      console.error('[/menu] getAvailableRecipesCount failed, hiding the card', error);
      return null;
    }),
    getLatestAvailableRecipes(supabase, { userId }).catch((error) => {
      // Same fail-soft pattern as the other value-indicator reads on this
      // page: hides the section instead of crashing the page.
      console.error('[/menu] getLatestAvailableRecipes failed, hiding the section', error);
      return [] as Recipe[];
    }),
    getMealPlanForWeek(supabase, { userId }).catch((error) => {
      // `getMealPlanForWeek` fails fast (throws) on a real read error,
      // including "no authenticated session" — a real gap remains only for a
      // visit with literally zero session at all (no page currently forces one
      // outside `/onboarding`'s mount effect), not for guest vs. registered
      // (ADR-0003, FRESCO-17 resolved that). A dedicated read-error UI
      // (network/auth, distinct from "no plan yet") is real UI/UX-design scope
      // this story named but no AC scenario requires yet — tracked as a gap,
      // not silently dropped: for now this falls back to the same empty state
      // rather than crashing the page. Logged so a real DB/network outage is
      // still visible in server logs instead of looking identical to a benign
      // "haven't generated a menu yet" state.
      console.error('[/menu] getMealPlanForWeek failed, falling back to empty state', error);
      return null as MenuSemanalPersistido | null;
    }),
    getFavoriteRecipeIds(supabase, userId).catch((error) => {
      // Same fail-soft pattern as the other reads on this page: a favorites
      // read failure just shows every heart as unfavorited rather than
      // crashing the page.
      console.error('[/menu] getFavoriteRecipeIds failed, defaulting to none favorited', error);
      return new Set<string>();
    }),
    // FRESCO-153: gates which of today's 3 meal slots render below — a
    // read failure just falls back to showing all 3, same conservative
    // default `CalendarGrid` uses for the equivalent read on `/calendar`.
    getUserDietaryPreferences(supabase, userId).catch((error) => {
      console.error('[/menu] getUserDietaryPreferences failed, showing all meal slots', error);
      return null;
    }),
    // FRESCO-234: gates the bell-icon badge dot below — a read failure just
    // hides the badge (no false-positive "you have something new") rather
    // than crashing the page.
    getHasUnseenNotifications(supabase, userId).catch((error) => {
      console.error('[/menu] getHasUnseenNotifications failed, hiding the badge', error);
      return false;
    }),
    // FRESCO-535: same fail-soft pattern as the other reads on this page — a
    // read failure just hides the trend chart rather than crashing the page.
    getSpendTrend(supabase, { semanaIso, userId }).catch((error) => {
      console.error('[/menu] getSpendTrend failed, hiding the spend comparison', error);
      return [];
    }),
  ]);

  return { nombre, recetasDisponibles, ultimasRecetas, plan, favoriteIds, dietaryPreferences, hasUnseenNotifications, spendTrend };
}
