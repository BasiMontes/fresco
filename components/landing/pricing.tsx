import type { ProPrices } from '@/lib/billing/pro-prices';
import { buttonVariants } from '@/components/ui/button';
import { formatEuros, yearlySavingsEuros } from '@/lib/billing/pro-prices';
import { cn } from '@/lib/utils';
import { LandingCtaLink } from './landing-cta-link';

// FRESCO-368 (A4-H11): honest pricing. Only the four `isPro` gates in
// supabase/functions/generate-meal-plan/index.ts are real Pro differences —
// no menu-count limit exists on either tier (5 generations/hour for both,
// one plan per ISO week), and there is no "history" feature. Free keeps
// everything except the learning loop.
export const FREE_FEATURES = [
  'Menú semanal completo',
  'Lista de la compra automática',
  'Filtros de dieta y alergias',
  'Cambia cualquier receta y regenera el slot',
];

// FRESCO-737 (A5-H7, honest pricing follow-up of FRESCO-368): removed
// "Te recuerda marcar lo que cocinaste" — no such reminder exists anywhere in
// the app (the only proactive push is send-weekly-reengagement-push's "¿ya
// planificaste esta semana?", about planning, not about marking cooked
// recipes). The learning claim it duplicated is already covered truthfully
// by the first bullet below.
export const PRO_FEATURES = [
  'Aprende de lo que cocinas y lo que descartas',
  'No repite las recetas que cocinaste o descartaste hace poco',
  'Te explica por qué eligió cada receta',
];

// FRESCO-1134: hairline rows instead of a ✓ circle per feature (Anti Web Slop counts tick lists).
function PlanFeature({ label }: { label: string }) {
  return (
    <li className="border-t border-border py-3 text-body-md text-text last:border-b">
      {label}
    </li>
  );
}

// FRESCO-871: the amounts come from Stripe (`getProPrices`); this is what the
// section says when they cannot be read, i.e. the page as it was before the annual plan.
const FALLBACK_PRICES: ProPrices = { month: 4.99, year: null, taxIncluded: false };

export function Pricing({ prices }: { prices: ProPrices | null }) {
  const { month, year, taxIncluded } = prices ?? FALLBACK_PRICES;
  const savings = prices ? yearlySavingsEuros(prices) : null;

  return (
    <section id="pricing" className="bg-primary">
      <div className="mx-auto max-w-5xl px-4 py-16 md:px-8 md:py-24">
        <h2 className="mb-12 text-h2 text-background">Sin letra pequeña. Sin trampa.</h2>
        {/* FRESCO-1134: the Pro plan is the wide column (5fr / 7fr), not a second equal tower. */}
        <div className="grid gap-4 min-[900px]:grid-cols-[5fr_7fr]">
          <div className="flex flex-col rounded-card border border-border bg-surface-raised p-7">
            <div className="mb-1 flex min-h-6 items-center">
              <p className="text-h6 uppercase text-tertiary">Free</p>
            </div>
            <p className="mb-1 text-h1 text-text">
              0€
              <span className="text-body-md font-normal text-tertiary">/mes</span>
            </p>
            <p className="mb-5 text-body-sm text-tertiary">Para probar sin compromiso. Sin tarjeta.</p>
            <ul className="flex-1">
              {FREE_FEATURES.map(label => <PlanFeature key={label} label={label} />)}
            </ul>
            <LandingCtaLink location="pricing_free" className={cn(buttonVariants({ size: 'lg' }), 'mt-6')}>
              Empezar gratis
            </LandingCtaLink>
          </div>

          <div className="flex flex-col rounded-card border-2 border-secondary bg-background p-7 shadow-lg">
            <div className="mb-1 flex min-h-6 items-center gap-2">
              <p className="text-h6 uppercase text-primary">Pro</p>
              {/* FRESCO-481: near-black on amber (~6,3:1), not `text-text` —
                  cream on amber measured 2,18:1 in dark. Same pairing the
                  `button-action` CTA uses on this same fill. */}
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-caption uppercase text-on-warning">
                Más elegido
              </span>
            </div>
            <p className="mb-1 text-h1 text-primary">
              {formatEuros(month)}
              <span className="text-body-md font-normal text-tertiary">/mes</span>
            </p>
            {/* FRESCO-1004: only when Stripe declares the prices tax-inclusive; the fallback copy never claims it. */}
            {taxIncluded && (
              <p className="mb-1 text-body-sm text-tertiary" data-testid="landing_pro_tax_included">IVA incluido</p>
            )}
            {year !== null && (
              <p className="mb-1 text-body-sm text-text" data-testid="landing_pro_annual_price">
                {`o ${formatEuros(year)}/año`}
                {savings !== null && ` · ahorras ${formatEuros(savings)} al año`}
              </p>
            )}
            <p className="mb-5 text-body-sm text-tertiary">
              Fresco usa lo que marcas para ajustar tus menús semana a semana.
            </p>
            <ul className="flex-1">
              {PRO_FEATURES.map(label => <PlanFeature key={label} label={label} />)}
            </ul>
            <LandingCtaLink location="pricing_pro" className={cn(buttonVariants({ variant: 'action', size: 'lg' }), 'mt-6')}>
              Empezar 7 días gratis
            </LandingCtaLink>
          </div>
        </div>
      </div>
    </section>
  );
}
