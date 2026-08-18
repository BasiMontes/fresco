import type { Recipe } from '@schemas';
import { UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { RecipeCard } from '@/components/recipe/recipe-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Centro de Avisos recipe-recommendations notice (FRESCO-226). `recipes` is
 * already the food-safety-filtered set from `getLatestAvailableRecipes()`
 * (FRESCO-59's `get_filtered_recipes()` RPC) capped to 3 by the caller — no
 * new backend, same guarantee as `LatestRecipesSection`. That RPC also
 * returns an empty set when the user has no `user_profiles` row yet (every
 * predicate compares against a null profile, so the WHERE clause excludes
 * every recipe) — the AC's "sin preferencias guardadas -> no notice" case
 * falls out of the existing filter for free, same "renders nothing when
 * there's nothing to show" pattern as `LatestRecipesSection`.
 */
export function RecommendedRecipesNotice({ recipes }: { recipes: Recipe[] }) {
  if (recipes.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6" data-testid="notifications_recommended_recipes_notice">
      <CardHeader>
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="size-5 text-primary" aria-hidden="true" />
          <CardTitle>Recetas que te pueden gustar</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {recipes.map(recipe => (
          <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
            <RecipeCard recipe={recipe} />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
