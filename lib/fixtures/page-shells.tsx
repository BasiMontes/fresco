import { Bell, BookOpen, Heart, Plus, Search, Zap } from 'lucide-react';
import Link from 'next/link';
import { CalendarGrid } from '@/components/calendar/calendar-grid';
import { DeleteWeekButton } from '@/components/calendar/delete-week-button';
import { WeekNavigation } from '@/components/calendar/week-navigation';
import { AvailableRecipesCard } from '@/components/menu/available-recipes-card';
import { CalendarSuggestionBanner } from '@/components/menu/calendar-suggestion-banner';
import { LatestRecipesSection } from '@/components/menu/latest-recipes-section';
import { SavingsEstimateCards } from '@/components/menu/savings-estimate-cards';
import { FavoriteRecipeCard } from '@/components/recipe/favorite-recipe-card';
import { ShoppingListView } from '@/components/shopping-list/shopping-list-view';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { makeFixtureRecipe, makeFixtureRecipes, makeFixtureShoppingList, makeFixtureWeekGrid } from '@/lib/fixtures/recipe';

const MEAL_TABS: { value: string, label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'comida', label: 'Comida' },
  { value: 'cena', label: 'Cena' },
];

const FIXTURE_SEMANA_ISO = '2026-W01';
const FIXTURE_MONDAY_ISO = '2026-01-05';

/**
 * Fixture-fed shells mirroring each real page's happy-path layout — used
 * ONLY by `app/dev/skeleton-capture/page.tsx` (boneyard's CLI capture
 * target) and never rendered to a real user. Kept here, not inlined in the
 * capture page, so a future layout change to a real page has one obvious
 * place to update the matching fixture shape too.
 */

export function MenuPageFixture() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h2">¡Hola!</h1>
          <p className="mt-1 text-body-md text-tertiary">Tu menú de hoy, listo.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/favorites" className={buttonVariants({ variant: 'icon', size: 'sm' })} aria-label="Favoritos">
            <Heart className="size-4" />
          </Link>
          <Link href="/notifications" className={buttonVariants({ variant: 'icon', size: 'sm' })} aria-label="Notificaciones">
            <Bell className="size-4" />
          </Link>
        </div>
      </div>

      <CalendarSuggestionBanner />
      <AvailableRecipesCard count={625} />
      <SavingsEstimateCards />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(['desayuno', 'comida', 'cena'] as const).map(slot => (
          <div key={slot}>
            <p className="mb-2 text-h6 uppercase text-tertiary">{slot}</p>
            <FavoriteRecipeCard recipe={makeFixtureRecipe({ id: `fixture-${slot}` })} initialIsFavorite={false} />
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-center">
        <span className={buttonVariants({ variant: 'action', size: 'lg' })}>
          <Zap className="size-[18px]" strokeWidth={2} />
          Cocinar ya
        </span>
      </div>

      <LatestRecipesSection recipes={makeFixtureRecipes(6)} favoriteRecipeIds={new Set()} />
    </div>
  );
}

export function RecipesPageFixture() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-h2">Biblioteca</h1>
      <p className="mt-1 text-body-md text-tertiary">
        Descubre recetas de tu catálogo, dentro de tu perfil de seguridad alimentaria.
      </p>

      <div className="mt-6 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tertiary" aria-hidden="true" />
          <Input type="search" placeholder="Buscar receta, ingrediente..." className="pl-9" readOnly />
        </div>
        <Button type="button" variant="secondary">
          <Plus className="size-4" aria-hidden="true" />
          Crear propia
        </Button>
      </div>

      <SegmentedControl className="mt-4" aria-label="Filtrar por tipo de comida" options={MEAL_TABS} value="todo" onChange={() => {}} />

      <div className="mt-4 flex flex-wrap gap-2">
        {['Todas las cocinas', 'Cualquier dieta', 'Sin evitar ningún alérgeno'].map(label => (
          <span key={label} className="flex h-9 items-center gap-1 rounded-full border border-border bg-surface px-3 text-body-sm text-text">
            <BookOpen className="size-3" aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>

      <p className="mt-4 text-body-sm text-tertiary">12 recetas encontradas</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {makeFixtureRecipes(8).map(recipe => (
          <FavoriteRecipeCard key={recipe.id} recipe={recipe} initialIsFavorite={false} />
        ))}
      </div>
    </div>
  );
}

export function CalendarPageFixture() {
  const { menu, slotIds, estados } = makeFixtureWeekGrid();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-h2">Calendario semanal</h1>
        <div className="flex items-center gap-2">
          <WeekNavigation semanaIso={FIXTURE_SEMANA_ISO} mondayIso={FIXTURE_MONDAY_ISO} />
          <DeleteWeekButton mealPlanId="fixture-meal-plan" />
        </div>
      </div>
      <p className="mt-1 text-body-md text-tertiary">Arrastra cualquier plato para reorganizar tu semana.</p>

      <div className="mt-6">
        <CalendarGrid initialMenu={menu} slotIds={slotIds} initialEstados={estados} userPlan="pro" />
      </div>
    </div>
  );
}

export function ShoppingListPageFixture() {
  return <ShoppingListView list={makeFixtureShoppingList()} />;
}
