import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface HelpRowProps {
  icon: LucideIcon
  label: string
  testId: string
  /** Optional anchor target, e.g. the sidebar's `/profile#ayuda-configuracion`. */
  id?: string
  /** One line under the label, e.g. what is currently saved. */
  description?: string
  /** Navigates to a page (a real link); without it the row is a button that runs `onClick`. */
  href?: string
  onClick?: () => void
}

const ROW_CLASS = 'flex min-h-11 items-center justify-between gap-2 py-3 text-left text-text first:pt-0 last:pb-0 hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary';

/** One tappable row of the `/profile` help and legal lists (FRESCO-1070). */
export function HelpRow({ icon: Icon, label, testId, id, description, href, onClick }: HelpRowProps) {
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-2 text-body-md">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <div>{label}</div>
          {description && <div className="truncate text-body-sm text-tertiary">{description}</div>}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-tertiary" aria-hidden="true" />
    </>
  );

  if (href) {
    return (
      <Link href={href} id={id} data-testid={testId} className={ROW_CLASS}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" id={id} data-testid={testId} onClick={onClick} className={ROW_CLASS}>
      {content}
    </button>
  );
}
