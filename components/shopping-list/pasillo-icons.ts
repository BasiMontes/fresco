import type { LucideIcon } from 'lucide-react';
import {
  Beef,
  Carrot,
  ChefHat,
  CupSoda,
  Droplet,
  Egg,
  Fish,
  Package,
  Sandwich,
  Utensils,
  Wheat,
} from 'lucide-react';

/**
 * FRESCO-191 — `pasillo.nombre` comes from the Edge Function's fixed-aisle
 * prompt (`types.ts`'s own comment: "exact aisle name, from the fixed
 * 13-aisle vocabulary"), not enumerated anywhere in this repo. Built from
 * the 10 aisle names actually observed in persisted data (sampled live via
 * SQL) rather than guessing the full 13 — an unmapped aisle still renders
 * fine via the `ChefHat` fallback, same graceful-degradation pattern as
 * `lib/recipes/category-icon.tsx`.
 */
const PASILLO_ICONS: Record<string, LucideIcon> = {
  'Frutas y verduras': Carrot,
  'Carnes y aves': Beef,
  'Pescados y mariscos': Fish,
  'Charcutería y embutidos': Sandwich,
  'Lácteos y huevos': Egg,
  'Pan y bollería': Wheat,
  'Pasta/arroz/legumbres': Utensils,
  'Conservas y salsas': Package,
  'Aceites/vinagres/condimentos': Droplet,
  'Bebidas': CupSoda,
};

export function getPasilloIcon(nombre: string): LucideIcon {
  return PASILLO_ICONS[nombre] ?? ChefHat;
}
