'use client';

import Image from 'next/image';

/**
 * FRESCO-482 — full-screen cover shown after a successful sign-in / sign-up,
 * while `router.push` navigates to `/menu` (or `/onboarding`). Without it the
 * login button flips back to its resting label the instant navigation is
 * requested, 1-3 s before the destination paints, so the wait reads as
 * "nothing happened".
 *
 * The caller mounts this on the success path and never unmounts it — the
 * whole auth page unmounts when the destination route mounts. Opacity-only
 * entrance so there is no layout shift; `prefers-reduced-motion` handled in
 * CSS (`.auth-transition-overlay` in `app/globals.css`).
 */
export function AuthTransitionOverlay({ label }: { label: string }) {
  return (
    <div
      className="auth-transition-overlay fixed inset-0 z-[1200] flex flex-col items-center justify-center gap-4 bg-background"
      role="status"
      aria-live="polite"
      data-testid="auth_transition_overlay"
    >
      <Image src="/brand/logo-base.svg" alt="" width={96} height={29} priority />
      <p className="text-body-sm text-tertiary">{label}</p>
      <div className="auth-transition-overlay__bar" aria-hidden="true" />
    </div>
  );
}
