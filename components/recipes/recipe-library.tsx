'use client';

import type { RecetaPropia, Recipe, RecipeDieta, TipoCocina } from '@schemas';
import { BookOpen, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { DIETA_LABELS, RecipeCard } from '@/components/recipe/recipe-card';
import { CreateRecipeForm } from '@/components/recipes/create-recipe-form';
import { PersonalRecipeCard } from '@/components/recipes/personal-recipe-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ALERGENO_OPTIONS } from '@/lib/constants/dietary-options';

type MealTab = 'todo' | 'desayuno' | 'comida' | 'cena';

const MEAL_TABS: { value: MealTab, label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'comida', label: 'Comida' },
  { value: 'cena', label: 'Cena' },
];

const TODAS_LAS_COCINAS = 'todas' as const;
const CUALQUIER_DIETA = 'cualquiera' as const;
const NINGUN_ALERGENO = 'ninguno' as const;

const COCINA_OPTIONS: TipoCocina[] = ['española', 'italiana', 'mexicana', 'asiática', 'mediterránea', 'latina', 'internacional'];
const DIETA_OPTIONS = Object.keys(DIETA_LABELS) as (keyof RecipeDieta)[];

/** FRESCO-67 — no dropdown primitive exists in this design system yet; a native `<select>`, styled to match `Input`'s pill shape, is the simplest correct choice for a single-pick list this size (7–10 options — `SegmentedControl` would be too wide/cluttered at that count). */
function FilterSelect({ label, value, onChange, children }: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={event => onChange(event.target.value)}
      className="h-9 rounded-full border border-border bg-surface px-3 text-body-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {children}
    </select>
  );
}

/**
 * FRESCO-66 — a recipe with `clasificacion: null` (some seed rows are only
 * partially populated, per `RecipeCard`'s own doc comment) never matches a
 * specific meal tab but still shows under "Todo" — same optional-chaining
 * fallback already used elsewhere for `clasificacion`.
 */
function matchesTab(recipe: Recipe, tab: MealTab): boolean {
  if (tab === 'todo') { return true; }
  return recipe.clasificacion?.tipo_plato === tab;
}

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

function matchesCocina(recipe: Recipe, cocina: string): boolean {
  if (cocina === TODAS_LAS_COCINAS) { return true; }
  return recipe.clasificacion?.cocina === cocina;
}

function matchesDieta(recipe: Recipe, dieta: string): boolean {
  if (dieta === CUALQUIER_DIETA) { return true; }
  return recipe.dieta?.[dieta as keyof RecipeDieta] === true;
}

/**
 * FRESCO-67 — a temporary, session-only narrowing (per the story's own
 * Business Rules): never writes to `user_profiles`, never widens past what
 * the permanent profile already excludes. The catalog this filter runs
 * against is already the safety-filtered set from `getCatalogRecipes()` —
 * an allergen the profile permanently excludes never reaches this filter to
 * begin with.
 */
function matchesAlergenoFilter(recipe: Recipe, alergeno: string): boolean {
  if (alergeno === NINGUN_ALERGENO) { return true; }
  const alergenos = recipe.alergenos ?? [];
  return !alergenos.includes(alergeno);
}

export function RecipeLibrary({ recipes, recetasPropias }: { recipes: Recipe[], recetasPropias: RecetaPropia[] }) {
  const [query, setQuery] = React.useState('');
  const [tab, setTab] = React.useState<MealTab>('todo');
  const [cocina, setCocina] = React.useState<string>(TODAS_LAS_COCINAS);
  const [dieta, setDieta] = React.useState<string>(CUALQUIER_DIETA);
  const [alergeno, setAlergeno] = React.useState<string>(NINGUN_ALERGENO);
  const [misRecetas, setMisRecetas] = React.useState(recetasPropias);
  const [createOpen, setCreateOpen] = React.useState(false);
  const filtered = React.useMemo(
    () => recipes.filter(recipe =>
      matchesQuery(recipe, query)
      && matchesTab(recipe, tab)
      && matchesCocina(recipe, cocina)
      && matchesDieta(recipe, dieta)
      && matchesAlergenoFilter(recipe, alergeno)),
    [recipes, query, tab, cocina, dieta, alergeno],
  );

  return (
    <div>
      <div className="mt-6 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tertiary" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Buscar receta, ingrediente..."
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="pl-9"
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
      </div>

      <CreateRecipeForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={receta => setMisRecetas(current => [receta, ...current])}
      />

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

      <SegmentedControl
        className="mt-4"
        aria-label="Filtrar por tipo de comida"
        options={MEAL_TABS}
        value={tab}
        onChange={value => setTab(value as MealTab)}
      />

      <div className="mt-4 flex flex-wrap gap-2" data-testid="recipe_library_filters">
        <FilterSelect label="Filtrar por cocina" value={cocina} onChange={setCocina}>
          <option value={TODAS_LAS_COCINAS}>Todas las cocinas</option>
          {COCINA_OPTIONS.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </FilterSelect>

        <FilterSelect label="Filtrar por dieta" value={dieta} onChange={setDieta}>
          <option value={CUALQUIER_DIETA}>Cualquier dieta</option>
          {DIETA_OPTIONS.map(option => (
            <option key={option} value={option}>{DIETA_LABELS[option]}</option>
          ))}
        </FilterSelect>

        <FilterSelect label="Evitar un alérgeno puntual" value={alergeno} onChange={setAlergeno}>
          <option value={NINGUN_ALERGENO}>Sin evitar ningún alérgeno</option>
          {ALERGENO_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </FilterSelect>
      </div>

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
              title="No encontramos nada para tu búsqueda"
              description="Prueba con otro nombre o ingrediente."
            />
          )
        : (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="recipe_library_grid">
              {filtered.map(recipe => (
                <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
                  <RecipeCard recipe={recipe} />
                </Link>
              ))}
            </div>
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
