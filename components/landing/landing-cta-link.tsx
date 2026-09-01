'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';

interface LandingCtaLinkProps {
  /** Where on the landing page this CTA sits — the `location` event property. */
  location: string
  className?: string
  children: ReactNode
  /** Defaults to the onboarding entry point every landing CTA routes to. */
  href?: string
}

/**
 * FRESCO-366 / A4-B4: the landing page's primary CTAs are the top of the
 * acquisition funnel (`landing_cta_clicked` → `user_signed_up` → …). The
 * landing sections are server components, so this thin client wrapper is the
 * one place the click can be captured. It does NOT preventDefault — the
 * `next/link` navigation proceeds exactly as before; the capture is
 * fire-and-forget and fail-soft (`captureEvent` swallows errors).
 */
export function LandingCtaLink({ location, className, children, href = '/onboarding' }: LandingCtaLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => captureEvent(POSTHOG_EVENTS.LANDING_CTA_CLICKED, { location })}
    >
      {children}
    </Link>
  );
}
