import { BookOpen } from 'lucide-react';
import { StatTile } from '@/components/menu/stat-tile';

/**
 * FRESCO-56's sibling value-indicator tile (EPIC-FRESCO-54's "una foto del
 * valor que Fresco le está dando" framing) — `count` is already the
 * food-safety-filtered number from `getAvailableRecipesCount()`
 * (`get_filtered_recipes()`, FRESCO-9/ADR-0001), never the raw catalog size.
 * The whole tile is the tap target (a `Link`, not a nested button), per the
 * story's AC: tapping it opens `/recipes`. FRESCO-444 — a top-hairline
 * `StatTile`, not a filled `Card`.
 */
export function AvailableRecipesCard({ count }: { count: number }) {
  return (
    <StatTile
      icon={BookOpen}
      value={count}
      label="recetas disponibles"
      href="/recipes"
      data-testid="available_recipes_card"
    />
  );
}
