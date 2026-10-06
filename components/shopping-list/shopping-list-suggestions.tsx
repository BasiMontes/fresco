import type { ShoppingListSuggestion } from '@/lib/api/types';
import { Lightbulb, Plus } from 'lucide-react';
import { HorizontalScrollRow } from '@/components/menu/horizontal-scroll-row';
import { getPasilloIcon } from '@/components/shopping-list/pasillo-icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { capitalize, formatPrecio } from '@/lib/utils';

interface ShoppingListSuggestionsProps {
  suggestions: ShoppingListSuggestion[]
  onAdd: (suggestion: ShoppingListSuggestion) => void
}

/**
 * FRESCO-194 — "Sugerencias para ti" carousel, real data only: ingredients
 * from the caller's own favorited recipes not already in this list
 * (`get-shopping-list-suggestions` Edge Function — favorites is the only real
 * signal for a suggestion). "+ Añadir" uses the same
 * optimistic-update-with-revert pattern as the checkbox toggle, via the
 * `jsonb_add_item` RPC.
 */
export function ShoppingListSuggestions({ suggestions, onAdd }: ShoppingListSuggestionsProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="mt-6" data-testid="shopping_list_suggestions_section">
      <h3 className="flex items-center gap-2 text-caption uppercase tracking-wide text-tertiary">
        <Lightbulb className="size-3.5" aria-hidden="true" />
        Sugerencias para ti
      </h3>
      <HorizontalScrollRow className="mt-2">
        {suggestions.map((suggestion) => {
          const SuggestionIcon = getPasilloIcon(suggestion.pasillo);
          return (
            <Card key={suggestion.nombre} className="flex w-40 shrink-0 flex-col justify-between gap-3">
              <div>
                <span className="flex size-10 items-center justify-center rounded-full border border-border">
                  <SuggestionIcon className="size-5 text-tertiary" aria-hidden="true" />
                </span>
                <p className="mt-2 line-clamp-2 text-body-sm font-medium text-text">
                  {capitalize(suggestion.nombre)}
                </p>
                <p className="mt-1 text-caption text-tertiary">{formatPrecio(suggestion.precio_estimado)}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onAdd(suggestion)}
                data-testid={`shopping_list_add_suggestion_${suggestion.nombre}`}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Añadir
              </Button>
            </Card>
          );
        })}
      </HorizontalScrollRow>
    </div>
  );
}
