'use client';

import type { RecetaPropia, Recipe, RecipeDieta, TipoCocina } from '@schemas';
import type { MealTab, RecipeFilterState } from '@/lib/recipes/recipe-filters';
import { BookOpen, Plus, Search, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { FavoriteRecipeCard } from '@/components/recipe/favorite-recipe-card';
import { CreateRecipeForm } from '@/components/recipes/create-recipe-form';
import { FilterSection } from '@/components/recipes/filter-section';
import { PersonalRecipeCard } from '@/components/recipes/personal-recipe-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterDrawer } from '@/components/ui/filter-drawer';
import { Input } from '@/components/ui/input';
import { ALERGENO_OPTIONS } from '@/lib/constants/dietary-options';
import { DIETA_LABELS } from '@/lib/recipes/labels';
import { countActiveFilters, countWithOption, EMPTY_FILTER_STATE, matchesRecipeFilters } from '@/lib/recipes/recipe-filters';

/** FRESCO-187 — how many recipes render per page before "Ver más recetas" appends the next batch. */
const RECIPE_PAGE_SIZE = 30;

const COCINA_OPTIONS: TipoCocina[] = ['española', 'italiana', 'mexicana', 'asiática', 'mediterránea', 'latina', 'internacional'];
const DIETA_OPTIONS = Object.keys(DIETA_LABELS) as (keyof RecipeDieta)[];
const MEAL_TYPE_OPTIONS: { value: MealTab, label: string }[] = [
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'comida', label: 'Comida' },
  { value: 'cena', label: 'Cena' },
];

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const COCINA_FILTER_OPTIONS = COCINA_OPTIONS.map(option => ({ value: option, label: capitalize(option) }));
const DIETA_FILTER_OPTIONS = DIETA_OPTIONS.map(option => ({ value: option, label: DIETA_LABELS[option] ?? option }));

/**
 * FRESCO-65 — client-side search over the safety-filtered catalog the page
 * already fetched (`getCatalogRecipes()`). Client-side, not a server round
 * trip per keystroke: the catalog is already bounded to one profile's safe
 * set (hundreds of rows, not the full ~1000-row table).
 *
 * Matches `nombre` OR any entry of `ingredientes_principales`,
 * case-insensitive substring (no accent-folding — a v1 gap, not silently
 * hidden: searching "piña" won't match a name typed "pina").
 */
function matchesQuery(recipe: Recipe, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) { return true; }

  if (recipe.nombre.toLowerCase().includes(needle)) { return true; }

  const ingredientes = recipe.ingredientes_principales ?? [];
  return ingredientes.some(ingrediente => ingrediente.toLowerCase().includes(needle));
}

/** One removable chip per active filter value — flattened across all 4 sections for the drawer's "Filtros aplicados" row. */
function activeFilterChips(filters: RecipeFilterState): { section: keyof RecipeFilterState, value: string, label: string }[] {
  const chips: { section: keyof RecipeFilterState, value: string, label: string }[] = [];
  for (const value of filters.mealTypes) {
    chips.push({ section: 'mealTypes', value, label: capitalize(value) });
  }
  for (const value of filters.cocinas) {
    chips.push({ section: 'cocinas', value, label: capitalize(value) });
  }
  for (const value of filters.dietas) {
    chips.push({ section: 'dietas', value, label: DIETA_LABELS[value] ?? value });
  }
  for (const value of filters.alergenos) {
    chips.push({ section: 'alergenos', value, label: ALERGENO_OPTIONS.find(option => option.value === value)?.label ?? value });
  }
  return chips;
}

export function RecipeLibrary({ recipes, recetasPropias, favoriteRecipeIds }: { recipes: Recipe[], recetasPropias: RecetaPropia[], favoriteRecipeIds: Set<string> }) {
  const [query, setQuery] = React.useState('');
  const [appliedFilters, setAppliedFilters] = React.useState<RecipeFilterState>(EMPTY_FILTER_STATE);
  const [draftFilters, setDraftFilters] = React.useState<RecipeFilterState>(EMPTY_FILTER_STATE);
  const [filterDrawerOpen, setFilterDrawerOpen] = React.useState(false);
  const [misRecetas, setMisRecetas] = React.useState(recetasPropias);
  const [createOpen, setCreateOpen] = React.useState(false);

  const queryFiltered = React.useMemo(
    () => recipes.filter(recipe => matchesQuery(recipe, query)),
    [recipes, query],
  );
  const filtered = React.useMemo(
    () => queryFiltered.filter(recipe => matchesRecipeFilters(recipe, appliedFilters)),
    [queryFiltered, appliedFilters],
  );
  // FRESCO-187 — the full catalog (hundreds of recipes) rendered into the
  // DOM in one shot with no cap. Filtering itself stays instant (still runs
  // client-side over the full `recipes` array above — that's not what was
  // slow), only the RENDER is paginated. Resets to one page whenever the
  // filtered set changes, so switching filters after loading more pages
  // never leaves a stale, oversized render or hides genuine results below
  // an already-scrolled-past page boundary.
  const [visibleCount, setVisibleCount] = React.useState(RECIPE_PAGE_SIZE);
  React.useEffect(() => {
    setVisibleCount(RECIPE_PAGE_SIZE);
  }, [filtered]);
  const visible = filtered.slice(0, visibleCount);

  const draftCount = React.useMemo(
    () => queryFiltered.filter(recipe => matchesRecipeFilters(recipe, draftFilters)).length,
    [queryFiltered, draftFilters],
  );

  function openFilterDrawer() {
    setDraftFilters(appliedFilters);
    setFilterDrawerOpen(true);
  }

  function toggleDraftValue(section: keyof RecipeFilterState, value: string) {
    setDraftFilters((current) => {
      const list = current[section] as string[];
      const next = list.includes(value) ? list.filter(item => item !== value) : [...list, value];
      return { ...current, [section]: next } as RecipeFilterState;
    });
  }

  function applyDraftFilters() {
    setAppliedFilters(draftFilters);
    setFilterDrawerOpen(false);
  }

  return (
    <div>
      <div className="mt-6 flex items-center gap-2">
        <div className="relative max-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tertiary" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Buscar receta, ingrediente..."
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="truncate pl-9"
            data-testid="recipe_search_input"
            aria-label="Buscar receta o ingrediente"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setCreateOpen(true)}
          data-testid="crear_propia_button"
        >
          <Plus className="size-4" aria-hidden="true" />
          Crear propia
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={openFilterDrawer}
          data-testid="filtrar_y_ordenar_button"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filtrar y ordenar
          {countActiveFilters(appliedFilters) > 0 && (
            <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-primary text-caption text-background">
              {countActiveFilters(appliedFilters)}
            </span>
          )}
        </Button>
      </div>

      <CreateRecipeForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={receta => setMisRecetas(current => [receta, ...current])}
      />

      <FilterDrawer
        open={filterDrawerOpen}
        onOpenChange={setFilterDrawerOpen}
        title="Filtrar y ordenar"
        onClearAll={() => setDraftFilters(EMPTY_FILTER_STATE)}
        aria-label="Filtrar y ordenar recetas"
        data-testid="recipe_filter_drawer"
        footer={(
          <Button
            type="button"
            className="w-full"
            onClick={applyDraftFilters}
            data-testid="recipe_filter_drawer_apply_button"
          >
            {draftCount === 1 ? 'Mostrar 1 receta' : `Mostrar ${draftCount} recetas`}
          </Button>
        )}
      >
        {activeFilterChips(draftFilters).length > 0 && (
          <div className="flex flex-wrap gap-2 bg-neutral-100 p-4">
            {activeFilterChips(draftFilters).map(chip => (
              <button
                key={`${chip.section}-${chip.value}`}
                type="button"
                onClick={() => toggleDraftValue(chip.section, chip.value)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-body-sm text-text"
              >
                <span aria-hidden="true">×</span>
                {chip.label}
              </button>
            ))}
          </div>
        )}

        <FilterSection
          label="Comida"
          options={MEAL_TYPE_OPTIONS}
          selected={draftFilters.mealTypes}
          onToggle={value => toggleDraftValue('mealTypes', value)}
          countFor={value => countWithOption(queryFiltered, draftFilters, 'mealTypes', value as MealTab)}
          data-testid="recipe_filter_section_comida"
        />
        <FilterSection
          label="Cocina"
          options={COCINA_FILTER_OPTIONS}
          selected={draftFilters.cocinas}
          onToggle={value => toggleDraftValue('cocinas', value)}
          countFor={value => countWithOption(queryFiltered, draftFilters, 'cocinas', value)}
          data-testid="recipe_filter_section_cocina"
        />
        <FilterSection
          label="Dieta"
          options={DIETA_FILTER_OPTIONS}
          selected={draftFilters.dietas}
          onToggle={value => toggleDraftValue('dietas', value)}
          countFor={value => countWithOption(queryFiltered, draftFilters, 'dietas', value as keyof RecipeDieta)}
          data-testid="recipe_filter_section_dieta"
        />
        <FilterSection
          label="Alérgeno"
          options={ALERGENO_OPTIONS}
          selected={draftFilters.alergenos}
          onToggle={value => toggleDraftValue('alergenos', value)}
          countFor={value => countWithOption(queryFiltered, draftFilters, 'alergenos', value)}
          data-testid="recipe_filter_section_alergeno"
        />
      </FilterDrawer>

      {misRecetas.length > 0 && (
        <div className="mt-6" data-testid="personal_recipes_section">
          <h2 className="text-h6 uppercase text-tertiary">Tus recetas</h2>
          <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {misRecetas.map(receta => (
              <Link key={receta.id} href={`/recipes/${receta.id}`}>
                <PersonalRecipeCard receta={receta} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <p className="mt-4 text-body-sm text-tertiary" data-testid="recipe_library_count">
          {filtered.length}
          {' '}
          {filtered.length === 1 ? 'receta encontrada' : 'recetas encontradas'}
        </p>
      )}

      {filtered.length === 0
        ? (
            <EmptyState
              data-testid="recipe_search_empty_state"
              className="mt-6"
              icon={<Search className="size-8 text-tertiary" aria-hidden="true" />}
              title="No encontramos nada en el catálogo para tu búsqueda"
              description="Prueba con otro nombre o ingrediente. La búsqueda y los filtros no aplican a tus recetas propias, que siguen visibles arriba."
            />
          )
        : (
            <>
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="recipe_library_grid">
                {visible.map(recipe => (
                  <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
                    <FavoriteRecipeCard recipe={recipe} initialIsFavorite={favoriteRecipeIds.has(recipe.id)} />
                  </Link>
                ))}
              </div>
              {visibleCount < filtered.length && (
                <div className="mt-6 flex justify-center">
                  <Button
                    type="button"
                    variant="secondary"
                    data-testid="recipe_library_load_more_button"
                    onClick={() => setVisibleCount(count => count + RECIPE_PAGE_SIZE)}
                  >
                    Ver más recetas
                  </Button>
                </div>
              )}
            </>
          )}
    </div>
  );
}

/** Catalog itself came back empty for this profile — distinct from a no-results search (see `RecipeLibrary` above). */
export function EmptyCatalogState() {
  return (
    <EmptyState
      data-testid="recipe_catalog_empty_state"
      className="mt-6"
      icon={<BookOpen className="size-8 text-tertiary" aria-hidden="true" />}
      title="No encontramos recetas para tu perfil"
      description="Prueba revisando tus restricciones de dieta o alérgenos en tu perfil."
    />
  );
}
