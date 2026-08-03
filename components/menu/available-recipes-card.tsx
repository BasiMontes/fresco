import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

/**
 * FRESCO-56's sibling value-indicator card (EPIC-FRESCO-54's "una foto del
 * valor que Fresco le está dando" framing) — `count` is already the
 * food-safety-filtered number from `getAvailableRecipesCount()`
 * (`get_filtered_recipes()`, FRESCO-9/ADR-0001), never the raw catalog size.
 * The whole card is the tap target (a `Link`, not a nested button), per the
 * story's AC: tapping it opens `/recipes`.
 */
export function AvailableRecipesCard({ count }: { count: number }) {
  return (
    <Link href="/recipes" data-testid="available_recipes_card" className="block">
      <Card className="mt-4 flex items-center gap-3">
        <CardContent className="flex items-center gap-3">
          <BookOpen className="size-6 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-h2">{count}</p>
            <p className="text-body-sm text-tertiary">recetas disponibles para ti</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
