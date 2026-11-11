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

const SUN_RAY = 'absolute inset-x-0 top-1/2 -mt-px h-[2px] rounded-full bg-current';

/**
 * A sun (disc and eight rays) for the light theme, a crescent for the dark one. FRESCO-1138 first drew
 * a ring and a dot; the owner did not read them as a theme control (FRESCO-1191), so they are now an
 * actual sun and moon, still without Lucide. The button's `aria-label` names the choice.
 * The rays are four bars crossed at 0, 45, 90 and 135 degrees; the crescent is the inside shadow of a
 * circle, so it needs no background colour to cut it out.
 */
export function ThemeMark({ kind }: { kind: 'light' | 'dark' }) {
  if (kind === 'dark') {
    return (
      <span
        aria-hidden="true"
        data-moon=""
        className="block size-[18px] -rotate-[25deg] rounded-full shadow-[inset_-7px_0_0_0_currentColor]"
      />
    );
  }
  return (
    <span aria-hidden="true" className="relative block size-[18px]">
      <span data-ray="" className={SUN_RAY} />
      <span data-ray="" className={cn(SUN_RAY, 'rotate-45')} />
      <span data-ray="" className={cn(SUN_RAY, 'rotate-90')} />
      <span data-ray="" className={cn(SUN_RAY, '-rotate-45')} />
      <span data-sun-disc="" className="absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
    </span>
  );
}
