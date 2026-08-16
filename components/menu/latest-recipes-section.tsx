import type { Recipe } from '@schemas';
import Link from 'next/link';
import { HorizontalScrollRow } from '@/components/menu/horizontal-scroll-row';
import { FavoriteRecipeCard } from '@/components/recipe/favorite-recipe-card';
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
 *
 * FRESCO-78/79 — section heading is `text-h3`, one step above `RecipeCard`'s
 * own title (`text-h4` as of FRESCO-78). Keep it a step above whatever
 * `RecipeCard` uses — FRESCO-79 originally bumped this heading to `h4`
 * specifically to out-rank the card titles at `h5`; when FRESCO-78 later
 * bumped card titles to `h4` too, this had to move again or the two would
 * tie again.
 *
 * FRESCO-78 — grid dropped from `lg:grid-cols-6`, then dropped entirely
 * in favor of a horizontal-scroll strip: cards are a fixed width (`w-60`)
 * matching the "hoy" grid's own card width at this page's `max-w-3xl`
 * container (same visual size, confirmed with the user), `flex` +
 * `overflow-x-auto` instead of wrapping to a second row. At 6 narrow grid
 * columns, 4-5-word recipe titles wrapped to one word per line and looked
 * cramped next to the wider "hoy" cards right above this section — the
 * user's real complaint wasn't row-height equality (already fixed), it
 * was these cards looking nothing like those. Scoped to this section only
 * — `/recipes` and `/favorites` keep their own denser grid, confirmed with
 * the user as intentional (they're browse/search surfaces, not a preview
 * strip).
 *
 * FRESCO-78 — `HorizontalScrollRow` adds click-to-scroll arrows that hide
 * themselves at each end, so a scrollable-but-visually-flat row doesn't
 * silently hide the fact that there's more to see.
 */
export function LatestRecipesSection({ recipes, favoriteRecipeIds }: { recipes: Recipe[], favoriteRecipeIds: Set<string> }) {
  if (recipes.length === 0) {
    return null;
  }

  return (
    <div className="mt-6" data-testid="latest_recipes_section">
      <div className="flex items-center justify-between">
        <h2 className="text-h3">Últimas recetas añadidas</h2>
        <Link href="/recipes" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          Ver todas
        </Link>
      </div>
      <HorizontalScrollRow className="mt-2">
        {recipes.map(recipe => (
          <Link key={recipe.id} href={`/recipes/${recipe.id}?from=menu`} className="flex w-60 shrink-0">
            <FavoriteRecipeCard
              recipe={recipe}
              initialIsFavorite={favoriteRecipeIds.has(recipe.id)}
            />
          </Link>
        ))}
      </HorizontalScrollRow>
    </div>
  );
}
