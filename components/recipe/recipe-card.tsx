'use client';

import type { Recipe } from '@schemas';

import { Heart } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { getCategoryIcon } from '@/lib/recipes/category-icon';
import { COSTE_ESTIMADO_LABELS, firstActiveDietaLabel } from '@/lib/recipes/labels';
import { cn } from '@/lib/utils';

/**
 * Mirrors DESIGN.md's `components.recipe-card`: base card treatment + a
 * dedicated image area (`rounded.lg`, real photo when `recipe.foto_url` is
 * set, washed placeholder with a per-category icon otherwise — the P1
 * photography deferral from mvp-scope.md is being backfilled recipe by
 * recipe (FRESCO-31), so both states are real, not just the fallback), a
 * top-right circular favorite button, an `h6` kicker, a heading-font
 * title, one tag, and a meta line ("50 min · fácil · 2,80€/persona").
 *
 * Consumes the real, nested `@schemas` `Recipe` shape (`clasificacion`/
 * `meta`/`dieta` objects, the live DB/Edge Function contract) — not a flat
 * hand-duplicated shape. `meta`/`clasificacion`/`dieta` may be `null` (jsonb
 * columns the seeding pipeline populated only partially, per that type's own
 * doc comment), so every field read below is optional-chained with a
 * fallback rather than assumed present.
 *
 * FRESCO-78 — `h-full flex flex-col` on the root: cards in the same grid
 * row were visually uneven bottom edges when one title wrapped to more
 * lines than its neighbors (grid stretches the *grid item* to row height
 * by default, but this card's own box just sat at its natural content
 * height inside that taller cell, leaving blank space below it). Callers
 * whose grid item isn't this card's own root directly (e.g. `/menu`'s
 * "hoy" slots, which put a label above the card in the same cell) pass
 * `flex-1` via `className` instead — `flex-basis:0` from `flex-1` takes
 * precedence over `height:100%` from `h-full` here, so the two compose
 * correctly rather than fighting.
 */
/**
 * Everything `RecipeCard` actually reads off a recipe. A full `@schemas`
 * `Recipe` satisfies it; so does the card-sized `get_catalog` projection
 * (`CatalogCard`, FRESCO-384) — the browse grid no longer needs the whole row.
 */
export type RecipeCardData = Pick<Recipe, 'id' | 'nombre' | 'foto_url' | 'dieta' | 'clasificacion' | 'meta'>;

export interface RecipeCardProps {
  recipe: RecipeCardData
  isFavorite?: boolean
  onToggleFavorite?: () => void
  className?: string
}

const LIKE_PARTICLE_COUNT = 8;

/**
 * FRESCO-248 — reads a CSS `<time>` custom property as milliseconds.
 * `getComputedStyle` does NOT reliably keep the `ms` unit: Chromium
 * serializes some values as `s` (empirically confirmed live —
 * `--like-particle-dur: 600ms` computes to `".6s"`, not `"600ms"`). A plain
 * `parseFloat` on that string silently reads `0.6` and fires the cleanup
 * timer ~20ms later instead of 600ms — caught by sampling the DOM during
 * live verification, not by code-reading alone.
 */
function readCssTimeMs(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return raw.endsWith('ms') ? value : value * 1000;
}

/**
 * FRESCO-248 — seeds each of the 8 particles' fling vector (45° increments)
 * and replays the `.is-bursting` class for the CSS-driven burst
 * (`transitions-dev`'s `23-like-button.md`, `t-like-particles`). Only
 * called on a `false -> true` (liking) transition — unliking reverses the
 * fill without a burst, per the snippet's own documented behavior. Kept
 * local to this file (same shape as `favorite-toggle-button.tsx`'s copy) —
 * both host the identical heart markup but never share a parent to lift a
 * hook into.
 */
function triggerLikeBurst(button: HTMLButtonElement | null) {
  if (!button) {
    return;
  }
  const particles = button.querySelectorAll<HTMLElement>('.t-like-particles i');
  particles.forEach((particle, index) => {
    const angle = (360 / LIKE_PARTICLE_COUNT) * index;
    const radians = (angle * Math.PI) / 180;
    particle.style.setProperty('--px', `${Math.cos(radians) * 20}px`);
    particle.style.setProperty('--py', `${Math.sin(radians) * 20}px`);
    particle.style.setProperty('--pdelay', `${index * 15}ms`);
  });

  button.classList.remove('is-bursting');
  void button.offsetWidth; // force reflow so a rapid re-like replays cleanly
  button.classList.add('is-bursting');

  const burstDur = readCssTimeMs('--like-particle-dur', 600);
  window.setTimeout(() => button.classList.remove('is-bursting'), burstDur + 20);
}

export function RecipeCard({ recipe, isFavorite, onToggleFavorite, className }: RecipeCardProps) {
  const dietaLabel = firstActiveDietaLabel(recipe.dieta);
  const CategoryIcon = getCategoryIcon(recipe.clasificacion?.categoria);
  const favoriteButtonRef = React.useRef<HTMLButtonElement>(null);

  return (
    <div className={cn('flex h-full flex-col rounded-card bg-surface p-3 shadow-sm', className)}>
      <div className="relative mb-2 grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-lg bg-neutral-200">
        {recipe.foto_url
          ? (
              <Image
                src={recipe.foto_url}
                alt={recipe.nombre}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover"
              />
            )
          : (
              <CategoryIcon className="size-10 text-neutral-400" aria-hidden="true" />
            )}
        <Button
          ref={favoriteButtonRef}
          variant="icon"
          size="sm"
          aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          data-liked={Boolean(isFavorite)}
          onClick={(event) => {
            // FRESCO-69 — the card is now wrapped in a Link to the detail
            // page; without this the favorite button's click would bubble
            // into a navigation instead of toggling the favorite.
            event.preventDefault();
            event.stopPropagation();
            // AC-1: `isFavorite` here is still the pre-click value (state
            // update happens in the parent, after this handler returns), so
            // a `false` value means this click is a like — the burst should
            // only play on that transition, matching favorite-toggle-button.tsx.
            if (!isFavorite) {
              triggerLikeBurst(favoriteButtonRef.current);
            }
            onToggleFavorite?.();
          }}
          className="t-like absolute right-2 top-2"
        >
          <span className="t-like-icon">
            <Heart className="t-like-heart size-6" />
          </span>
          <span className="t-like-particles" aria-hidden="true" data-testid="recipe_card_favorite_particles">
            {Array.from({ length: LIKE_PARTICLE_COUNT }, (_, index) => (
              <i key={index} />
            ))}
          </span>
        </Button>
      </div>
      <p className="text-h6 uppercase text-tertiary">{recipe.clasificacion?.categoria ?? '—'}</p>
      <h3 className="text-h4">{recipe.nombre}</h3>
      <div className="mt-1">
        <Tag variant={dietaLabel ? 'accent' : 'neutral'}>
          {dietaLabel ?? recipe.clasificacion?.cocina ?? '—'}
        </Tag>
      </div>
      <p className="mt-2 text-body-sm text-tertiary">
        {recipe.meta?.tiempo_total_min ?? '—'}
        {' '}
        min ·
        {' '}
        {recipe.meta?.coste_estimado ? COSTE_ESTIMADO_LABELS[recipe.meta.coste_estimado] : '—'}
      </p>
    </div>
  );
}
