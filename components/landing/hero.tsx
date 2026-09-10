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
 *
 * FRESCO-459: photos 4-7 added for the marquee (needs more than 4 so each
 * column's loop doesn't repeat too fast) — pulled from `recipes.foto_url`
 * rows already live in the catalogue and manually checked one by one against
 * their dish name before inclusion (same bar as the original four; several
 * other random rows were rejected as a mismatch, e.g. a chicken-biryani photo
 * on a "Pollo al horno" row).
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
  {
    src: 'https://images.unsplash.com/photo-1572448992068-26624d5cf341?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMDE0MTEyfDB8MXxzZWFyY2h8OHx8YnVyZ2VyJTIwYmVlZiUyMGNvb2tlZCUyMG1lYWwlMjBmb29kJTIwcGhvdG9ncmFwaHl8ZW58MHwyfHx8MTc4NjAyNTI3MXww&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Hamburguesa de ternera',
  },
  {
    src: 'https://images.unsplash.com/photo-1782089543715-13daa38402b7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMDE0MTEyfDB8MXxzZWFyY2h8M3x8Z2FybGljJTIwc2hyaW1wJTIwZnJlc2glMjBoZXJicyUyMGxpZ2h0JTIwY29va2VkJTIwbWVhbCUyMGZvb2QlMjBwaG90b2dyYXBoeXxlbnwwfDJ8fHwxNzg1NzAxNTc2fDA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Gambas al ajillo',
  },
  {
    src: 'https://images.unsplash.com/photo-1708782342102-ee13e9ac16f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMDE0MTEyfDB8MXxzZWFyY2h8N3x8YWxib25kaWdhcyUyMGVuJTIwc2Fsc2ElMjBlc3Bhbm9sYSUyMGNvb2tlZCUyMG1lYWwlMjBmb29kJTIwcGhvdG9ncmFwaHl8ZW58MHwyfHx8MTc4NjA4NjI5NHww&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Albóndigas en salsa española',
  },
  {
    src: 'https://images.unsplash.com/photo-1676471755539-d99326272d53?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMDE0MTEyfDB8MXxzZWFyY2h8M3x8dGVuZGVybG9pbiUyMHBvcmslMjBjb29rZWQlMjBtZWFsJTIwZm9vZCUyMHBob3RvZ3JhcGh5fGVufDB8Mnx8fDE3ODU3NjA0MzV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Solomillo de cerdo',
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
        sizes="(max-width: 768px) 45vw, (max-width: 1200px) 22vw, 240px"
        className="object-cover"
        priority={priority}
      />
    </div>
  );
}

/**
 * Editorial, deliberately asymmetric composition of real dish photos —
 * one anchor column slightly wider, the second column dropped down. Calm,
 * not a collage (DESIGN.md "calm over busy").
 *
 * FRESCO-459: each column is a slow vertical marquee (`fresco-hero-marquee-up`
 * / `-down` in globals.css) drifting in opposite directions at ambient speed
 * — approved live by the founder ("me flipa") off a throwaway prototype.
 * Each column's photo list is doubled (`[...photos, ...photos]`) so the
 * `translateY(0 -> -50%)` loop is seamless. The `mask-image` gradient on the
 * outer `overflow-hidden` wrapper fades photos in/out at the top and bottom
 * edge instead of cutting them off flush — the one change the founder asked
 * for over the prototype. `-webkit-mask-image` is required for Safari; both
 * declarations must stay in sync.
 */
const LEFT_COLUMN_PHOTOS = [HERO_PHOTOS[0], HERO_PHOTOS[1], HERO_PHOTOS[2], HERO_PHOTOS[3]];
const RIGHT_COLUMN_PHOTOS = [HERO_PHOTOS[4], HERO_PHOTOS[5], HERO_PHOTOS[6], HERO_PHOTOS[7]];

const EDGE_FADE_MASK = 'linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)';

function HeroMarqueeColumn({
  photos,
  animationClassName,
  widthClassName,
  priority = false,
}: {
  photos: HeroPhoto[]
  animationClassName: string
  widthClassName: string
  priority?: boolean
}) {
  const strip = [...photos, ...photos];

  return (
    <div
      className={`overflow-hidden ${widthClassName}`}
      style={{ maskImage: EDGE_FADE_MASK, WebkitMaskImage: EDGE_FADE_MASK }}
    >
      <div className={`flex flex-col gap-3 md:gap-4 ${animationClassName}`}>
        {strip.map((photo, i) => (
          <HeroPhotoFrame key={i} photo={photo} priority={priority && i === 0} className="aspect-[4/5] shrink-0" />
        ))}
      </div>
    </div>
  );
}

function HeroPhotoComposition() {
  return (
    <div className="mt-8 flex h-[520px] gap-3 md:mt-0 md:gap-4">
      {/* Anchor column. The top tile is the composition's likely LCP element
          (the hero h1 aside) — only it is eager; the rest lazy-load. */}
      <HeroMarqueeColumn
        photos={LEFT_COLUMN_PHOTOS}
        animationClassName="hero-marquee-col-a"
        widthClassName="w-1/2 md:w-[54%]"
        priority
      />
      <HeroMarqueeColumn
        photos={RIGHT_COLUMN_PHOTOS}
        animationClassName="hero-marquee-col-b"
        widthClassName="w-1/2 md:w-[46%] md:pt-12"
      />
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
            <p className="text-body-sm text-tertiary">
              <strong className="block text-body-sm font-bold text-text">Menos tiempo decidiendo</strong>
              qué cocinar cada semana
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-100 text-primary">
              <Leaf className="size-4" strokeWidth={2} />
            </span>
            <p className="text-body-sm text-tertiary">
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
