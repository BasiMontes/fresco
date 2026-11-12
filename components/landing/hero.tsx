import Image from 'next/image';

import { buttonVariants } from '@/components/ui/button';
import { LandingCtaLink } from './landing-cta-link';

interface HeroIllustration {
  src: string
}

/**
 * FRESCO-1141 (epic FRESCO-884). The hero visual is a curated, static set of the catalogue's own clay 3D icons
 * (FRESCO-1146), generated with the FRESCO-1132 pipeline and picked by the owner, one by one. They replace the
 * stock photos of FRESCO-445 / FRESCO-459, which Anti Web Slop counted as generic stock imagery. Mockup ratified on
 * 2026-11-12, option A: `.context/designs/fresco/hero-clay/`, spec 4.23 and divergence 5-AD of the master design plan.
 *
 * The files live in `public/landing/hero/` instead of pointing at `recipes.foto_url`: the landing is the acquisition
 * funnel and must render with zero runtime dependencies, and a recipe's photo changes whenever it is regenerated.
 * They are decorative (`alt=""`); the visible caption under the composition carries the meaning, and the FLUX terms
 * forbid presenting the output as real photographs.
 */
const HERO_ILLUSTRATIONS: HeroIllustration[] = [
  { src: '/landing/hero/espaguetis-tomate-albahaca.jpg' },
  { src: '/landing/hero/batido-cacao-platano.jpg' },
  { src: '/landing/hero/ensalada-brocoli-almendras.jpg' },
  { src: '/landing/hero/huevos-poche-esparragos.jpg' },
  { src: '/landing/hero/marmitako-bonito.jpg' },
  { src: '/landing/hero/torrijas-caseras.jpg' },
  { src: '/landing/hero/tacos-pescado-repollo.jpg' },
  { src: '/landing/hero/sandwich-pollo-aguacate.jpg' },
];

/**
 * One illustration tile. `fill` + `sizes` so the intrinsic 640px source scales to
 * the slot. No box, border or shadow (option A of the mockup): the clay carries
 * its own cream background and the soft shadow under the object.
 *
 * FRESCO-504: `priority` is deprecated as of Next.js 16 in favor of `preload`
 * — the compat shim still inserts the `<link rel=preload>` but no longer
 * adds `fetchPriority="high"` to it (confirmed against
 * `node_modules/next/dist/shared/lib/get-img-props.js` and the component
 * docs), so the LCP candidate's preload no longer outranks any other image
 * preload on the page. `fetchPriority="high"` is set explicitly here so the
 * true LCP tile wins the browser's fetch queue.
 */
function HeroIllustrationFrame({
  illustration,
  priority = false,
  className,
}: {
  illustration: HeroIllustration
  priority?: boolean
  className?: string
}) {
  return (
    // FRESCO-1138: media corners are the crisp `sm` (6px); callouts are `md` and the plan cards keep
    // `card`, so the radius says what a box is instead of rounding every box the same.
    <div className={`relative overflow-hidden rounded-sm ${className ?? ''}`}>
      <Image
        src={illustration.src}
        alt=""

        fill
        sizes="(max-width: 768px) 45vw, (max-width: 1200px) 22vw, 240px"
        className="object-cover"
        preload={priority}
        fetchPriority={priority ? 'high' : undefined}
      />
    </div>
  );
}

/**
 * Editorial, deliberately asymmetric composition of clay dish illustrations —
 * one anchor column slightly wider, the second column dropped down. Calm,
 * not a collage (DESIGN.md "calm over busy").
 *
 * FRESCO-459: each column is a slow vertical marquee (`fresco-hero-marquee-up`
 * / `-down` in globals.css) drifting in opposite directions at ambient speed
 * — approved live by the founder ("me flipa") off a throwaway prototype.
 * Each column's illustration list is doubled (`[...illustrations, ...illustrations]`) so the
 * `translateY(0 -> -50%)` loop is seamless. The `mask-image` gradient on the
 * outer `overflow-hidden` wrapper fades illustrations in/out at the top and bottom
 * edge instead of cutting them off flush — the one change the founder asked
 * for over the prototype. `-webkit-mask-image` is required for Safari; both
 * declarations must stay in sync.
 */
const LEFT_COLUMN_ILLUSTRATIONS = [HERO_ILLUSTRATIONS[0], HERO_ILLUSTRATIONS[1], HERO_ILLUSTRATIONS[2], HERO_ILLUSTRATIONS[3]];
const RIGHT_COLUMN_ILLUSTRATIONS = [HERO_ILLUSTRATIONS[4], HERO_ILLUSTRATIONS[5], HERO_ILLUSTRATIONS[6], HERO_ILLUSTRATIONS[7]];

const EDGE_FADE_MASK = 'linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)';

function HeroMarqueeColumn({
  illustrations,
  animationClassName,
  widthClassName,
  priority = false,
}: {
  illustrations: HeroIllustration[]
  animationClassName: string
  widthClassName: string
  priority?: boolean
}) {
  const strip = [...illustrations, ...illustrations];

  return (
    <div
      className={`overflow-hidden ${widthClassName}`}
      style={{ maskImage: EDGE_FADE_MASK, WebkitMaskImage: EDGE_FADE_MASK }}
    >
      <div className={`flex flex-col gap-3 md:gap-4 ${animationClassName}`}>
        {strip.map((illustration, i) => (
          <HeroIllustrationFrame key={i} illustration={illustration} priority={priority && i === 0} className="aspect-square shrink-0" />
        ))}
      </div>
    </div>
  );
}

function HeroIllustrationComposition() {
  return (
    <div className="mt-8 md:mt-0">
      {/* The columns are decorative; the caption below sits outside the edge fade and is read. */}
      <div className="flex h-[440px] gap-3 md:h-[520px] md:gap-4" aria-hidden="true">
        {/* Anchor column. The top tile is the composition's likely LCP element
            (the hero h1 aside) — only it is eager; the rest lazy-load. */}
        <HeroMarqueeColumn
          illustrations={LEFT_COLUMN_ILLUSTRATIONS}
          animationClassName="hero-marquee-col-a"
          widthClassName="w-1/2 md:w-[54%]"
          priority
        />
        <HeroMarqueeColumn
          illustrations={RIGHT_COLUMN_ILLUSTRATIONS}
          animationClassName="hero-marquee-col-b"
          widthClassName="w-1/2 md:w-[46%] md:pt-12"
        />
      </div>
      {/* FRESCO-1141: the FLUX terms forbid presenting the output as real photographs, so the caption is visible. */}
      <p className="mt-3 text-body-sm text-tertiary">Ilustraciones de platos del catálogo, generadas con inteligencia artificial.</p>
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

        {/* FRESCO-475: self-contained "qué es Fresco" sentence right below
            the h1, carrying the primary target keyword literally — extractable
            on its own by search snippets/AI summaries without depending on the
            rest of the page. The emotional h1 above is left untouched. */}
        <p className="mt-3 max-w-md text-body-md font-semibold text-text">
          Fresco es el planificador de menús semanales que genera tu menú de lunes a domingo y la lista de la compra en 30 segundos.
        </p>

        {/* FRESCO-475: trimmed the trailing "Fresco te da el menú..." sentence
            — it now duplicates the subtitle above almost verbatim. */}
        <p className="mt-4 max-w-md text-body-md text-tertiary">
          Cada semana la misma historia:
          {' '}
          <strong className="font-semibold text-text">
            no sabes qué cocinar, compras de más y acabas tirando comida.
          </strong>
        </p>

        <div className="mt-8 flex max-w-sm flex-col gap-3">
          <LandingCtaLink location="hero" className={buttonVariants({ size: 'lg' })}>
            Generar mi primer menú
          </LandingCtaLink>
          <a href="#como-funciona" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
            ¿Cómo funciona?
          </a>
        </div>

        {/* FRESCO-1138: the two decorative icons (Lucide clock and leaf in a circle) are gone; the two
            benefits read as plain text under a hairline. */}
        <div className="mt-7 flex flex-col gap-3 border-t border-border pt-7 sm:flex-row sm:gap-8">
          <p className="text-body-sm text-tertiary">
            <strong className="block text-body-sm font-bold text-text">Menos tiempo decidiendo</strong>
            qué cocinar cada semana
          </p>
          <p className="text-body-sm text-tertiary">
            <strong className="block text-body-sm font-bold text-text">Menos comida tirada</strong>
            compras justo lo que necesitas
          </p>
        </div>
      </div>

      <HeroIllustrationComposition />
    </section>
  );
}
