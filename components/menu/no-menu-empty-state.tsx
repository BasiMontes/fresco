import type { ReactNode } from 'react';
import { UtensilsCrossed, Zap } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * "No menu generated for this week yet" — shared by `/menu` and `/calendar`
 * (STORY-FRESCO-7) so a future copy/CTA change can't be applied to one page
 * and silently missed on the other.
 *
 * `action` (FRESCO-63) lets a caller override the default "Generar mi menú"
 * → `/onboarding` link — `/calendar` passes `GenerateWeekButton` instead,
 * since it can generate directly for whichever week is being viewed without
 * a full onboarding round-trip. Optional so `/menu`'s existing call site is
 * unaffected.
 */
export function NoMenuEmptyState({ 'data-testid': dataTestId, action }: { 'data-testid': string, 'action'?: ReactNode }) {
  return (
    <EmptyState
      data-testid={dataTestId}
      icon={<UtensilsCrossed className="size-8 text-tertiary" aria-hidden="true" />}
      title="Todavía no tienes un menú para esta semana"
      description="Completa tu perfil y genera tu primer menú semanal en unos segundos."
      action={action ?? (
        <Link href="/onboarding" className={buttonVariants({ variant: 'action', size: 'lg' })}>
          <Zap className="size-[18px]" strokeWidth={2} />
          Generar mi menú
        </Link>
      )}
    />
  );
}
