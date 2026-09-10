'use client';

import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Button, buttonVariants } from '@/components/ui/button';
import { IDENTITY_COOKIE_EVENT, readNombreCookie } from '@/lib/auth/identity-cookie';
import { createClient } from '@/lib/supabase/client';
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
/**
 * FRESCO-486: the landing nav shows guest CTAs by default; a visitor with an
 * active session sees a direct link back to the app instead, plus a greeting
 * when we know their name.
 *
 * `hasSession` is resolved client-side only (never a server session check —
 * the landing must stay off that critical path, see FRESCO-483) from a local
 * `getSession()` read (no network). The name comes from the `fresco_nombre`
 * cookie kept in sync by `IdentityCookieSync`; SSR and first paint render the
 * guest state, then this reconciles after mount (same pattern as the
 * `ThemeToggle` beside it).
 */
interface NavIdentity {
  hasSession: boolean
  nombre: string | null
}

export function SiteNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [identity, setIdentity] = useState<NavIdentity>({ hasSession: false, nombre: null });

  useEffect(() => {
    let active = true;
    void createClient().auth.getSession().then(({ data: { session } }) => {
      if (!active) { return; }
      setIdentity({ hasSession: Boolean(session), nombre: readNombreCookie() });
    });

    // `IdentityCookieSync` writes the name cookie from an async query that
    // can resolve just after this first paint — pick that up without a
    // reload (keeps the "sin parpadeo" promise for a fresh sign-in).
    function onCookieChange() {
      if (!active) { return; }
      setIdentity(prev => ({ ...prev, nombre: readNombreCookie() }));
    }
    window.addEventListener(IDENTITY_COOKIE_EVENT, onCookieChange);

    return () => {
      active = false;
      window.removeEventListener(IDENTITY_COOKIE_EVENT, onCookieChange);
    };
  }, []);

  return (
    // FRESCO-169: was `bg-background/95 backdrop-blur` — Tailwind can't
    // apply an opacity modifier to a color defined as a raw `var(--color-*)`
    // reference (tailwind.config.ts), so it silently resolved to a fully
    // transparent background (confirmed via getComputedStyle). Solid
    // bg-background fixes contrast on any section behind it.
    <header className="sticky top-0 z-20 border-b border-border bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link href="/" className="inline-flex min-h-[44px] shrink-0 items-center">
          {/* FRESCO-481: cream negative mark on the near-black dark nav. */}
          <Image src="/brand/logo-base.svg" alt="Fresco" width={100} height={30} className="brand-mark--light" priority />
          <Image src="/brand/logo-negativo.svg" alt="Fresco" width={100} height={30} className="brand-mark--dark" priority />
        </Link>

        {/* FRESCO-480: was `sm:flex` (640px) — the row (logo + 3 links + two
            CTAs + theme toggle) crammed against `max-w-5xl` from ~768px down.
            Horizontal nav now only appears at `lg` (1024px) where it has room;
            below that the hamburger owns the links. */}
        <nav className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              // FRESCO-478: 44px tap target (WCAG 2.5.5).
              className="inline-flex min-h-[44px] items-center text-label text-tertiary transition-colors hover:text-text"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {identity.hasSession
            ? (
                <div className="flex items-center gap-2" data-testid="site_nav_authed">
                  {identity.nombre && (
                    <span
                      data-testid="site_nav_greeting"
                      className="hidden text-label text-tertiary sm:inline"
                    >
                      Hola,
                      {' '}
                      {identity.nombre}
                    </span>
                  )}
                  <Link
                    href="/menu"
                    data-testid="site_nav_app_link"
                    className={cn(buttonVariants({ size: 'sm' }), 'min-h-[44px]')}
                  >
                    Ir a mi menú
                  </Link>
                </div>
              )
            : (
                <>
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
                </>
              )}
          {/* FRESCO-480: inline theme toggle rides with the horizontal nav — at
              `lg` and up. Between `sm` and `lg` it lives in the hamburger sheet. */}
          <ThemeToggle variant="binary" className="hidden lg:inline-flex" />
          <Button
            variant="secondary"
            size="sm"
            // FRESCO-315: 44x44 comfortable tap target on mobile (was ~40x31).
            // FRESCO-480: hamburger now covers the tablet range too (< lg).
            className="min-h-[44px] min-w-[44px] rounded-sm px-2 lg:hidden"
            aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isOpen}
            onClick={() => setIsOpen(open => !open)}
          >
            {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {isOpen && (
        <nav className="flex flex-col border-t border-border bg-background lg:hidden">
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
          {/* FRESCO-486: the mobile sheet mirrors the header's logged-in state. */}
          {identity.hasSession && (
            <div className="border-b border-border px-4 py-4" data-testid="site_nav_authed_mobile">
              {identity.nombre && (
                <p data-testid="site_nav_greeting_mobile" className="mb-1 text-caption text-tertiary">
                  Hola,
                  {' '}
                  {identity.nombre}
                </p>
              )}
              <Link
                href="/menu"
                onClick={() => setIsOpen(false)}
                data-testid="site_nav_app_link_mobile"
                className="text-body-md font-semibold text-primary"
              >
                Ir a mi menú
              </Link>
            </div>
          )}
          <div className="flex items-center justify-between border-b border-border px-4 py-4">
            <span className="text-body-md text-text">Tema</span>
            <ThemeToggle variant="binary" />
          </div>
        </nav>
      )}
    </header>
  );
}
