import { ArrowLeft, Bell } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * FRESCO-72 — mockup showed "Productos por caducar" (pantry-expiration
 * alerts), but Fresco has no pantry/expiration-tracking feature to source
 * that from (confirmed with the user before building — real notification
 * types are still to be defined, tracked as future work, not invented here).
 * Always renders the empty state — no notification-generating system exists
 * anywhere in the app yet. Wire real notification types/data once that
 * scope is defined.
 */
export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/menu" className={buttonVariants({ variant: 'icon', size: 'sm' })} aria-label="Volver" data-testid="notifications_back_link">
          <ArrowLeft className="size-[22px]" />
        </Link>
        <div>
          <h1 className="text-h2">Centro de Avisos</h1>
          <p className="text-body-sm uppercase text-tertiary">Tus notificaciones</p>
        </div>
      </div>

      <EmptyState
        className="mt-6"
        data-testid="notifications_empty_state"
        icon={<Bell className="size-8 text-tertiary" aria-hidden="true" />}
        title="Sin notificaciones"
        description="Te avisaremos aquí cuando haya algo nuevo."
      />
    </div>
  );
}
