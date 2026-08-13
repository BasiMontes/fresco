import Image from 'next/image';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
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
