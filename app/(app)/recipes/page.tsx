import { RecipeCard } from '@/components/recipe/recipe-card';
import { MOCK_RECIPES } from '@/lib/mock/recipes';

/** `/recipes` — nav item 3. Grid of recipes, per DESIGN.md's `recipe-card` component. */
export default function RecipesPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-h2">Recetas</h1>
      <p className="mt-1 text-body-md text-tertiary">
        Las recetas que Fresco ha usado en tus menús.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {MOCK_RECIPES.map(recipe => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>
    </div>
  );
}
