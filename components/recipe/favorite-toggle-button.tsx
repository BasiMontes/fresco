'use client';

import { Heart } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { addFavorite, removeFavorite } from '@/lib/api/favorites';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export interface FavoriteToggleButtonProps {
  recipeId: string
  initialIsFavorite: boolean
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
 * fill without a burst, per the snippet's own documented behavior.
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

/**
 * FRESCO-108 — standalone favorite toggle for surfaces that don't render a
 * full `RecipeCard` around it (the recipe detail page). Same optimistic
 * update + revert-on-failure pattern as `FavoriteRecipeCard`.
 */
export function FavoriteToggleButton({ recipeId, initialIsFavorite, className }: FavoriteToggleButtonProps) {
  const [isFavorite, setIsFavorite] = React.useState(initialIsFavorite);
  const supabase = React.useMemo(() => createClient(), []);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  async function handleToggle() {
    const next = !isFavorite;
    setIsFavorite(next);
    // AC-1: the visual feedback fires immediately, ahead of the network
    // round-trip below — same optimistic-update timing already in place,
    // this is only the added celebration layer.
    if (next) {
      triggerLikeBurst(buttonRef.current);
    }

    try {
      if (next) {
        await addFavorite(supabase, recipeId);
      }
      else {
        await removeFavorite(supabase, recipeId);
      }
    }
    catch (error) {
      console.error('[FavoriteToggleButton] toggle failed, reverting', error);
      setIsFavorite(!next);
    }
  }

  return (
    <Button
      ref={buttonRef}
      variant="icon"
      size="sm"
      aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      data-testid="recipe_detail_favorite_button"
      data-liked={isFavorite}
      onClick={() => { void handleToggle(); }}
      className={cn('t-like relative', className)}
    >
      <span className="t-like-icon">
        <Heart className="t-like-heart size-6" />
      </span>
      <span className="t-like-particles" aria-hidden="true" data-testid="recipe_detail_favorite_particles">
        {Array.from({ length: LIKE_PARTICLE_COUNT }, (_, index) => (
          <i key={index} />
        ))}
      </span>
    </Button>
  );
}
