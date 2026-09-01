'use client';

import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LandingCtaLink } from './landing-cta-link';

const NAV_LINKS = [
  { href: '#como-funciona', label: '¿Cómo funciona?' },
  { href: '#pricing', label: 'Precios' },
  { href: '#faq', label: 'FAQ' },
] as const;

/**
 * Sticky guest nav. Only this component and `Faq` need client-side state in
 * the landing page — everything else stays server-rendered.
 */
export function SiteNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    // FRESCO-169: was `bg-background/95 backdrop-blur` — Tailwind can't
    // apply an opacity modifier to a color defined as a raw `var(--color-*)`
    // reference (tailwind.config.ts), so it silently resolved to a fully
    // transparent background (confirmed via getComputedStyle). Solid
    // bg-background fixes contrast on any section behind it.
    <header className="sticky top-0 z-20 border-b border-border bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link href="/" className="shrink-0">
          <Image src="/brand/logo-base.svg" alt="Fresco" width={100} height={30} priority />
        </Link>

        <nav className="hidden items-center gap-7 sm:flex">
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              className="text-body-sm text-tertiary transition-colors hover:text-text"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            // FRESCO-315: 44px comfortable tap target on mobile (was ~26px).
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'min-h-[44px]')}
          >
            Ya tengo cuenta
          </Link>
          <LandingCtaLink
            location="site_nav"
            className={cn(buttonVariants({ size: 'sm' }), 'hidden sm:inline-flex')}
          >
            Empezar gratis
          </LandingCtaLink>
          <Button
            variant="secondary"
            size="sm"
            // FRESCO-315: 44x44 comfortable tap target on mobile (was ~40x31).
            className="min-h-[44px] min-w-[44px] rounded-sm px-2 sm:hidden"
            aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isOpen}
            onClick={() => setIsOpen(open => !open)}
          >
            {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {isOpen && (
        <nav className="flex flex-col border-t border-border bg-background sm:hidden">
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="border-b border-border px-4 py-4 text-body-md text-text"
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
