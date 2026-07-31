import { BookOpen } from 'lucide-react';
import { RecipeCard } from '@/components/recipe/recipe-card';
import { EmptyState } from '@/components/ui/empty-state';
import { getUserRecipes } from '@/lib/api/meal-plan';
import { createClient } from '@/lib/supabase/server';

/**
 * `/recipes` — nav item 3. Every distinct recipe Fresco has served this
 * household across their real, persisted meal plans (`getUserRecipes()`) —
 * not the global ~35-row catalog. Real data now, replacing the
 * `MOCK_RECIPES` placeholder the initial `/project-bootstrap` scaffold left
 * wired up.
 */
export default async function RecipesPage() {
  const supabase = await createClient();
  let recipes: Awaited<ReturnType<typeof getUserRecipes>>;
  try {
    recipes = await getUserRecipes(supabase);
  }
  catch (error) {
    // Same judgment call as `/menu`/`/calendar`: a real read failure falls
    // back to the empty state rather than crashing the page — logged so a
    // real outage stays visible in server logs instead of looking like a
    // household with no recipe history yet.
    console.error('[/recipes] getUserRecipes failed, falling back to empty state', error);
    recipes = [];
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-h2">Recetas</h1>
      <p className="mt-1 text-body-md text-tertiary">
        Las recetas que Fresco ha usado en tus menús.
      </p>

      {recipes.length === 0
        ? (
            <EmptyState
              data-testid="recipes_empty_state"
              className="mt-6"
              icon={<BookOpen className="size-8 text-tertiary" aria-hidden="true" />}
              title="Todavía no tienes recetas"
              description="En cuanto generes tu primer menú, las recetas que Fresco te sirva aparecerán aquí."
            />
          )
        : (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {recipes.map(recipe => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          )}
    </div>
  );
}
