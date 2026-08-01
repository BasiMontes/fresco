import type { CategoriaReceta } from '@schemas';
import type { LucideIcon } from 'lucide-react';
import {
  Beef,
  Carrot,
  ChefHat,
  Egg,
  Fish,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  Utensils,
  UtensilsCrossed,
  Wheat,
} from 'lucide-react';

/**
 * `categoria` -> icon, the placeholder treatment for the "no photography in
 * the MVP" decision (`mvp-scope.md`'s Deferred-to-P1 list, `RecipeCard`'s own
 * doc comment) — an icon is not a photo, so this stays inside that scope
 * while giving the washed placeholder box real information instead of a
 * flat gray rectangle. Real per-recipe photography remains P1, unaffected.
 */
const CATEGORY_ICONS: Record<CategoriaReceta, LucideIcon> = {
  pasta: Wheat,
  arroz: Utensils,
  legumbres: UtensilsCrossed,
  carne: Beef,
  pescado: Fish,
  verdura: Carrot,
  huevos: Egg,
  sopa: Soup,
  ensalada: Salad,
  sandwich: Sandwich,
  pizza: Pizza,
  guiso: ChefHat,
};

/** Falls back to the generic `ChefHat` mark for a `null`/unrecognized categoria. */
export function getCategoryIcon(categoria: CategoriaReceta | null | undefined): LucideIcon {
  if (!categoria) { return ChefHat; }
  return CATEGORY_ICONS[categoria] ?? ChefHat;
}
