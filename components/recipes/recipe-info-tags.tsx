'use client';

import { useState } from 'react';
import { Tag } from '@/components/ui/tag';

export interface RecipeInfoTag {
  label: string
  variant: 'neutral' | 'accent'
}

/**
 * FRESCO-973 (UX-25): the informational tags (cocina + dieta) of a recipe,
 * capped to `maxVisible` with a "+N" toggle. The overflow chip used to be a
 * dead `Tag`, so the hidden tags had no way to be seen; it is now a button
 * that expands the list in place.
 */
export function RecipeInfoTags({ tags, maxVisible }: { tags: RecipeInfoTag[], maxVisible: number }) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = Math.max(0, tags.length - maxVisible);
  const shown = expanded ? tags : tags.slice(0, maxVisible);

  return (
    <>
      {shown.map(({ label, variant }) => (
        <Tag key={label} variant={variant}>{label}</Tag>
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? 'Mostrar menos etiquetas' : `Mostrar ${hiddenCount} etiquetas más`}
          onClick={() => setExpanded(value => !value)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center"
          data-testid="recipe_detail_tags_toggle"
        >
          <Tag variant="neutral">{expanded ? 'Menos' : `+${hiddenCount}`}</Tag>
        </button>
      )}
    </>
  );
}
