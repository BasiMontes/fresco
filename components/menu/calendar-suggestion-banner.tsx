import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * FRESCO-56 — always-visible top-of-Inicio suggestion pointing at the
 * Calendar. Default `Card` + `border-primary`, the same pattern as this
 * page's `guest_save_menu_banner` — not the `insight` variant, which
 * `components/ui/card.tsx` reserves for a genuine "Fresco learned
 * something" moment, not a decorative CTA. FRESCO-73 — `default` (primary)
 * button, not `secondary`: `default` isn't the `action` variant, so it
 * doesn't conflict with DESIGN.md's one-`action`-per-screen rule (`/menu`'s
 * single `action` CTA stays "Cocinar ya" / the guest save-menu banner).
 */
export function CalendarSuggestionBanner() {
  return (
    <Card data-testid="calendar_suggestion_banner" className="mt-4 border-2 border-primary">
      <CardContent className="flex flex-col items-start gap-3 text-body-sm sm:flex-row sm:items-center sm:justify-between">
        <p>Retoma la organización de tu semana en el Calendario.</p>
        <Link href="/calendar" className={buttonVariants({ variant: 'default' })}>
          Ver mi plan semanal
        </Link>
      </CardContent>
    </Card>
  );
}
