import type { DiaSemana, Recipe, TipoPlato } from '@/lib/api/types';

/**
 * Mock data typed against the real, nested `@schemas` `Recipe` shape (via
 * `lib/api/types.ts`'s re-export) so every page built against it stays
 * type-safe once the real Edge Functions come online — per
 * frontend-setup.md Fase 5's "USA tipos del backend para mock data" rule.
 * NOT real data: still consumed by `/recipes` (mock-only page, out of scope
 * for STORY-FRESCO-7) — `/menu` now reads the real persisted plan instead
 * via `lib/api/meal-plan.ts`.
 *
 * `categoria`/`cocina` values below are best-effort mappings onto the closed
 * `CategoriaReceta`/`TipoCocina` enums where the original flat mock used a
 * free-text label with no exact enum match (e.g. "porridge" isn't one of the
 * comida/cena-oriented `CategoriaReceta` values) — a display-only mock-data
 * judgment call, not a schema change.
 */
export const MOCK_RECIPES: Recipe[] = [
  {
    id: 'r1',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    nombre: 'Lentejas estofadas con verduras',
    slug: 'lentejas-estofadas-con-verduras',
    descripcion_corta: 'Un clásico de cuchara, listo en una sola olla.',
    meta: {
      tiempo_prep_min: 15,
      tiempo_coccion_min: 30,
      tiempo_total_min: 45,
      raciones: 4,
      coste_estimado: 'bajo',
      dificultad: 'facil',
    },
    clasificacion: {
      tipo_plato: 'comida',
      categoria: 'legumbres',
      cocina: 'española',
      es_contundente: true,
      es_ligero: false,
      es_comfort_food: true,
      apto_tupper: true,
      apto_congelar: true,
    },
    dieta: {
      vegetariano: true,
      vegano: false,
      sin_gluten: true,
      sin_lactosa: false,
      sin_huevo: false,
      bajo_fodmap: false,
      keto: false,
      paleo: false,
      halal: true,
      kosher: false,
    },
    alergenos: [],
    ingredientes_principales: ['lentejas', 'zanahoria', 'cebolla', 'pimiento'],
    ingredientes_que_puede_desagradar: [],
    temporada: ['otoño', 'invierno'],
    pasos_resumen: ['Sofreír verduras', 'Añadir lentejas y caldo', 'Cocer 30 min'],
    veces_cocinada: 3,
    veces_descartada: 0,
    rating_promedio: 4.6,
    ultima_vez_en_menu: '2026-07-14',
  },
  {
    id: 'r2',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    nombre: 'Tortilla de patatas',
    slug: 'tortilla-de-patatas',
    descripcion_corta: 'La tortilla de toda la vida, jugosa por dentro.',
    meta: {
      tiempo_prep_min: 15,
      tiempo_coccion_min: 20,
      tiempo_total_min: 35,
      raciones: 4,
      coste_estimado: 'bajo',
      dificultad: 'facil',
    },
    clasificacion: {
      tipo_plato: 'cena',
      categoria: 'huevos',
      cocina: 'española',
      es_contundente: false,
      es_ligero: false,
      es_comfort_food: true,
      apto_tupper: true,
      apto_congelar: false,
    },
    dieta: {
      vegetariano: true,
      vegano: false,
      sin_gluten: true,
      sin_lactosa: false,
      sin_huevo: false,
      bajo_fodmap: false,
      keto: false,
      paleo: false,
      halal: true,
      kosher: false,
    },
    alergenos: ['huevo'],
    ingredientes_principales: ['patata', 'huevo', 'cebolla'],
    ingredientes_que_puede_desagradar: ['cebolla'],
    temporada: ['todo_el_año'],
    pasos_resumen: ['Freír patata y cebolla', 'Batir huevos', 'Cuajar la tortilla'],
    veces_cocinada: 5,
    veces_descartada: 0,
    rating_promedio: 4.9,
    ultima_vez_en_menu: '2026-07-10',
  },
  {
    id: 'r3',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    nombre: 'Curry de garbanzos',
    slug: 'curry-de-garbanzos',
    descripcion_corta: 'Cremoso, especiado, y listo en media hora.',
    meta: {
      tiempo_prep_min: 10,
      tiempo_coccion_min: 20,
      tiempo_total_min: 30,
      raciones: 4,
      coste_estimado: 'bajo',
      dificultad: 'facil',
    },
    clasificacion: {
      tipo_plato: 'cena',
      categoria: 'legumbres',
      cocina: 'asiática', // closest TipoCocina match for the original "India" label
      es_contundente: false,
      es_ligero: true,
      es_comfort_food: true,
      apto_tupper: true,
      apto_congelar: true,
    },
    dieta: {
      vegetariano: true,
      vegano: true,
      sin_gluten: true,
      sin_lactosa: true,
      sin_huevo: true,
      bajo_fodmap: false,
      keto: false,
      paleo: false,
      halal: true,
      kosher: true,
    },
    alergenos: [],
    ingredientes_principales: ['garbanzos', 'tomate', 'leche de coco', 'curry'],
    ingredientes_que_puede_desagradar: ['picante'],
    temporada: ['todo_el_año'],
    pasos_resumen: ['Sofreír especias', 'Añadir tomate y coco', 'Incorporar garbanzos'],
    veces_cocinada: 1,
    veces_descartada: 1,
    rating_promedio: 3.8,
    ultima_vez_en_menu: '2026-07-07',
  },
  {
    id: 'r4',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    nombre: 'Poke bowl de salmón',
    slug: 'poke-bowl-de-salmon',
    descripcion_corta: 'Fresco y ligero, ideal para los días de más calor.',
    meta: {
      tiempo_prep_min: 25,
      tiempo_coccion_min: 0,
      tiempo_total_min: 25,
      raciones: 4,
      coste_estimado: 'medio',
      dificultad: 'facil',
    },
    clasificacion: {
      tipo_plato: 'comida',
      categoria: 'pescado',
      cocina: 'asiática',
      es_contundente: false,
      es_ligero: true,
      es_comfort_food: false,
      apto_tupper: true,
      apto_congelar: false,
    },
    dieta: {
      vegetariano: false,
      vegano: false,
      sin_gluten: true,
      sin_lactosa: true,
      sin_huevo: false,
      bajo_fodmap: false,
      keto: false,
      paleo: false,
      halal: false,
      kosher: false,
    },
    alergenos: ['pescado', 'soja'],
    ingredientes_principales: ['salmón', 'arroz', 'aguacate', 'edamame'],
    ingredientes_que_puede_desagradar: [],
    temporada: ['primavera', 'verano'],
    pasos_resumen: ['Cocer el arroz', 'Cortar el salmón', 'Montar el bowl'],
    veces_cocinada: 2,
    veces_descartada: 0,
    rating_promedio: 4.4,
    ultima_vez_en_menu: null,
  },
  {
    id: 'r5',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    nombre: 'Porridge de avena con fruta',
    slug: 'porridge-de-avena-con-fruta',
    descripcion_corta: 'Un desayuno rápido y reconfortante.',
    meta: {
      tiempo_prep_min: 10,
      tiempo_coccion_min: 0,
      tiempo_total_min: 10,
      raciones: 1,
      coste_estimado: 'bajo',
      dificultad: 'muy_facil',
    },
    clasificacion: {
      tipo_plato: 'desayuno',
      categoria: 'sopa', // closest CategoriaReceta match — the enum has no cereal/porridge value
      cocina: 'mediterránea',
      es_contundente: false,
      es_ligero: true,
      es_comfort_food: true,
      apto_tupper: false,
      apto_congelar: false,
    },
    dieta: {
      vegetariano: true,
      vegano: false,
      sin_gluten: false,
      sin_lactosa: false,
      sin_huevo: true,
      bajo_fodmap: false,
      keto: false,
      paleo: false,
      halal: true,
      kosher: false,
    },
    alergenos: ['gluten', 'lactosa'],
    ingredientes_principales: ['avena', 'leche', 'plátano', 'canela'],
    ingredientes_que_puede_desagradar: [],
    temporada: ['todo_el_año'],
    pasos_resumen: ['Cocer la avena con leche', 'Añadir fruta y canela'],
    veces_cocinada: 6,
    veces_descartada: 0,
    rating_promedio: 4.7,
    ultima_vez_en_menu: '2026-07-15',
  },
];

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
