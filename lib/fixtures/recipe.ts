import type { Recipe } from '@schemas';
import type { ShoppingListPersistido } from '@/lib/api/shopping-list';
import type { DiaSemana, EstadoRecetaSlot, TipoPlato } from '@/lib/api/types';

/**
 * Sample `Recipe` for boneyard's `fixture` prop — rendered ONLY during
 * `npx boneyard-js build` (never in production, per the library's own
 * contract). Values don't need to be real, just the right shape/length so
 * the captured bones match what a real card actually looks like.
 */
export function makeFixtureRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'fixture-recipe',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    nombre: 'Pollo a la plancha con verduras salteadas',
    slug: 'pollo-a-la-plancha-con-verduras-salteadas',
    descripcion_corta: 'Pechuga de pollo a la plancha con un salteado de verduras de temporada.',
    foto_url: null,
    meta: {
      tiempo_prep_min: 10,
      tiempo_coccion_min: 20,
      tiempo_total_min: 30,
      raciones: 2,
      coste_estimado: 'bajo',
      dificultad: 'facil',
    },
    clasificacion: {
      tipo_plato: 'comida',
      categoria: 'carne',
      cocina: 'española',
      es_contundente: true,
      es_ligero: false,
      es_comfort_food: false,
      apto_tupper: true,
      apto_congelar: false,
    },
    dieta: {
      vegetariano: false,
      vegano: false,
      sin_gluten: true,
      sin_lactosa: true,
      sin_huevo: true,
      bajo_fodmap: false,
      keto: false,
      paleo: false,
      halal: true,
      kosher: false,
    },
    alergenos: [],
    ingredientes_principales: ['pollo', 'pimiento', 'calabacín'],
    ingredientes_que_puede_desagradar: [],
    temporada: ['todo_el_año'],
    pasos_resumen: ['Cortar las verduras.', 'Cocinar el pollo a la plancha.', 'Saltear todo junto.'],
    veces_cocinada: 0,
    veces_descartada: 0,
    rating_promedio: null,
    ultima_vez_en_menu: null,
    source: null,
    ...overrides,
  };
}

/** N distinct fixture recipes (distinct `id`/`nombre` — real grids never repeat a title). */
export function makeFixtureRecipes(count: number): Recipe[] {
  return Array.from({ length: count }, (_, i) =>
    makeFixtureRecipe({ id: `fixture-recipe-${i}`, nombre: `Receta de ejemplo ${i + 1}` }));
}

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const SLOTS: TipoPlato[] = ['desayuno', 'comida', 'cena'];

/** A full 7x3 `CalendarGrid` fixture — same shape `getMealPlanForWeek()` returns. */
export function makeFixtureWeekGrid(): {
  menu: Record<DiaSemana, Record<TipoPlato, Recipe | null>>
  slotIds: Record<DiaSemana, Record<TipoPlato, string>>
  estados: Record<DiaSemana, Record<TipoPlato, EstadoRecetaSlot>>
} {
  const menu = {} as Record<DiaSemana, Record<TipoPlato, Recipe | null>>;
  const slotIds = {} as Record<DiaSemana, Record<TipoPlato, string>>;
  const estados = {} as Record<DiaSemana, Record<TipoPlato, EstadoRecetaSlot>>;

  for (const dia of DIAS) {
    menu[dia] = {} as Record<TipoPlato, Recipe | null>;
    slotIds[dia] = {} as Record<TipoPlato, string>;
    estados[dia] = {} as Record<TipoPlato, EstadoRecetaSlot>;

    for (const slot of SLOTS) {
      menu[dia][slot] = makeFixtureRecipe({ id: `fixture-${dia}-${slot}` });
      slotIds[dia][slot] = `fixture-slot-${dia}-${slot}`;
      estados[dia][slot] = 'pendiente';
    }
  }

  return { menu, slotIds, estados };
}

/** A `ShoppingListPersistido` fixture — 3 pasillos, a few items each. */
export function makeFixtureShoppingList(): ShoppingListPersistido {
  return {
    id: 'fixture-shopping-list',
    pasillos: [
      {
        nombre: 'Frutas y verduras',
        orden: 1,
        items: [
          { nombre: 'Calabacín', cantidad: 2, unidad: 'unidad', comprado: false },
          { nombre: 'Pimiento rojo', cantidad: 1, unidad: 'unidad', comprado: true },
          { nombre: 'Cebolla', cantidad: 3, unidad: 'unidad', comprado: false },
        ],
      },
      {
        nombre: 'Carnes y pescados',
        orden: 2,
        items: [
          { nombre: 'Pechuga de pollo', cantidad: 500, unidad: 'g', comprado: false },
          { nombre: 'Merluza', cantidad: 400, unidad: 'g', comprado: false },
        ],
      },
      {
        nombre: 'Despensa',
        orden: 3,
        items: [
          { nombre: 'Arroz', cantidad: 1, unidad: 'kg', comprado: false },
          { nombre: 'Aceite de oliva', cantidad: 1, unidad: 'l', comprado: true },
        ],
      },
    ],
    resumen: {
      total_items: 7,
      coste_estimado_min: 18,
      coste_estimado_max: 26,
      moneda: 'EUR',
    },
  };
}
