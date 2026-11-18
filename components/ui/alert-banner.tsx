import { CircleAlert } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Warning surface for `advertencias` (FR-2.10/FR-8.2, STORY-FRESCO-9). Specified in DESIGN.md
 * (§Components → "Alert / Aviso", FRESCO-1233): a card-family surface in the allergen amber tint
 * (`accent-2-100` fill, `accent-2-800` text and icon, `accent-2-600` hairline), no side stripe.
 *
 * Behaviour that must not change: renders nothing when `advertencias` is empty/undefined, so callers
 * never guard before rendering it; `role="alert"` + `aria-live="assertive"`; deliberately
 * non-dismissible and always visible (no close button, no toast, no auto-hide), because the P0 case is a
 * mandatory food-safety filter (allergen/disliked-ingredient) that could not be honoured for a slot.
 *
 * Colours are ramp role tokens from `app/globals.css`, which already invert for the dark theme, so there is
 * no `dark:` class here. The size classes (`text-h6`, `text-body-md`) sit on elements that carry no colour
 * class of their own: `cn()` does not know the custom `text-*` size tokens and would drop one next to a
 * colour class (see the FRESCO-978 note in `tag.tsx`).
 *
 * Scope note: this component only renders whatever `advertencias` it is given — it does not fetch or own
 * real menu-generation data.
 */
export interface AlertBannerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  advertencias?: string[]
  /** Kicker above the list. Callers pass one that names what the warnings are about. */
  title?: string
}

export const ALERT_BANNER_DEFAULT_TITLE = 'A tener en cuenta';

export const AlertBanner = React.forwardRef<HTMLDivElement, AlertBannerProps>(
  ({ advertencias, title = ALERT_BANNER_DEFAULT_TITLE, className, ...props }, ref) => {
    if (!advertencias || advertencias.length === 0) { return null; }

    return (
      <div
        ref={ref}
        role="alert"
        aria-live="assertive"
        className={cn(
          'rounded-card border border-accent-2-600 bg-accent-2-100 p-4 text-accent-2-800',
          className,
        )}
        {...props}
      >
        <div className="flex items-center gap-2">
          <CircleAlert className="size-5 shrink-0" strokeWidth={2} aria-hidden="true" />
          <p className="text-h6 uppercase">{title}</p>
        </div>
        <ul className="mt-3 text-body-md">
          {advertencias.map(advertencia => (
            <li
              key={advertencia}
              className="border-t border-accent-2-600/30 py-2 first:border-t-0 first:pt-0 last:pb-0"
            >
              {advertencia}
            </li>
          ))}
        </ul>
      </div>
    );
  },
);
AlertBanner.displayName = 'AlertBanner';
