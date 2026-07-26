import type { DiaSemana, Recipe, TipoPlato } from '@/lib/api/types';

/**
 * Mock data typed against `Recipe` (lib/api/types.ts) so every page built
 * against it stays type-safe once the real Edge Functions come online — per
 * frontend-setup.md Fase 5's "USA tipos del backend para mock data" rule.
 * NOT real data: swap for a live `generateMealPlan()` response once the
 * backend agent's Edge Functions are deployed.
 */
export const MOCK_RECIPES: Recipe[] = [
  {
    id: 'r1',
    nombre: 'Lentejas estofadas con verduras',
    slug: 'lentejas-estofadas-con-verduras',
    tipo: 'comida',
    categoria: 'Legumbres',
    cocina: 'Española',
    minutos: 45,
    coste_bucket: 'económico',
    temporada: ['otoño', 'invierno'],
    apto_tupper: true,
    dieta: ['vegetariano', 'sin_gluten'],
    alergenos: [],
    ingredientes_principales: ['lentejas', 'zanahoria', 'cebolla', 'pimiento'],
    ingredientes_que_puede_desagradar: [],
    descripcion_corta: 'Un clásico de cuchara, listo en una sola olla.',
    pasos_resumen: ['Sofreír verduras', 'Añadir lentejas y caldo', 'Cocer 30 min'],
    veces_cocinada: 3,
    veces_descartada: 0,
    rating_promedio: 4.6,
    ultima_vez_en_menu: '2026-07-14',
  },
  {
    id: 'r2',
    nombre: 'Tortilla de patatas',
    slug: 'tortilla-de-patatas',
    tipo: 'cena',
    categoria: 'Huevos',
    cocina: 'Española',
    minutos: 35,
    coste_bucket: 'económico',
    temporada: ['todo el año'],
    apto_tupper: true,
    dieta: ['vegetariano', 'sin_gluten'],
    alergenos: ['huevo'],
    ingredientes_principales: ['patata', 'huevo', 'cebolla'],
    ingredientes_que_puede_desagradar: ['cebolla'],
    descripcion_corta: 'La tortilla de toda la vida, jugosa por dentro.',
    pasos_resumen: ['Freír patata y cebolla', 'Batir huevos', 'Cuajar la tortilla'],
    veces_cocinada: 5,
    veces_descartada: 0,
    rating_promedio: 4.9,
    ultima_vez_en_menu: '2026-07-10',
  },
  {
    id: 'r3',
    nombre: 'Curry de garbanzos',
    slug: 'curry-de-garbanzos',
    tipo: 'cena',
    categoria: 'Legumbres',
    cocina: 'India',
    minutos: 30,
    coste_bucket: 'económico',
    temporada: ['todo el año'],
    apto_tupper: true,
    dieta: ['vegano', 'sin_gluten', 'sin_lactosa'],
    alergenos: [],
    ingredientes_principales: ['garbanzos', 'tomate', 'leche de coco', 'curry'],
    ingredientes_que_puede_desagradar: ['picante'],
    descripcion_corta: 'Cremoso, especiado, y listo en media hora.',
    pasos_resumen: ['Sofreír especias', 'Añadir tomate y coco', 'Incorporar garbanzos'],
    veces_cocinada: 1,
    veces_descartada: 1,
    rating_promedio: 3.8,
    ultima_vez_en_menu: '2026-07-07',
  },
  {
    id: 'r4',
    nombre: 'Poke bowl de salmón',
    slug: 'poke-bowl-de-salmon',
    tipo: 'comida',
    categoria: 'Pescado',
    cocina: 'Asiática',
    minutos: 25,
    coste_bucket: 'medio',
    temporada: ['primavera', 'verano'],
    apto_tupper: true,
    dieta: ['sin_gluten', 'sin_lactosa'],
    alergenos: ['pescado', 'soja'],
    ingredientes_principales: ['salmón', 'arroz', 'aguacate', 'edamame'],
    ingredientes_que_puede_desagradar: [],
    descripcion_corta: 'Fresco y ligero, ideal para los días de más calor.',
    pasos_resumen: ['Cocer el arroz', 'Cortar el salmón', 'Montar el bowl'],
    veces_cocinada: 2,
    veces_descartada: 0,
    rating_promedio: 4.4,
    ultima_vez_en_menu: null,
  },
  {
    id: 'r5',
    nombre: 'Porridge de avena con fruta',
    slug: 'porridge-de-avena-con-fruta',
    tipo: 'desayuno',
    categoria: 'Cereales',
    cocina: 'Mediterránea',
    minutos: 10,
    coste_bucket: 'económico',
    temporada: ['todo el año'],
    apto_tupper: false,
    dieta: ['vegetariano'],
    alergenos: ['gluten', 'lactosa'],
    ingredientes_principales: ['avena', 'leche', 'plátano', 'canela'],
    ingredientes_que_puede_desagradar: [],
    descripcion_corta: 'Un desayuno rápido y reconfortante.',
    pasos_resumen: ['Cocer la avena con leche', 'Añadir fruta y canela'],
    veces_cocinada: 6,
    veces_descartada: 0,
    rating_promedio: 4.7,
    ultima_vez_en_menu: '2026-07-15',
  },
] as const;

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const SLOTS: TipoPlato[] = ['desayuno', 'comida', 'cena'];

/** Builds a full 7x3 mock weekly menu by cycling through MOCK_RECIPES. */
export function buildMockWeeklyMenu(): Record<DiaSemana, Record<TipoPlato, Recipe>> {
  let cursor = 0;
  const menu = {} as Record<DiaSemana, Record<TipoPlato, Recipe>>;
  for (const dia of DIAS) {
    menu[dia] = {} as Record<TipoPlato, Recipe>;
    for (const slot of SLOTS) {
      menu[dia][slot] = MOCK_RECIPES[cursor % MOCK_RECIPES.length];
      cursor += 1;
    }
  }
  return menu;
}
