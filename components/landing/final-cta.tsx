import Image from 'next/image';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';

export function FinalCta() {
  return (
    <section className="border-t border-border bg-background px-4 py-20 text-center md:px-8">
      <div className="mb-7 flex justify-center">
        <Image src="/brand/logo-naranja.svg" alt="Fresco" width={140} height={40} />
      </div>
      <h2 className="text-h1 text-text">
        El próximo domingo
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
      <p className="mt-4 text-caption text-neutral-500">
        7 días de Pro gratis · Sin tarjeta · Cancela cuando quieras
      </p>
    </section>
  );
}
