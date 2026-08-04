import { ArrowLeft, Heart } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * FRESCO-71 — mockup nav showed Despensa/Lista Compra, which don't exist
 * in this app (confirmed with the user before building); this page uses the
 * app's real 4-item nav via `AppShell`, not the mockup's. Always renders the
 * empty state: no favorites persistence layer exists yet anywhere in the app
 * (FRESCO-77 — no table, no toggle API), so "Lista vacía" is the only
 * accurate state today, not a placeholder. Wire real data here once
 * FRESCO-77 lands.
 */
export default function FavoritesPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/menu" className={buttonVariants({ variant: 'icon', size: 'sm' })} aria-label="Volver" data-testid="favorites_back_link">
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-h2">Tus Favoritos</h1>
          <p className="text-body-sm uppercase text-tertiary">Tu biblioteca seleccionada</p>
        </div>
      </div>

      <EmptyState
        className="mt-6"
        data-testid="favorites_empty_state"
        icon={<Heart className="size-8 text-tertiary" aria-hidden="true" />}
        title="Lista vacía"
        description="Guarda recetas para verlas aquí."
      />
    </div>
  );
}
