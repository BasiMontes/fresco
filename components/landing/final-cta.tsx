import type { ProPrices } from '@/lib/billing/pro-prices';
import { buttonVariants } from '@/components/ui/button';
import { formatEuros } from '@/lib/billing/pro-prices';
import { PRO_TRIAL_DAYS } from '@/lib/legal/pro-terms';
import { LandingCtaLink } from './landing-cta-link';
import { WaitlistForm } from './waitlist-form';

/**
 * No logo here — `SiteFooter` right below already shows one, a second mark
 * this close reads as a mistake, not emphasis.
 *
 * FRESCO-1166: the Pro amount comes from Stripe, the same source as the pricing section (`prices`, from
 * `getProPrices`); it used to be typed here and would have drifted with the first price change. When Stripe
 * cannot be read the line states no amount at all instead of an invented one. "Sin tarjeta" is true only of
 * the FIRST trial (the checkout asks a card of whoever already used it), so the footer says so.
 */
export function FinalCta({ prices }: { prices: ProPrices | null }) {
  return (
    <section className="border-t border-border bg-surface px-4 py-20 text-center md:px-8">
      {/* FRESCO-315: the space before <br /> is load-bearing — without it
          textContent collapses to "domingosin agobios." for screen readers
          and text search. */}
      <h2 className="text-h1 text-text">
        El próximo domingo
        {' '}
        <br />
        sin agobios.
      </h2>
      <p className="mx-auto mt-3 max-w-md text-body-md text-tertiary">
        Empieza gratis ahora mismo.
        <br />
        {prices ? `Si te convence, sigue por ${formatEuros(prices.month)} al mes.` : 'Si te convence, el precio de Pro lo ves antes de pagar.'}
      </p>
      <div className="mx-auto mt-9 flex max-w-sm flex-col gap-3">
        <LandingCtaLink location="final_cta" className={buttonVariants({ size: 'lg' })}>
          Generar mi primer menú
        </LandingCtaLink>
        <a href="#como-funciona" className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
          ¿Cómo funciona?
        </a>
      </div>
      {/* FRESCO-478: text-body-sm (13px) — AC bans reading text below 12px. */}
      <p className="mt-4 text-body-sm text-tertiary">
        {`${PRO_TRIAL_DAYS} días de Pro gratis · Sin tarjeta la primera vez · Cancela cuando quieras`}
      </p>
      <WaitlistForm />
    </section>
  );
}
