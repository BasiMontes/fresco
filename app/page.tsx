import { Faq } from '@/components/landing/faq';
import { FAQS } from '@/components/landing/faq-data';
import { FinalCta } from '@/components/landing/final-cta';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { ImpactStats } from '@/components/landing/impact-stats';
import { LearnsPro } from '@/components/landing/learns-pro';
import { PainPoints } from '@/components/landing/pain-points';
import { Pricing } from '@/components/landing/pricing';
import { SiteFooter } from '@/components/landing/site-footer';
import { SiteNav } from '@/components/landing/site-nav';
import { JsonLd } from '@/components/seo/json-ld';
import { Reveal } from '@/components/ui/reveal';
import { faqJsonLd, softwareApplicationJsonLd } from '@/lib/seo/structured-data';

/**
 * Guest landing ("/") — EPIC-FRESCO-6 (Guest Mode). Content and structure
 * merged from the approved static mockup (fresco_landing.html) onto this
 * repo's real design tokens and components; every CTA routes into
 * `/onboarding` (signup-free) per user-journeys.md Journey 1, with
 * `/signup` kept as the returning-user escape hatch in the nav.
 */
export default function GuestLandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* FRESCO-472: SoftwareApplication + FAQPage JSON-LD. The FAQPage block
          is derived from the same `FAQS` array the visible accordion below
          maps over, so it can never drift from the rendered content. */}
      <JsonLd data={softwareApplicationJsonLd()} />
      <JsonLd data={faqJsonLd(FAQS)} />
      <SiteNav />
      {/* FRESCO-315: `<main>` wraps only the content sections — SiteNav
          (`<header>`) and SiteFooter (`<footer>`) stay siblings so the
          landmark structure is header / main / contentinfo. */}
      <main id="main">
        {/* Hero is above the fold — no scroll reveal. FRESCO-446: every
            section below gets a gentle settle as it enters the viewport
            (disabled under prefers-reduced-motion). */}
        <Hero />
        <Reveal><PainPoints /></Reveal>
        <Reveal><HowItWorks /></Reveal>
        <Reveal><LearnsPro /></Reveal>
        <Reveal><ImpactStats /></Reveal>
        <Reveal><Pricing /></Reveal>
        <Reveal><Faq /></Reveal>
        <Reveal><FinalCta /></Reveal>
      </main>
      <SiteFooter />
    </div>
  );
}
