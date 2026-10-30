import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';

interface HelpRowProps {
  icon: LucideIcon
  label: string
  testId: string
  /** Optional anchor target, e.g. the sidebar's `/profile#ayuda-configuracion`. */
  id?: string
  onClick: () => void
}

/** One tappable row of the `/profile` help and legal lists (FRESCO-1070). */
export function HelpRow({ icon: Icon, label, testId, id, onClick }: HelpRowProps) {
  return (
    <button
      type="button"
      id={id}
      data-testid={testId}
      onClick={onClick}
      className="flex min-h-11 items-center justify-between gap-2 py-3 text-left text-text first:pt-0 last:pb-0 hover:text-primary"
    >
      <div className="flex items-center gap-2 text-body-md">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </div>
      <ChevronRight className="size-4 text-tertiary" aria-hidden="true" />
    </button>
  );
}
