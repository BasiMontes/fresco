import type { Recipe } from '@schemas';
import Link from 'next/link';
import { RecipeCard } from '@/components/recipe/recipe-card';
import { buttonVariants } from '@/components/ui/button';

/**
 * FRESCO-59 — the `recipes` prop is already the food-safety-filtered,
 * most-recent-first set from `getLatestAvailableRecipes()`; this component
 * only renders it, per the epic's own noted assumption (confirmed in the
 * story's AC: "dentro de las que puede comer según su perfil"). Renders
 * nothing when there's nothing to show, rather than an empty section
 * header — a household new enough to have zero eligible recipes yet
 * shouldn't see a dead-looking "Últimas recetas" heading with no cards
 * under it.
 */
export function LatestRecipesSection({ recipes }: { recipes: Recipe[] }) {
  if (recipes.length === 0) {
    return null;
  }

  return (
    <div className="mt-6" data-testid="latest_recipes_section">
      <div className="flex items-center justify-between">
        <h2 className="text-h4">Últimas recetas añadidas</h2>
        <Link href="/recipes" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          Ver todas
        </Link>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {recipes.map(recipe => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>
    </div>
  );
}
