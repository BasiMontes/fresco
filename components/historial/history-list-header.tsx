import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Header of the past-weeks list on `/historial` (FRESCO-854). The list had no
 * way back: someone arriving from `/calendar` could only use the sidebar or the
 * browser's button, while the single-week view already had the icon-only
 * circular back button (FRESCO-451). Same affordance here, pointing at the
 * calendar, which is where this list is entered from.
 */
export function HistoryListHeader() {
  return (
    <>
      <div className="flex items-center gap-3">
        <Link
          href="/calendar"
          data-testid="historial_list_back_link"
          aria-label="Volver al calendario"
          className={cn(buttonVariants({ variant: 'icon', size: 'sm' }), 'shrink-0')}
        >
          <ArrowLeft className="size-6" aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-h2">Histórico de menús</h1>
          <p className="text-h6 uppercase text-tertiary">Semanas anteriores</p>
        </div>
      </div>
      <p className="mt-1 text-body-md text-tertiary">
        Tus menús de semanas anteriores, con lo que marcaste como cocinado o descartado.
      </p>
    </>
  );
}
