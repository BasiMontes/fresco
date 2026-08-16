import type { RecetaPropia, Recipe, RecipeDieta } from '@schemas';
import type { RecipeDetail } from '@/lib/api/recipes';
import { ArrowLeft, BookOpen } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { FavoriteToggleButton } from '@/components/recipe/favorite-toggle-button';
import { buttonVariants } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { ALERGENO_OPTIONS } from '@/lib/constants/dietary-options';
import { getCategoryIcon } from '@/lib/recipes/category-icon';
import { COSTE_ESTIMADO_LABELS, DIETA_LABELS, DIFICULTAD_LABELS } from '@/lib/recipes/labels';

/** Every active diet flag as a display label — unlike `RecipeCard`'s single "first match" pick (space-constrained), the detail view has room to show all of them. */
function activeDietaLabels(dieta: RecipeDieta | null): string[] {
  if (!dieta) { return []; }
  return (Object.keys(DIETA_LABELS) as (keyof RecipeDieta)[])
    .filter(flag => dieta[flag])
    .map(flag => DIETA_LABELS[flag])
    .filter((label): label is string => Boolean(label));
}

function alergenoLabel(value: string): string {
  return ALERGENO_OPTIONS.find(option => option.value === value)?.label ?? value;
}

function BackToLibraryLink({ from }: { from?: string }) {
  return from === 'menu'
    ? (
        <Link href="/menu" className={buttonVariants({ variant: 'ghost' })} data-testid="recipe_detail_back_link">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver al menú
        </Link>
      )
    : (
        <Link href="/recipes" className={buttonVariants({ variant: 'ghost' })} data-testid="recipe_detail_back_link">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a la Biblioteca
        </Link>
      );
}

function CatalogRecipeDetail({ receta, initialIsFavorite, from }: { receta: Recipe, initialIsFavorite: boolean, from?: string }) {
  const CategoryIcon = getCategoryIcon(receta.clasificacion?.categoria);
  const dietaLabels = activeDietaLabels(receta.dieta);
  const ingredientes = receta.ingredientes_principales ?? [];
  const pasos = receta.pasos_resumen ?? [];

  return (
    <div>
      <BackToLibraryLink from={from} />

      <div className="relative mt-4 grid aspect-video w-full place-items-center overflow-hidden rounded-card bg-neutral-200">
        {receta.foto_url
          ? (
              <Image
                src={receta.foto_url}
                alt={receta.nombre}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            )
          : (
              <CategoryIcon className="size-16 text-neutral-400" aria-hidden="true" />
            )}
        <FavoriteToggleButton
          recipeId={receta.id}
          initialIsFavorite={initialIsFavorite}
          className="absolute right-2 top-2"
        />
      </div>

      <p className="mt-4 text-h6 uppercase text-tertiary">{receta.clasificacion?.categoria ?? '—'}</p>
      <h1 className="text-h2">{receta.nombre}</h1>

      <div className="mt-2 flex flex-wrap gap-2" data-testid="recipe_detail_tags">
        {receta.clasificacion?.cocina && <Tag variant="neutral">{receta.clasificacion.cocina}</Tag>}
        {dietaLabels.map(label => <Tag key={label} variant="accent">{label}</Tag>)}
        {(receta.alergenos ?? []).map(alergeno => (
          <Tag key={alergeno} variant="accent-2">
            {alergenoLabel(alergeno)}
          </Tag>
        ))}
      </div>

      <p className="mt-3 text-body-md text-tertiary">
        {receta.meta?.tiempo_total_min ?? '—'}
        {' '}
        min ·
        {' '}
        {receta.meta?.dificultad ? DIFICULTAD_LABELS[receta.meta.dificultad] : '—'}
        {' '}
        ·
        {' '}
        {receta.meta?.coste_estimado ? COSTE_ESTIMADO_LABELS[receta.meta.coste_estimado] : '—'}
      </p>

      {receta.descripcion_corta && <p className="mt-4 text-body-md">{receta.descripcion_corta}</p>}

      <h2 className="mt-6 text-h4">Ingredientes</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-body-md" data-testid="recipe_detail_ingredientes">
        {ingredientes.map(ingrediente => <li key={ingrediente}>{ingrediente}</li>)}
      </ul>

      <h2 className="mt-6 text-h4">Preparación</h2>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-body-md" data-testid="recipe_detail_pasos">
        {pasos.map(paso => <li key={paso}>{paso}</li>)}
      </ol>
    </div>
  );
}

function PersonalRecipeDetail({ receta, from }: { receta: RecetaPropia, from?: string }) {
  return (
    <div>
      <BackToLibraryLink from={from} />

      <div className="relative mt-4 grid aspect-video w-full place-items-center overflow-hidden rounded-card bg-neutral-200">
        <BookOpen className="size-16 text-neutral-400" aria-hidden="true" />
      </div>

      <h1 className="mt-4 text-h2">{receta.nombre}</h1>
      <div className="mt-2">
        <Tag variant="outline">Tu receta</Tag>
      </div>

      <h2 className="mt-6 text-h4">Ingredientes</h2>
      {receta.ingredientes.length > 0
        ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-body-md" data-testid="recipe_detail_ingredientes">
              {receta.ingredientes.map(ingrediente => <li key={ingrediente}>{ingrediente}</li>)}
            </ul>
          )
        : (
            <p className="mt-2 text-body-sm italic text-tertiary" data-testid="recipe_detail_ingredientes_vacio">
              Sin ingredientes añadidos.
            </p>
          )}

      <h2 className="mt-6 text-h4">Preparación</h2>
      {receta.pasos.length > 0
        ? (
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-body-md" data-testid="recipe_detail_pasos">
              {receta.pasos.map(paso => <li key={paso}>{paso}</li>)}
            </ol>
          )
        : (
            <p className="mt-2 text-body-sm italic text-tertiary" data-testid="recipe_detail_pasos_vacio">
              Sin pasos añadidos.
            </p>
          )}
    </div>
  );
}

/** OOS (no edit/delete/rate/menu-add/share) and the shell (back link, name, ingredients, steps) are identical for both recipe types — only the metadata block differs, so this dispatches to one of two small render branches rather than duplicating the shell. */
export function RecipeDetailView({ detail, initialIsFavorite, from }: { detail: RecipeDetail, initialIsFavorite: boolean, from?: string }) {
  return detail.kind === 'catalogo'
    ? <CatalogRecipeDetail receta={detail.receta} initialIsFavorite={initialIsFavorite} from={from} />
    : <PersonalRecipeDetail receta={detail.receta} from={from} />;
}

export function RecipeNotFoundState({ from }: { from?: string }) {
  return (
    <div>
      <BackToLibraryLink from={from} />
      <p className="mt-6 text-body-md text-tertiary" data-testid="recipe_detail_not_found">
        No encontramos esta receta. Puede que ya no esté disponible para tu perfil.
      </p>
    </div>
  );
}
