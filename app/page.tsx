import { CalendarDays, ChefHat, ShoppingBasket, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Guest landing ("/") — EPIC-FRESCO-6 (Guest Mode). Page shell per
 * user-journeys.md Journey 1: a guest opens Fresco and proceeds directly
 * into onboarding with no account required. Copy is drawn from DESIGN.md's
 * Overview (tagline, "Laura, the exhausted planner") and mvp-scope.md's P0
 * epics — not generic placeholder copy.
 */

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Tu menú en menos de 30 segundos',
    description:
      '21 comidas para toda la semana, generadas automáticamente a partir de tu dieta, tus cocinas favoritas y el tamaño de tu hogar.',
  },
  {
    icon: CalendarDays,
    title: 'Calendario editable',
    description:
      'Arrastra y suelta para reorganizar tu semana, o cambia cualquier plato que no te convenza.',
  },
  {
    icon: ShoppingBasket,
    title: 'Lista de la compra por pasillo',
    description: 'Generada automáticamente a partir de tu menú, agrupada para que no vuelvas sobre tus pasos.',
  },
  {
    icon: ChefHat,
    title: 'Aprende de lo que cocinas',
    description:
      'Marca lo que cocinas o descartas y, con Fresco Pro, la próxima semana se ajusta a tu gusto real.',
  },
] as const;

export default function GuestLandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-4 py-6 md:px-8">
        <Image src="/brand/logo-base.svg" alt="Fresco" width={112} height={32} priority />
        <Link href="/signup" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          Ya tengo cuenta
        </Link>
      </header>

      <section className="px-4 py-16 text-center md:px-8 md:py-24">
        <h1 className="mx-auto max-w-3xl text-h1">
          Menús semanales con IA que aprende de lo que realmente cocinas
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-body-md text-tertiary">
          Se acabó el domingo por la tarde preguntándote "¿qué cocino esta semana?". Fresco
          planifica, tú solo cocinas.
        </p>
        <div className="mt-8">
          <Link href="/onboarding" className={buttonVariants({ size: 'lg' })}>
            Empezar gratis
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 px-4 py-8 md:grid-cols-2 md:px-8 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="size-[22px] text-primary" strokeWidth={2} />
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className="text-body-sm text-tertiary">{description}</CardContent>
          </Card>
        ))}
      </section>

      <section className="px-4 py-16 text-center md:px-8">
        <h2 className="text-h2">¿Probamos con tu primera semana?</h2>
        <div className="mt-6">
          <Link href="/onboarding" className={buttonVariants({ variant: 'action', size: 'lg' })}>
            Generar mi menú
          </Link>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-6 text-center text-caption text-tertiary md:px-8">
        Fresco — hecho en España
      </footer>
    </div>
  );
}
