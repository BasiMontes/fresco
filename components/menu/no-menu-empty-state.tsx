import { UtensilsCrossed, Zap } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * "No menu generated for this week yet" — shared by `/menu` and `/calendar`
 * (STORY-FRESCO-7) so a future copy/CTA change can't be applied to one page
 * and silently missed on the other.
 */
export function NoMenuEmptyState({ 'data-testid': dataTestId }: { 'data-testid': string }) {
  return (
    <EmptyState
      data-testid={dataTestId}
      icon={<UtensilsCrossed className="size-8 text-tertiary" aria-hidden="true" />}
      title="Todavía no tienes un menú para esta semana"
      description="Completa tu perfil y genera tu primer menú semanal en unos segundos."
      action={(
        <Link href="/onboarding" className={buttonVariants({ variant: 'action', size: 'lg' })}>
          <Zap className="size-[18px]" strokeWidth={2} />
          Generar mi menú
        </Link>
      )}
    />
  );
}
