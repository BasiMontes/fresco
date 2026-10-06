import { useEffect, useState } from 'react';
import { flushPendingConsents } from '@/lib/legal/consent-client';
import { hydrateFromSavedProfile } from '@/lib/onboarding/hydrate-saved-profile';
import { createClient } from '@/lib/supabase/client';

/**
 * FRESCO-17/FRESCO-197/FRESCO-255 — resolves whether `/onboarding` shows the
 * guest-vs-account choice or the wizard, and drives the wizard's one-time
 * entrance stagger. Extracted from `app/onboarding/page.tsx` (A5-M1,
 * god-component split) — no behavior change from the original inline
 * implementation.
 */
export function useOnboardingSessionGate() {
  // FRESCO-197: `null` = still checking for an existing session, `false` =
  // no session — show the guest-vs-account choice, `true` = resolved
  // (wizard renders). A just-registered user from /signup or a returning
  // guest already carries a persisted Supabase session, so this only ever
  // surfaces the choice to an actual first-time, session-less visitor.
  const [identityResolved, setIdentityResolved] = useState<boolean | null>(null);
  // FRESCO-255: plays the wizard's entrance stagger (logo -> step indicator
  // -> card) once, the first time it mounts (i.e. once identity resolves) —
  // not replayed on every step change, to avoid fighting the existing
  // stepHeadingRef focus-management effect.
  const [wizardShown, setWizardShown] = useState(false);
  useEffect(() => {
    setWizardShown(true);
  }, []);

  // FRESCO-17/FRESCO-197 (Guest Mode, US 6.1): a first-time visitor reaches
  // this page with no Supabase session at all — she now sees an explicit
  // guest-vs-account choice (`IdentityStep`) instead of a silent anonymous
  // sign-in. A just-registered user arriving from `/signup`, or a returning
  // guest whose anonymous session already persisted, skips straight to the
  // wizard below.
  //
  // FRESCO-806 (audit-6 A6-L5): a user who already has a profile finds it in
  // the wizard. Without this the wizard started empty and "Empezar" upserted
  // that emptiness over their allergens and diet. A read failure must NOT fall
  // back to an empty wizard (the same overwrite), so it surfaces as
  // `profileLoadFailed` and the page offers a retry instead.
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    async function checkSession() {
      const client = createClient();
      const { data: { session } } = await client.auth.getSession();
      if (session) {
        try {
          await hydrateFromSavedProfile({ client, userId: session.user.id });
          setProfileLoadFailed(false);
        }
        catch (error) {
          console.error('[onboarding] could not read the saved profile', error);
          setProfileLoadFailed(true);
        }
      }
      setIdentityResolved(!!session);
    }
    void checkSession();
  }, [attempt]);

  // FRESCO-794 (ADR-0040): an account created while email confirmation was
  // pending parked its consents in the user's metadata (`IdentityStep`). The
  // first time that user is signed in here, record them. A no-op for everyone
  // else, and a failure is retried on the next visit.
  useEffect(() => {
    if (identityResolved) {
      void flushPendingConsents(createClient());
    }
  }, [identityResolved]);

  return {
    identityResolved,
    setIdentityResolved,
    wizardShown,
    profileLoadFailed,
    retryLoadProfile: () => {
      setIdentityResolved(null);
      setAttempt(n => n + 1);
    },
  };
}
