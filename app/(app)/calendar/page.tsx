import type { DiaSemana } from '@/lib/api/types';

import { GripVertical } from 'lucide-react';
import { buildMockWeeklyMenu } from '@/lib/mock/recipes';

/**
 * `/calendar` — EPIC-FRESCO-3 (Editable Calendar, US 3.1/3.2). Full 7x3
 * weekly grid. Structural shell only: drag & drop reordering is deferred to
 * `/sprint-development` story work (needs a real drag library + persisted
 * state), the 6-dot handle icon from DESIGN.md's icon set is shown as a
 * static affordance for now.
 */

const DIA_LABELS: Record<DiaSemana, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

const SLOTS = ['desayuno', 'comida', 'cena'] as const;

export default function CalendarPage() {
  const menu = buildMockWeeklyMenu();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-h2">Calendario semanal</h1>
      <p className="mt-1 text-body-md text-tertiary">Arrastra cualquier plato para reorganizar tu semana.</p>

      <div className="mt-6 overflow-x-auto">
        <div className="grid min-w-[840px] grid-cols-7 gap-3">
          {(Object.keys(DIA_LABELS) as DiaSemana[]).map(dia => (
            <div key={dia} className="flex flex-col gap-3">
              <p className="text-label">{DIA_LABELS[dia]}</p>
              {SLOTS.map((slot) => {
                const recipe = menu[dia][slot];
                return (
                  <div
                    key={slot}
                    className="flex items-start gap-2 rounded-card bg-surface p-3 shadow-sm"
                  >
                    <GripVertical className="mt-0.5 size-4 shrink-0 text-tertiary" />
                    <div>
                      <p className="text-caption uppercase text-tertiary">{slot}</p>
                      <p className="text-body-sm">{recipe.nombre}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
