import type { useCaptcha } from '@/components/auth/use-captcha';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EdgeFunctionError, reassignGuestData } from '@/lib/api/edge-functions';
import { translateAuthError } from '@/lib/auth-errors';
import { adoptSession, getSession, proveAccountOwnership } from '@/lib/client-api/auth';
import { getDistinctId } from '@/lib/posthog/distinct-id';
import { aliasUser, captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';

interface UseSignupReassignArgs {
  email: string
  captcha: ReturnType<typeof useCaptcha>
  setNavigating: (value: boolean) => void
}

/**
 * ADR-0004 (FRESCO-20) + ADR-0022 (FRESCO-395 / A4-L4): the guest proves
 * she owns the conflicting account by authenticating to it through native
 * Supabase Auth; `reassign-guest-data` then only verifies the resulting
 * session token, never a password. The proof sign-in runs on a throwaway
 * in-memory client (`persistSession: false`) so the guest session on the
 * main client stays live until the data move is done — that anonymous
 * identity is what gets reassigned away — and only then is the main client
 * switched over to the real account.
 */
export function useSignupReassign({ email, captcha, setNavigating }: UseSignupReassignArgs) {
  const router = useRouter();
  const [conflictPassword, setConflictPassword] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  async function handleReassign() {
    setIsReassigning(true);
    setReassignError(null);
    try {
      const session = await getSession();
      if (!session) {
        setReassignError('Tu sesión de invitada expiró. Recarga la página e inténtalo de nuevo.');
        return;
      }

      // Ownership proof against native Supabase Auth (its own rate limiting +
      // leaked-password protection) on a client kept out of storage, so the
      // guest session above is untouched.
      const { data: proofData, error: proofError } = await proveAccountOwnership({
        email,
        password: conflictPassword,
        captchaToken: captcha.token,
      });
      captcha.reset();
      if (proofError || !proofData.session) {
        setReassignError(translateAuthError(proofError));
        return;
      }

      await reassignGuestData(
        { targetAccessToken: proofData.session.access_token },
        session.access_token,
      );

      // FRESCO-240 (ADR-0013): capture the anonymous distinct_id BEFORE
      // signInWithPassword below switches the session to the pre-existing
      // account's auth.uid() -- once it resolves, the provider's
      // onAuthStateChange has already re-identified under the new uid and
      // this anonymous id is gone.
      const anonymousDistinctId = getDistinctId();

      // FRESCO-799: switch the main client to the account the proof sign-in just
      // authenticated by adopting that session, not by a second password
      // sign-in — a Turnstile token is single-use, so a second sign-in would
      // need a second challenge for the same proof.
      const { data: signInData, error } = await adoptSession({
        accessToken: proofData.session.access_token,
        refreshToken: proofData.session.refresh_token,
      });
      if (error) {
        setReassignError(translateAuthError(error));
        return;
      }
      // Merges the guest's pre-reassignment event stream (menu generation
      // included) into the account she just proved she owns -- identify()
      // alone can't do this, since the uid actually changes here, unlike the
      // OTP conversion path which keeps the same uid throughout.
      if (anonymousDistinctId && signInData.user) {
        aliasUser(signInData.user.id, anonymousDistinctId);
      }
      captureEvent(POSTHOG_EVENTS.USER_SIGNED_UP, { method: 'progressive_signup_reassign', $set_once: { signup_method: 'progressive_signup_reassign' } });
      // FRESCO-204: she may have browsed /menu as the anonymous guest
      // earlier in this session — Next's client Router Cache can otherwise
      // serve that stale (is_anonymous: true) RSC payload instead of
      // refetching, showing the "create an account" banner right after she
      // just did. `router.refresh()` busts it, same pattern used elsewhere
      // in this app after server state changes.
      router.refresh();
      setNavigating(true);
      router.push('/menu');
    }
    catch (err) {
      setReassignError(
        err instanceof EdgeFunctionError
          ? err.message
          : 'No pudimos verificar esa cuenta. Inténtalo de nuevo.',
      );
    }
    finally {
      setIsReassigning(false);
    }
  }

  return { conflictPassword, setConflictPassword, isReassigning, reassignError, handleReassign };
}
