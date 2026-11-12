import type { Database } from '@/lib/supabase/types';

export type TourPlan = Database['public']['Enums']['plan_usuario'];

export interface TourStop {
  id: 'menu' | 'calendar' | 'recipes' | 'list' | 'plan'
  /** The page the stop opens before it lifts its zone. */
  path: string
  /** Value of the `data-tour` attribute that marks the zone to lift on that page. */
  anchor: string
  /** `false`: the zone only exists on desktop, so on a small screen the card is centred over the dimmed page. */
  anchoredOnMobile: boolean
  placement: 'right' | 'below'
  title: string
  body: string
}

const PLAN_BODY_FREE = 'En Free tus marcas se guardan igual, pero no se aplican a tus menús. Con Pro, lo que marcas da forma a los menús que vienen.';
const PLAN_BODY_PAID = 'Con tu plan Pro, lo que marcas como cocinado o descartado da forma a los menús que vienen.';

/**
 * FRESCO-1197: the stops of the first-visit tour, in the order the owner ratified (2026-11-12). Each one
 * opens the page it explains. The last one depends on the plan, so a person who replays the tour from
 * Configuración does not read a sentence that does not apply to them (`.context/design/master-design-plan.md`
 * 4.21).
 */
export function getTourStops(plan: TourPlan): readonly TourStop[] {
  return [
    {
      id: 'menu',
      path: '/menu',
      anchor: 'menu-today',
      anchoredOnMobile: true,
      placement: 'below',
      title: 'Tu menú de hoy',
      body: 'Aquí ves qué toca desayunar, comer y cenar hoy. Cada plato ya respeta tus alergias y tus preferencias.',
    },
    {
      id: 'calendar',
      path: '/calendar',
      anchor: 'calendar-grid',
      anchoredOnMobile: true,
      placement: 'below',
      title: 'Calendario: la semana entera',
      body: 'Cada día tiene tres franjas: desayuno, comida y cena. Marca un plato como cocinado o descartado, y cámbialo por otro cuando no te apetezca.',
    },
    {
      id: 'recipes',
      path: '/recipes',
      anchor: 'recipes-library',
      anchoredOnMobile: true,
      placement: 'below',
      title: 'Recetas',
      body: 'Explora las recetas que encajan contigo. Abre una para ver cómo se hace.',
    },
    {
      id: 'list',
      path: '/shopping-list',
      anchor: 'shopping-list',
      anchoredOnMobile: true,
      placement: 'below',
      title: 'Lista de la compra',
      body: 'Con el menú de la semana, la lista se arma sola. Puedes copiarla o descargarla.',
    },
    {
      id: 'plan',
      path: '/profile',
      anchor: 'account-plan',
      anchoredOnMobile: false,
      placement: 'right',
      title: 'Qué aporta Pro',
      body: plan === 'free' ? PLAN_BODY_FREE : PLAN_BODY_PAID,
    },
  ];
}
