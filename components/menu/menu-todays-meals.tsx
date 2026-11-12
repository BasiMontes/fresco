import type { Recipe } from '@schemas';
import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';
import type { OnboardingProfilePayload } from '@/lib/api/user-profile';
import Link from 'next/link';
import { FavoriteRecipeCard } from '@/components/recipe/favorite-recipe-card';
import { Card, CardContent } from '@/components/ui/card';
import { sumarDias } from '@/lib/date/madrid-date';
import { fromPlanningSelection } from '@/lib/planning-selection';

type Slot = 'desayuno' | 'comida' | 'cena';
type Dia = keyof MenuSemanalPersistido['menu'];

const DIAS: readonly Dia[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIA_LABELS: Record<Dia, string> = {
  lunes: 'lunes',
  martes: 'martes',
  miercoles: 'miércoles',
  jueves: 'jueves',
  viernes: 'viernes',
  sabado: 'sábado',
  domingo: 'domingo',
};
const SLOTS: readonly Slot[] = ['desayuno', 'comida', 'cena'];

interface MenuTodaysMealsProps {
  plan: MenuSemanalPersistido
  dietaryPreferences: OnboardingProfilePayload | null
  favoriteIds: Set<string>
  /** Monday of the displayed week, `YYYY-MM-DD`. */
  mondayIso: string
  /** Today in Madrid, `YYYY-MM-DD` (same criterion as the calendar). */
  hoyIso: string
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

const tieneReceta = (plan: MenuSemanalPersistido, dia: Dia) => SLOTS.some(slot => plan.menu[dia][slot]);

// FRESCO-1171: today is the weekday of `hoyIso` within the plan's week. When
// today has no recipe at all (days already gone when the week was generated
// are excluded), show the next day that does, and name it.
function pickDia(plan: MenuSemanalPersistido, { mondayIso, hoyIso }: { mondayIso: string, hoyIso: string }): { dia: Dia, esHoy: boolean } {
  const hoyIndex = DIAS.findIndex((_, index) => sumarDias(mondayIso, index) === hoyIso);
  if (hoyIndex >= 0 && tieneReceta(plan, DIAS[hoyIndex])) {
    return { dia: DIAS[hoyIndex], esHoy: true };
  }
  const siguiente = DIAS.slice(Math.max(hoyIndex, 0)).find(dia => tieneReceta(plan, dia));
  if (siguiente) {
    return { dia: siguiente, esHoy: false };
  }
  return { dia: DIAS[Math.max(hoyIndex, 0)], esHoy: true };
}

export function MenuTodaysMeals({ plan, dietaryPreferences, favoriteIds, mondayIso, hoyIso }: MenuTodaysMealsProps) {
  const { dia, esHoy } = pickDia(plan, { mondayIso, hoyIso });
  const hoy = plan.menu[dia];

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
      {!esHoy && (
        <p data-testid="menu_todays_meals_next_day" className="mb-2 text-body-sm text-tertiary">
          Hoy no hay platos en tu menú. Próximo menú:
          {' '}
          {DIA_LABELS[dia]}
        </p>
      )}
      <div data-tour="menu-today" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {slots.map(slot => (
          <div key={slot} className="flex flex-col">
            <p className="mb-2 text-h6 uppercase text-tertiary">{slot}</p>
            <TodaySlot
              slot={slot}
              recipe={hoy[slot]}
              excluida={plan.estados[dia][slot] === 'excluida'}
              isFavorite={hoy[slot] ? favoriteIds.has(hoy[slot].id) : false}
            />
          </div>
        ))}
      </div>
    </>
  );
}
