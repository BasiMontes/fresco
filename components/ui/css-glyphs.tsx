import { cn } from '@/lib/utils';

/**
 * FRESCO-1138: marks drawn with CSS instead of `lucide-react` icons.
 *
 * Anti Web Slop flags "Íconos de Lucide por defecto" (they ship with shadcn and sit on every generated
 * site). The landing shipped 18 Lucide SVGs of 7 kinds; the controls below replace the ones that are
 * plain geometry: a plus, a hamburger, a light/dark dot and (in `checkbox.tsx`) a tick. They are
 * decorative (`aria-hidden`): the accessible name always lives on the button or input that holds them.
 * Colour comes from `currentColor`, so each caller keeps its own text colour and state classes.
 */

/** The "+" of an accordion row; callers rotate it 45 degrees when the row is open. */
export function PlusMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('relative inline-block size-5 shrink-0 text-neutral-500', className)}>
      <span className="absolute inset-x-[3px] top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-current" />
      <span className="absolute inset-y-[3px] left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-current" />
    </span>
  );
}

/** Hamburger that turns into a cross while the menu is open. Only `transform` and `opacity` animate. */
export function MenuMark({ open, className }: { open: boolean, className?: string }) {
  const bar = 'absolute inset-x-[1px] top-1/2 -mt-px h-[2px] rounded-full bg-current transition-[transform,opacity] duration-150';
  return (
    <span aria-hidden="true" className={cn('relative block size-5', className)}>
      <span className={cn(bar, open ? 'rotate-45' : '-translate-y-[6px]')} />
      <span className={cn(bar, open && 'opacity-0')} />
      <span className={cn(bar, open ? '-rotate-45' : 'translate-y-[6px]')} />
    </span>
  );
}

/** Ring for the light theme, filled dot for the dark one. The button's `aria-label` names the choice. */
export function ThemeMark({ kind }: { kind: 'light' | 'dark' }) {
  return (
    <span
      aria-hidden="true"
      className={cn('block size-[18px] rounded-full border-2 border-current', kind === 'dark' && 'bg-current')}
    />
  );
}
