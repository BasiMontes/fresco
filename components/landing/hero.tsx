import { Clock, Leaf } from 'lucide-react';
import Image from 'next/image';

import { buttonVariants } from '@/components/ui/button';
import { LandingCtaLink } from './landing-cta-link';

interface HeroPhoto {
  src: string
  alt: string
}

/**
 * FRESCO-445 (epic FRESCO-436). The hero visual is a curated, static set of
 * real dish photos from the recipe catalogue (`recipes.foto_url`, all
 * `images.unsplash.com` — already allow-listed in `next.config.mjs`). It
 * replaced a CSS menu mockup that used 🥣🍲🥗 as product illustration.
 * Hand-picked, not a live query: the landing is the acquisition funnel and
 * must render with zero runtime dependencies, and the catalogue's
 * photo-match rate makes random selection a quality risk (FRESCO-192).
 * Keep the full Unsplash query string on every URL — a truncated `ixid`
 * 404s (FRESCO-192).
 */
const HERO_PHOTOS: HeroPhoto[] = [
  {
    src: 'https://images.unsplash.com/photo-1704642153271-5f241866aaaa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMDE0MTEyfDB8MXxzZWFyY2h8M3x8aHVldm9zJTIwcmFuY2hlcm9zJTIwbWV4aWNhbiUyMGJyZWFrZmFzdCUyMGNvb2tlZCUyMG1lYWwlMjBmb29kJTIwcGhvdG9ncmFwaHl8ZW58MHwyfHx8MTc4NTY5NzU5M3ww&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Huevos rancheros',
  },
  {
    src: 'https://images.unsplash.com/photo-1604909053796-048c8c9801a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMDE0MTEyfDB8MXxzZWFyY2h8MXx8RW5zYWxhZGElMjB0ZW1wbGFkYSUyMGRlJTIwY2hhbXBpbm9uZXMlMjB5JTIwamFtb24lMjBjb29rZWQlMjBtZWFsJTIwZm9vZCUyMHBob3RvZ3JhcGh5fGVufDB8Mnx8fDE3ODU2MjI5MTR8MA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Ensalada templada de champiñones y jamón',
  },
  {
    src: 'https://images.unsplash.com/photo-1540832804691-58c47b913830?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMDE0MTEyfDB8MXxzZWFyY2h8Mnx8dG9hc3QlMjBpbnRlZ3JhbCUyMHRvbWF0ZXMlMjBjaGVycnklMjBjaGVlc2UlMjBmZXRhJTIwY29va2VkJTIwbWVhbCUyMGZvb2QlMjBwaG90b2dyYXBoeXxlbnwwfDJ8fHwxNzg1NzYwNDcxfDA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Tostada integral con tomates cherry y queso feta',
  },
  {
    src: 'https://images.unsplash.com/photo-1778104682662-0cc3a777fad3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMDE0MTEyfDB8MXxzZWFyY2h8NHx8U29wYSUyMGRlJTIwdG9tYXRlJTIweSUyMGFsYmFoYWNhJTIwY29va2VkJTIwbWVhbCUyMGZvb2QlMjBwaG90b2dyYXBoeXxlbnwwfDJ8fHwxNzg1NjIyOTE2fDA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Sopa de tomate y albahaca',
  },
];

/** One photo tile. `fill` + `sizes` so the intrinsic 1080px source scales to the slot. */
function HeroPhotoFrame({
  photo,
  priority = false,
  className,
}: {
  photo: HeroPhoto
  priority?: boolean
  className?: string
}) {
  return (
    <div className={`relative overflow-hidden rounded-image shadow-md ${className ?? ''}`}>
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        sizes="(max-width: 768px) 45vw, 25vw"
        className="object-cover"
        priority={priority}
      />
    </div>
  );
}

/**
 * Editorial, deliberately asymmetric composition of four real dish photos —
 * one anchor column slightly wider, the second column dropped down. Calm,
 * not a collage (DESIGN.md "calm over busy"). Same four images on mobile as
 * a 2×2 grid below the copy.
 */
function HeroPhotoComposition() {
  return (
    <div className="mt-10 flex gap-3 md:mt-0 md:gap-4">
      <div className="flex w-1/2 flex-col gap-3 md:w-[54%] md:gap-4">
        {/* Anchor column. Both tiles sit above the fold — hero is the LCP region (FRESCO-183). */}
        <HeroPhotoFrame photo={HERO_PHOTOS[0]} priority className="aspect-[4/5]" />
        <HeroPhotoFrame photo={HERO_PHOTOS[1]} priority className="aspect-[4/5] md:aspect-[5/4]" />
      </div>
      <div className="flex w-1/2 flex-col gap-3 md:w-[46%] md:gap-4 md:pt-14">
        <HeroPhotoFrame photo={HERO_PHOTOS[2]} priority className="aspect-[4/5]" />
        <HeroPhotoFrame photo={HERO_PHOTOS[3]} className="aspect-[4/5] md:aspect-square" />
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 md:grid md:grid-cols-2 md:items-center md:gap-16 md:px-8 md:py-20">
      <div>
        <div className="mb-6 flex items-center gap-2">
          <span className="h-0.5 w-6 rounded-full bg-accent-2-700" />
          <span className="text-h6 uppercase text-accent-2-700">Tu menú semanal, listo en 30 segundos</span>
        </div>

        <h1 className="text-h1 text-primary">
          Deja de improvisar en el
          {' '}
          <span className="text-accent-2-700">súper.</span>
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
          <LandingCtaLink location="hero" className={buttonVariants({ size: 'lg' })}>
            Generar mi primer menú →
          </LandingCtaLink>
          <a href="#como-funciona" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
            ¿Cómo funciona?
          </a>
        </div>

        <div className="mt-7 flex flex-col gap-3 border-t border-border pt-7 sm:flex-row sm:gap-6">
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-100 text-primary">
              <Clock className="size-4" strokeWidth={2} />
            </span>
            <p className="text-caption text-tertiary">
              <strong className="block text-body-sm font-bold text-text">Menos tiempo decidiendo</strong>
              qué cocinar cada semana
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-100 text-primary">
              <Leaf className="size-4" strokeWidth={2} />
            </span>
            <p className="text-caption text-tertiary">
              <strong className="block text-body-sm font-bold text-text">Menos comida tirada</strong>
              compras justo lo que necesitas
            </p>
          </div>
        </div>
      </div>

      <HeroPhotoComposition />
    </section>
  );
}
