import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const WEEK_DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
const ACTIVE_DAY_INDEX = 1;

const MEALS = [
  { emoji: '🥣', type: 'Desayuno', name: 'Tostadas con tomate y aceite', time: '5 min', done: true },
  { emoji: '🍲', type: 'Comida', name: 'Lentejas estofadas con verduras', time: '40 min', done: false },
  { emoji: '🥗', type: 'Cena', name: 'Ensalada de pollo con aguacate', time: '15 min', done: false },
] as const;

const SHOPPING_LIST = [
  { label: 'Lentejas pardinas · 400g', struck: true },
  { label: 'Cebolla · 2 unidades', struck: true },
  { label: 'Pechuga de pollo · 500g', struck: false },
  { label: 'Aguacate · 2 unidades', struck: false },
] as const;

function WeeklyMenuPreview() {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-lg">
      <div className="bg-primary px-4 pb-4 pt-4">
        <p className="text-caption text-accent-200">Tu semana</p>
        <p className="text-label text-background">Semana del 20 al 26 enero</p>
        <div className="mt-3 grid grid-cols-7 gap-1">
          {WEEK_DAYS.map((day, index) => (
            <div
              key={day}
              className={cn(
                'rounded-sm py-1 text-center',
                index === ACTIVE_DAY_INDEX ? 'bg-secondary' : 'bg-accent-600',
              )}
            >
              <p className={cn('text-caption', index === ACTIVE_DAY_INDEX ? 'text-background' : 'text-accent-200')}>
                {day}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 bg-background px-4 py-3">
        <div className="flex items-center justify-between text-label text-text">
          Martes
          <span className="text-caption text-neutral-500">21 ene</span>
        </div>
        {MEALS.map(meal => (
          <div key={meal.type} className="flex items-center gap-2 border-b border-border py-2 last:border-none">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface text-base">
              {meal.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-caption uppercase text-neutral-500">{meal.type}</p>
              <p className="truncate text-body-sm font-medium text-text">{meal.name}</p>
              <p className="text-caption text-neutral-500">
                ⏱
                {meal.time}
              </p>
            </div>
            <span
              className={cn(
                'grid size-5 shrink-0 place-items-center rounded-full border border-border text-caption',
                meal.done && 'border-primary bg-accent-100 font-bold text-primary',
              )}
            >
              {meal.done ? '✓' : ''}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-border bg-surface px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-caption uppercase text-tertiary">
          Lista de la compra
          <span className="text-primary normal-case">Ver todo →</span>
        </div>
        {SHOPPING_LIST.map(item => (
          <div key={item.label} className="flex items-center gap-2 py-0.5 text-caption">
            <span className={cn('size-1.5 shrink-0 rounded-full', item.struck ? 'bg-neutral-400' : 'bg-secondary')} />
            <span className={cn(item.struck ? 'text-neutral-500 line-through' : 'text-text')}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 md:grid md:grid-cols-2 md:items-center md:gap-16 md:px-8 md:py-20">
      <div>
        <div className="mb-6 flex items-center gap-2">
          <span className="h-0.5 w-6 rounded-full bg-secondary" />
          <span className="text-h6 uppercase text-secondary">Menú semanal con IA</span>
        </div>

        <h1 className="text-h1 text-primary">
          Deja de improvisar en el
          {' '}
          <span className="text-secondary">súper.</span>
        </h1>

        <p className="mt-4 max-w-md text-body-md text-tertiary">
          Cada semana la misma historia:
          {' '}
          <strong className="font-semibold text-text">
            no sabes qué cocinar, compras de más y acabas tirando comida.
          </strong>
          {' '}
          Fresco te da el menú del lunes al domingo en 30 segundos. Con la lista ya hecha.
        </p>

        <div className="mt-8 flex max-w-sm flex-col gap-3">
          <Link href="/onboarding" className={buttonVariants({ size: 'lg' })}>
            Generar mi primer menú →
          </Link>
          <a href="#como-funciona" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
            ¿Cómo funciona? Ver demo
          </a>
        </div>

        <div className="mt-7 flex items-center gap-3 border-t border-border pt-7">
          <div className="flex">
            {['L', 'M', 'S', 'A'].map(initial => (
              <span
                key={initial}
                className="-mr-2 grid size-8 place-items-center rounded-full border-2 border-background bg-accent-100 text-caption font-bold text-primary"
              >
                {initial}
              </span>
            ))}
          </div>
          <p className="text-caption text-neutral-500">
            <strong className="block text-body-sm font-bold text-text">+200 familias ya planifican con Fresco</strong>
            30 min ahorrados cada domingo
          </p>
        </div>
      </div>

      <div className="mt-10 md:mt-0">
        <p className="mb-3 text-center text-caption uppercase text-neutral-500 md:hidden">
          Así se ve por dentro
        </p>
        <WeeklyMenuPreview />
      </div>
    </section>
  );
}
