import type { Recipe } from '@schemas';
import { GenerateWeekButton } from '@/components/calendar/generate-week-button';
import { AvailableRecipesCard } from '@/components/menu/available-recipes-card';
import { LatestRecipesSection } from '@/components/menu/latest-recipes-section';
import { NoMenuEmptyState } from '@/components/menu/no-menu-empty-state';
import { PushOpenedTracker } from '@/components/menu/push-opened-tracker';

interface MenuNoPlanViewProps {
  semanaIso: string
  mondayIso: string
  recetasDisponibles: number | null
  ultimasRecetas: Recipe[]
  favoriteIds: Set<string>
}

/** `/menu` when there is no plan for the current week yet. */
export function MenuNoPlanView({ semanaIso, mondayIso, recetasDisponibles, ultimasRecetas, favoriteIds }: MenuNoPlanViewProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* FRESCO-372: a re-engagement notification click can land here
      (she hasn't generated this week's plan yet) just as easily as the
      has-plan branch — the tracker runs regardless of plan state. */}
      <PushOpenedTracker />
      {/* FRESCO-297: with no plan for this week, the empty state and its
      "Generar mi menú" CTA are the primary action — they lead, above the
      profile-based value indicators. The CalendarSuggestionBanner
      ("Retoma la organización de tu semana" / "Ver mi plan semanal") is
      deliberately NOT rendered in this branch: it implies a plan already
      exists to resume, which is exactly the contradiction the user hit
      ("estaba dentro sin menú"). It stays in the has-plan view. */}
      <NoMenuEmptyState
        data-testid="menu_empty_state"
        titleAs="h1"
        action={<GenerateWeekButton semanaIso={semanaIso} fechaInicio={mondayIso} redirectTo="/calendar" />}
      />
      {/* FRESCO-57: profile-based count, independent of having a plan. */}
      {/* FRESCO-451 (slice 4/5): gap-8 left each StatTile's top hairline
        reading as a disconnected dash instead of "one unit divided by
        hairlines" (stat-tile.tsx's own intent) — gap-4 keeps them close
        enough to cohere. */}
      <div className="grid grid-cols-2 gap-4">
        {recetasDisponibles !== null && (
          <AvailableRecipesCard count={recetasDisponibles} />
        )}
      </div>
      <LatestRecipesSection recipes={ultimasRecetas} favoriteRecipeIds={favoriteIds} />
    </div>
  );
}
