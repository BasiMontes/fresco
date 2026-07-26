import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class names, resolving conflicting utility classes
 * (e.g. `p-2` + `p-4` -> `p-4`) the way `tailwind-merge` intends.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
