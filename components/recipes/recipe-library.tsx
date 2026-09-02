'use client';

import type { RecetaPropia, RecipeDieta, TipoCocina } from '@schemas';
import type { CatalogCard, CatalogFacets } from '@/lib/api/recipes';
import type { MealTab, RecipeFilterState } from '@/lib/recipes/recipe-filters';
import { BookOpen, Plus, Search, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
import { countActiveFilters, EMPTY_FILTER_STATE } from '@/lib/recipes/recipe-filters';

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

const FILTER_PARAM: Record<keyof RecipeFilterState, string> = {
  mealTypes: 'meal',
  cocinas: 'cocina',
  dietas: 'dieta',
  alergenos: 'alergeno',
};

/**
 * The live URL query, read at call time — NOT from a React prop. Navigation
 * runs inside a transition, so between an action and the RSC re-render the
 * `appliedFilters` / `query` props are stale; building the next URL off a
 * stale prop drops whatever the previous action set (e.g. filter-then-type
 * losing the filter). `window.location.search` is always current.
 */
function currentSearchParams(): URLSearchParams {
  return new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
}

function withSearchParams(pathname: string, search: URLSearchParams): string {
  const qs = search.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function applyFilterParams(search: URLSearchParams, filters: RecipeFilterState): void {
  for (const [section, param] of Object.entries(FILTER_PARAM) as [keyof RecipeFilterState, string][]) {
    const values = filters[section];
    if (values.length > 0) { search.set(param, values.join(',')); }
    else { search.delete(param); }
  }
}

export interface RecipeLibraryProps {
  recipes: CatalogCard[]
  total: number
  page: number
  facets: CatalogFacets
  appliedFilters: RecipeFilterState
  query: string
  recetasPropias: RecetaPropia[]
  favoriteRecipeIds: Set<string>
}

export function RecipeLibrary({
  recipes,
  total,
  page,
  facets,
  appliedFilters,
  query,
  recetasPropias,
  favoriteRecipeIds,
}: RecipeLibraryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();

  const [searchInput, setSearchInput] = React.useState(query);
  const [draftFilters, setDraftFilters] = React.useState<RecipeFilterState>(appliedFilters);
  const [filterDrawerOpen, setFilterDrawerOpen] = React.useState(false);
  const [misRecetas, setMisRecetas] = React.useState(recetasPropias);
  const [createOpen, setCreateOpen] = React.useState(false);

  // Keep the input aligned with the URL when navigation comes from elsewhere
  // (back/forward, a removed chip).
  React.useEffect(() => {
    setSearchInput(query);
  }, [query]);

  const navigate = React.useCallback((search: URLSearchParams) => {
    startTransition(() => router.push(withSearchParams(pathname, search)));
  }, [router, pathname]);

  // Debounced search → URL. Resets to page 1; preserves whatever filters the
  // live URL already carries.
  React.useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === query) { return; }
    const timer = setTimeout(() => {
      const search = currentSearchParams();
      search.delete('page');
      if (trimmed) { search.set('q', trimmed); }
      else { search.delete('q'); }
      navigate(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, query, navigate]);

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
    setFilterDrawerOpen(false);
    const search = currentSearchParams();
    search.delete('page');
    applyFilterParams(search, draftFilters);
    // Carry whatever is typed right now, even if the search debounce has not
    // fired yet — otherwise applying a filter mid-type would drop the query.
    const typed = searchInput.trim();
    if (typed) { search.set('q', typed); }
    else { search.delete('q'); }
    navigate(search);
  }

  function loadMore() {
    const search = currentSearchParams();
    search.set('page', String(page + 1));
    navigate(search);
  }

  const activeCount = countActiveFilters(appliedFilters);
  const noNarrowing = activeCount === 0 && query === '';
  const hasMore = recipes.length < total;

  return (
    <div>
      <div className="mt-6 flex items-center gap-2">
        <div className="relative max-w-56 flex-1 sm:max-w-96">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tertiary" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Buscar receta, ingrediente..."
            value={searchInput}
            onChange={event => setSearchInput(event.target.value)}
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
          {activeCount > 0 && (
            <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-primary text-caption text-background">
              {activeCount}
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
            Aplicar filtros
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

        {/* Facet counts are computed server-side by `get_catalog` for the
            APPLIED filter state (FRESCO-384). A number next to an unchecked
            box is "how many recipes if you also checked this"; after toggling
            draft boxes the counts refresh on Apply, not per click. */}
        <FilterSection
          label="Comida"
          options={MEAL_TYPE_OPTIONS}
          selected={draftFilters.mealTypes}
          onToggle={value => toggleDraftValue('mealTypes', value)}
          countFor={value => facets.mealTypes[value] ?? 0}
          data-testid="recipe_filter_section_comida"
        />
        <FilterSection
          label="Cocina"
          options={COCINA_FILTER_OPTIONS}
          selected={draftFilters.cocinas}
          onToggle={value => toggleDraftValue('cocinas', value)}
          countFor={value => facets.cocinas[value] ?? 0}
          data-testid="recipe_filter_section_cocina"
        />
        <FilterSection
          label="Dieta"
          options={DIETA_FILTER_OPTIONS}
          selected={draftFilters.dietas}
          onToggle={value => toggleDraftValue('dietas', value)}
          countFor={value => facets.dietas[value] ?? 0}
          data-testid="recipe_filter_section_dieta"
        />
        <FilterSection
          label="Alérgeno"
          options={ALERGENO_OPTIONS}
          selected={draftFilters.alergenos}
          onToggle={value => toggleDraftValue('alergenos', value)}
          countFor={value => facets.alergenos[value] ?? 0}
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

      {total > 0 && (
        <p className="mt-4 text-body-sm text-tertiary" data-testid="recipe_library_count">
          {total}
          {' '}
          {total === 1 ? 'receta encontrada' : 'recetas encontradas'}
        </p>
      )}

      {total === 0 && noNarrowing && <EmptyCatalogState />}

      {total === 0 && !noNarrowing && (
        <EmptyState
          data-testid="recipe_search_empty_state"
          className="mt-6"
          icon={<Search className="size-8 text-tertiary" aria-hidden="true" />}
          title="No encontramos nada en el catálogo para tu búsqueda"
          description="Prueba con otro nombre, ingrediente o filtro. La búsqueda y los filtros no aplican a tus recetas propias, que siguen visibles arriba."
        />
      )}

      {total > 0 && (
        <>
          <div
            className={`mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4${isPending ? ' opacity-60' : ''}`}
            data-testid="recipe_library_grid"
          >
            {recipes.map(recipe => (
              <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
                <FavoriteRecipeCard recipe={recipe} initialIsFavorite={favoriteRecipeIds.has(recipe.id)} />
              </Link>
            ))}
          </div>
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <Button
                type="button"
                variant="secondary"
                data-testid="recipe_library_load_more_button"
                disabled={isPending}
                onClick={loadMore}
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
