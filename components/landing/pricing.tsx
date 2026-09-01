import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LandingCtaLink } from './landing-cta-link';

// FRESCO-368 (A4-H11): honest pricing. Only the four `isPro` gates in
// supabase/functions/generate-meal-plan/index.ts are real Pro differences —
// no menu-count limit exists on either tier (5 generations/hour for both,
// one plan per ISO week), and there is no "history" feature. Free keeps
// everything except the learning loop.
const FREE_FEATURES = [
  'Menú semanal completo',
  'Lista de la compra automática',
  'Filtros de dieta y alergias',
  'Cambia cualquier receta y regenera el slot',
];

const PRO_FEATURES = [
  'Aprende de lo que cocinas y lo que descartas',
  'No repite las recetas de las últimas semanas',
  'Te explica por qué eligió cada receta',
  'Te recuerda marcar lo que cocinaste',
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
            <LandingCtaLink location="pricing_free" className={cn(buttonVariants({ size: 'lg' }), 'mt-6')}>
              Empezar gratis
            </LandingCtaLink>
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
            <LandingCtaLink location="pricing_pro" className={cn(buttonVariants({ variant: 'action', size: 'lg' }), 'mt-6')}>
              Empezar 7 días gratis →
            </LandingCtaLink>
          </div>
        </div>
      </div>
    </section>
  );
}
