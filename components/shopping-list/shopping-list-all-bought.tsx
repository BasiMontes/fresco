import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * FRESCO-842 — what `/shopping-list` shows once nothing is left to buy: the
 * "Compra realizada" ticket was closed and the bought items were removed.
 * Next steps are plain navigation to screens that already exist; no
 * suggested content (ratified out in master-design-plan §5-E).
 *
 * Built from `EmptyState` + `buttonVariants` with no per-screen mockup, as a
 * spec-only divergence ratified in master-design-plan §5-X.
 */
export function ShoppingListAllBought() {
  return (
    <EmptyState
      data-testid="shopping_list_all_bought"
      className="mt-6"
      icon={<CircleCheck className="size-8 text-primary" aria-hidden="true" />}
      title="Has comprado todo lo de esta semana."
      description="Ya puedes volver a tu menú o buscar qué cocinar."
      action={(
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/menu" className={buttonVariants({ variant: 'default', size: 'lg' })}>
            Ver mi menú
          </Link>
          <Link href="/recipes" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
            Ver las recetas
          </Link>
          <Link href="/calendar" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
            Ver el calendario
          </Link>
        </div>
      )}
    />
  );
}
