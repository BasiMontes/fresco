import type { Recipe } from '@schemas';
import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';
import type { OnboardingProfilePayload } from '@/lib/api/user-profile';
import Link from 'next/link';
import { FavoriteRecipeCard } from '@/components/recipe/favorite-recipe-card';
import { Card, CardContent } from '@/components/ui/card';
import { fromPlanningSelection } from '@/lib/planning-selection';

type Slot = 'desayuno' | 'comida' | 'cena';

interface MenuTodaysMealsProps {
  plan: MenuSemanalPersistido
  dietaryPreferences: OnboardingProfilePayload | null
  favoriteIds: Set<string>
}

interface TodaySlotProps {
  slot: Slot
  recipe: Recipe | null | undefined
  excluida: boolean
  isFavorite: boolean
}

function TodaySlot({ slot, recipe, excluida, isFavorite }: TodaySlotProps) {
  if (recipe) {
    return (
      <Link href={`/recipes/${recipe.id}?from=menu`} className="flex flex-1">
        <FavoriteRecipeCard recipe={recipe} initialIsFavorite={isFavorite} className="flex-1" />
      </Link>
    );
  }
  if (excluida) {
    return (
      <Card data-testid={`menu_slot_${slot}_excluida`} className="flex-1">
        <CardContent className="text-body-sm italic text-tertiary">
          Excluida por ti
        </CardContent>
      </Card>
    );
  }
  // FR-8.2 / AC Scenario 4 (FRESCO-23): this slot could not be filled — the
  // `AlertBanner` above says whether it was a food-safety dead end or a
  // variety one (A4-M3), so the label itself stays neutral.
  return (
    <Card data-testid={`menu_slot_${slot}_sin_receta`} className="flex-1">
      <CardContent className="text-body-sm italic text-tertiary">
        Sin receta
      </CardContent>
    </Card>
  );
}

export function MenuTodaysMeals({ plan, dietaryPreferences, favoriteIds }: MenuTodaysMealsProps) {
  const hoy = plan.menu.lunes;

  // FRESCO-199: `planning_selection` is per-day now — this row still
  // shows "today's meals" as a whole-week toggle (the union across
  // every included day) until a real per-day-aware /menu view ships;
  // the boundary-conversion phase kept the visible behavior the same
  // for the common case (a uniform selection across all days).
  const slots: readonly Slot[] = dietaryPreferences?.planning_selection
    ? fromPlanningSelection(dietaryPreferences.planning_selection).meals
    : ['desayuno', 'comida', 'cena'];

  return (
    <>
      <h2 className="sr-only">Menú de hoy por comida</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {slots.map(slot => (
          <div key={slot} className="flex flex-col">
            <p className="mb-2 text-h6 uppercase text-tertiary">{slot}</p>
            <TodaySlot
              slot={slot}
              recipe={hoy[slot]}
              excluida={plan.estados.lunes[slot] === 'excluida'}
              isFavorite={hoy[slot] ? favoriteIds.has(hoy[slot].id) : false}
            />
          </div>
        ))}
      </div>
    </>
  );
}
