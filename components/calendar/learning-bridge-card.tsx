'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { writeLearningBridgeDismissed } from '@/lib/calendar/learning-bridge-preference';

interface LearningBridgeCardProps {
  plan: 'free' | 'pro' | 'family'
  /** True once any slot in the current plan has been marked cocinada/descartada. */
  hasMarks: boolean
}

/**
 * FRESCO-369 (A4-H12): the "week 1" bridge for the learning moat. The moat
 * (menus that adapt to what you cook) has no visible payoff until week 2 and
 * only for Pro — so a user pays in week 1 without ever seeing the differential
 * value. This card makes the mechanism visible and honest *before* the payoff:
 * what the cooked/discarded signal does, with a worked example (not a live
 * simulation — "esto es lo que haremos con esa señal").
 *
 * The three rules are the real ones, verified against
 * `supabase/functions/generate-meal-plan/{index.ts,menu-selector.ts}`:
 *   1. `recentRecipeIds` — cocinada + descartada excluded for 2 weeks.
 *   2. `get_user_recipe_engagement` → `scoreRecipe` +cocinada boost afterwards.
 *   3. `scoreRecipe` −6 when descartada > 0 — a strong, long-lived penalty.
 *
 * Visibility: Free always (with a `/profile` CTA — AC "Free ve la propuesta
 * con CTA claro"); Pro/Family only while `!hasMarks` (week 1, framed as "así
 * funcionará"); hidden for Pro once they've engaged — `/menu`'s
 * `learning_explanation_card` carries the real payoff from then on.
 *
 * Uses the `pro` card variant, not `insight` — `insight` is reserved for the
 * actual learning payoff and must never carry pre-data content (master-design-
 * plan §5-D). This card is a promise, so it gets the Pro-framed border treatment.
 *
 * FRESCO-512: dismissible via the `X` — `'use client'` for the click handler.
 * `writeLearningBridgeDismissed` + `router.refresh()` persists the choice
 * (cookie, same pattern as `lib/layout/sidebar-preference.ts`) and re-renders
 * `app/(app)/calendar/page.tsx`, which swaps this card for the
 * `LearningBridgeReopenLink` below.
 */
export function LearningBridgeCard({ plan, hasMarks }: LearningBridgeCardProps) {
  const router = useRouter();
  const isFree = plan === 'free';

  if (!isFree && hasMarks) {
    return null;
  }

  return (
    <Card
      variant="pro"
      // Kept so the existing @aprendizaje coverage still finds the Free notice.
      data-testid={isFree ? 'learning_free_tier_notice' : 'learning_bridge_card'}
    >
      <CardContent className="text-body-sm">
        <div className="flex items-start justify-between gap-2">
          <p className="text-h6 uppercase">Cómo aprenden tus menús</p>
          <button
            type="button"
            onClick={() => {
              writeLearningBridgeDismissed(true);
              router.refresh();
            }}
            className="shrink-0 text-tertiary hover:text-text"
            aria-label="Cerrar"
            data-testid="learning_bridge_dismiss"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1.5">
          En cuanto marques platos como cocinados o descartados, tus menús se adaptan: lo que marcas no vuelve a salir durante 2 semanas, los platos que sueles cocinar ganan peso, y los que descartas bajan mucho.
        </p>
        <p className="mt-1.5">
          <span className="font-medium">Ejemplo:</span>
          {' '}
          si marcas «Lentejas estofadas» como cocinada y «Ensalada de quinoa» como descartada, la semana que viene no sale ninguna de las dos y luego las lentejas vuelven antes.
        </p>
        {isFree && (
          <p className="mt-1.5">
            En Free tus marcas se guardan igual, pero no se aplican a tus menús.
            {' '}
            <Link href="/profile" data-testid="learning_bridge_cta" className="font-semibold underline">
              Ver el plan Pro
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * FRESCO-512: the reopen control for a dismissed `LearningBridgeCard`, shown
 * in the page header instead of the card itself. Same toggle, same cookie —
 * `router.refresh()` re-runs `app/(app)/calendar/page.tsx` with the updated
 * value, which is what lets this control (header) and the card (further down
 * the page, past `AlertBanner`) stay in sync despite not being adjacent in
 * the JSX tree.
 */
export function LearningBridgeReopenLink() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        writeLearningBridgeDismissed(false);
        router.refresh();
      }}
      data-testid="learning_bridge_reopen"
      className="mt-1 text-body-sm text-primary underline"
    >
      Ver cómo aprenden tus menús
    </button>
  );
}
