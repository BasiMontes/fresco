import { TriangleAlert } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Warning-surface primitive for `advertencias` (FR-2.10/FR-8.2, STORY-FRESCO-9).
 * Renders nothing when `advertencias` is empty/undefined, so callers never
 * need to guard before rendering it. Deliberately non-dismissible and
 * always-visible (no toast/auto-hide) — FR-8.2 requires a "prominent,
 * blocking-style warning", never a silently-logged event, since the P0 case
 * is a mandatory food-safety filter (allergen/disliked-ingredient) that could
 * not be honored for a slot.
 *
 * Uses the `warning` design token (`#DF8C26`), which DESIGN.md itself already
 * reserves for "warning-adjacent tags (allergen flags)" — not the `error`
 * token, which DESIGN.md scopes to form/input validation errors.
 *
 * Scope note: this component only renders whatever `advertencias` it is
 * given — it does not fetch or own real menu-generation data. Wiring it to
 * the live `/generate-meal-plan` response is FRESCO-7's job (Menu
 * Generation); this is the ready-made contract for that story to drop in,
 * e.g. `<AlertBanner advertencias={mealPlan.advertencias} data-testid="menu_advertencias_banner" />`.
 */
export interface AlertBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  advertencias?: string[]
}

export const AlertBanner = React.forwardRef<HTMLDivElement, AlertBannerProps>(
  ({ advertencias, className, ...props }, ref) => {
    if (!advertencias || advertencias.length === 0) { return null; }

    return (
      <div
        ref={ref}
        role="alert"
        aria-live="assertive"
        className={cn(
          'flex flex-col gap-2 rounded-md border-l-4 border-warning bg-surface p-3 text-text shadow-sm',
          className,
        )}
        {...props}
      >
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-5 shrink-0 text-warning" aria-hidden="true" />
          <span className="text-label font-sans">Antes de continuar</span>
        </div>
        <ul className="flex flex-col gap-1 pl-7 text-body-sm">
          {advertencias.map((advertencia, index) => (
            <li key={index}>{advertencia}</li>
          ))}
        </ul>
      </div>
    );
  },
);
AlertBanner.displayName = 'AlertBanner';
