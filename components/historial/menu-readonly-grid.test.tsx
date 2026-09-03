import type { Recipe } from '@schemas';
import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';
import type { DiaSemana, EstadoRecetaSlot, TipoPlato } from '@/lib/api/types';
import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { MenuReadonlyGrid } from './menu-readonly-grid';

/**
 * FRESCO-425 — read-only week grid. Pins that all 21 slots render, that a
 * `null` slot shows "Sin receta" rather than a blank cell, and that the
 * per-slot estado from the source week surfaces as a marker.
 */

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const TIPOS: TipoPlato[] = ['desayuno', 'comida', 'cena'];

function recipe(nombre: string): Recipe {
  return {
    id: `r-${nombre}`,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    nombre,
    slug: nombre.toLowerCase(),
    descripcion_corta: null,
    foto_url: null,
    meta: null,
    clasificacion: { tipo_plato: 'comida', categoria: 'legumbres', cocina: 'española', es_contundente: true, es_ligero: false, es_comfort_food: true, apto_tupper: true, apto_congelar: true },
    dieta: null,
    alergenos: null,
    ingredientes_principales: null,
    ingredientes_que_puede_desagradar: null,
    temporada: null,
    pasos_resumen: null,
    veces_cocinada: 0,
    veces_descartada: 0,
    rating_promedio: null,
    ultima_vez_en_menu: null,
  };
}

function buildMenu(): { menu: MenuSemanalPersistido['menu'], estados: MenuSemanalPersistido['estados'] } {
  const menu = {} as MenuSemanalPersistido['menu'];
  const estados = {} as MenuSemanalPersistido['estados'];
  for (const dia of DIAS) {
    menu[dia] = {} as Record<TipoPlato, Recipe | null>;
    estados[dia] = {} as Record<TipoPlato, EstadoRecetaSlot>;
    for (const tipo of TIPOS) {
      menu[dia][tipo] = recipe(`${dia}-${tipo}`);
      estados[dia][tipo] = 'pendiente';
    }
  }
  return { menu, estados };
}

describe('MenuReadonlyGrid', () => {
  test('renders all 21 slots as day rows x meal columns', () => {
    const { menu, estados } = buildMenu();
    renderWithProviders(<MenuReadonlyGrid menu={menu} estados={estados} />);

    for (const dia of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) {
      expect(screen.getByRole('rowheader', { name: dia })).toBeInTheDocument();
    }
    expect(screen.getByText('lunes-desayuno')).toBeInTheDocument();
    expect(screen.getByText('domingo-cena')).toBeInTheDocument();
  });

  test('a null slot shows "Sin receta"', () => {
    const { menu, estados } = buildMenu();
    menu.martes.comida = null;
    renderWithProviders(<MenuReadonlyGrid menu={menu} estados={estados} />);

    expect(screen.getByText('Sin receta')).toBeInTheDocument();
  });

  test('marks a cocinada slot and strikes a descartada one', () => {
    const { menu, estados } = buildMenu();
    estados.lunes.desayuno = 'cocinada';
    estados.lunes.comida = 'descartada';
    renderWithProviders(<MenuReadonlyGrid menu={menu} estados={estados} />);

    expect(screen.getByText('Cocinada')).toBeInTheDocument();
    expect(screen.getByText('Descartada')).toBeInTheDocument();
    expect(screen.getByText('lunes-comida')).toHaveClass('line-through');
  });
});
