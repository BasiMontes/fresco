import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const FREE_FEATURES = ['1 menú semanal', 'Lista de la compra', 'Filtros de dieta y alergias'];

const PRO_FEATURES = [
  'Menús ilimitados',
  'Aprendizaje real de tus gustos',
  'Sin repetir lo de semanas anteriores',
  'Historial de menús',
  'Personalización avanzada',
];

function PlanFeature({ label, highlighted }: { label: string, highlighted?: boolean }) {
  return (
    <div className="flex items-start gap-2 text-body-sm text-text">
      <span
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-caption font-bold',
          highlighted ? 'bg-accent-100 text-primary' : 'bg-neutral-200 text-tertiary',
        )}
      >
        ✓
      </span>
      {label}
    </div>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className="bg-primary">
      <div className="mx-auto max-w-5xl px-4 py-16 md:px-8">
        <p className="mb-4 text-h6 uppercase text-accent-200">Precios</p>
        <h2 className="mb-8 text-h2 text-background">Sin letra pequeña. Sin trampa.</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col rounded-card border border-border bg-surface p-7">
            <p className="text-h6 uppercase text-tertiary">Free</p>
            <p className="mb-1 text-h1 text-text">
              0€
              <span className="text-body-md font-normal text-tertiary">/mes</span>
            </p>
            <p className="mb-5 text-body-sm text-tertiary">Para probar sin compromiso. Sin tarjeta.</p>
            <div className="flex-1 space-y-2.5">
              {FREE_FEATURES.map(label => <PlanFeature key={label} label={label} />)}
            </div>
            <Link href="/onboarding" className={cn(buttonVariants({ size: 'lg' }), 'mt-6')}>
              Empezar gratis
            </Link>
          </div>

          <div className="flex flex-col rounded-card border-2 border-secondary bg-background p-7 shadow-lg">
            <div className="mb-1 flex items-start justify-between">
              <p className="text-h6 uppercase text-primary">Pro</p>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-caption uppercase text-text">
                Popular
              </span>
            </div>
            <p className="mb-1 text-h1 text-primary">
              4,99€
              <span className="text-body-md font-normal text-tertiary">/mes</span>
            </p>
            <p className="mb-5 text-body-sm text-tertiary">
              Fresco aprende de ti. Cada semana mejor que la anterior.
            </p>
            <div className="flex-1 space-y-2.5">
              {PRO_FEATURES.map(label => <PlanFeature key={label} label={label} highlighted />)}
            </div>
            <Link href="/onboarding" className={cn(buttonVariants({ variant: 'action', size: 'lg' }), 'mt-6')}>
              Empezar 7 días gratis →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
