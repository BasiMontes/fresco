import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';

/**
 * No logo here — `SiteFooter` right below already shows one, a second mark
 * this close reads as a mistake, not emphasis.
 */
export function FinalCta() {
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
        Si te convence, sigue por 4,99€ al mes.
      </p>
      <div className="mx-auto mt-9 flex max-w-sm flex-col gap-3">
        <Link href="/onboarding" className={buttonVariants({ size: 'lg' })}>
          Generar mi primer menú →
        </Link>
        <a href="#como-funciona" className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
          ¿Cómo funciona?
        </a>
      </div>
      <p className="mt-4 text-caption text-tertiary">
        7 días de Pro gratis · Sin tarjeta · Cancela cuando quieras
      </p>
    </section>
  );
}
