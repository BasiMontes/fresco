import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// FRESCO-894: a 404 inherited the home page's <title>, so a tab or a crawler could not tell a
// broken link from the front page. Same "Page · Fresco" shape as the other routes.
export const metadata: Metadata = {
  title: 'Página no encontrada · Fresco',
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-start px-4 pb-12 pt-16 md:pt-24">
      <Image src="/brand/logo-base.svg" alt="Fresco" width={112} height={34} className="mx-auto mb-8" priority />
      <Card className="text-center">
        <h1 className="text-h3">Página no encontrada</h1>
        <p className="mt-2 text-body-sm text-tertiary">
          El enlace puede estar roto o la página ya no existe.
        </p>
        <div className="mt-6">
          <Link data-testid="not_found_home_link" href="/" className={buttonVariants({ variant: 'secondary' })}>
            Volver al inicio
          </Link>
        </div>
      </Card>
    </div>
  );
}
