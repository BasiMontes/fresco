import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';
import type { DiaSemana, TipoPlato } from '@/lib/api/types';
import { firstActiveDietaLabel } from '@/lib/recipes/labels';
import { cn } from '@/lib/utils';

const DIA_LABELS: Record<DiaSemana, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};
const DIAS = Object.keys(DIA_LABELS) as DiaSemana[];

const TIPO_LABELS: Record<TipoPlato, string> = {
  desayuno: 'Desayuno',
  comida: 'Almuerzo',
  cena: 'Cena',
};
const TIPOS = Object.keys(TIPO_LABELS) as TipoPlato[];

/**
 * FRESCO-425 — read-only rendering of a past week's 21-slot menu for the
 * "Histórico de menús" detail view. Deliberately NOT `CalendarGrid`: that is
 * a `'use client'` dnd-kit island with drag/swap/estado-toggle wiring this
 * view has no use for. A plain server component: one day per row, three meal
 * cells across. A `null` slot (the model reported no safe recipe, FR-8.2)
 * renders as "Sin receta", never a blank cell.
 *
 * The per-slot `estado` from the source week is shown as a subtle marker
 * (cocinada / descartada) so the week reads as the record it is, matching
 * the balance shown in the list — but nothing here is interactive.
 */
export function MenuReadonlyGrid({ menu, estados }: {
  menu: MenuSemanalPersistido['menu']
  estados: MenuSemanalPersistido['estados']
}) {
  return (
    <div className="overflow-x-auto" data-testid="historial_readonly_grid">
      <table className="w-full min-w-[44rem] table-fixed border-collapse">
        <thead>
          <tr>
            <th scope="col" className="w-20 pb-2 pr-3 text-left text-h6 uppercase text-tertiary">Día</th>
            {TIPOS.map(tipo => (
              <th key={tipo} scope="col" className="pb-2 pr-3 text-left text-h6 uppercase text-tertiary">
                {TIPO_LABELS[tipo]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DIAS.map(dia => (
            <tr key={dia} className="border-t border-border align-top">
              <th scope="row" className="py-3 pr-3 text-left text-label font-sans text-text">
                {DIA_LABELS[dia]}
              </th>
              {TIPOS.map((tipo) => {
                const recipe = menu[dia]?.[tipo] ?? null;
                const estado = estados[dia]?.[tipo];
                const dietaLabel = recipe ? firstActiveDietaLabel(recipe.dieta) : null;

                return (
                  <td key={tipo} className="py-3 pr-3">
                    {recipe
                      ? (
                          <div className="flex flex-col gap-1">
                            <span
                              className={cn(
                                'text-body-sm font-sans text-text',
                                estado === 'descartada' && 'text-tertiary line-through',
                              )}
                            >
                              {recipe.nombre}
                            </span>
                            <span className="flex flex-wrap items-center gap-x-2 text-caption text-tertiary">
                              {recipe.clasificacion?.categoria && <span>{recipe.clasificacion.categoria}</span>}
                              {dietaLabel && <span>{dietaLabel}</span>}
                              {estado === 'cocinada' && <span className="text-primary">Cocinada</span>}
                              {estado === 'descartada' && <span>Descartada</span>}
                            </span>
                          </div>
                        )
                      : (
                          <span className="text-caption text-tertiary">Sin receta</span>
                        )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
