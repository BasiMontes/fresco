import { captchaOptions } from '@/lib/auth/captcha';
import { createClient } from '@/lib/supabase/client';

/**
 * Browser-side auth calls (ADR-0041): components never import a Supabase
 * client, they call these. Each one returns exactly what the Supabase call
 * returned, so callers keep their own error handling and messages.
 */

/** Ends the browser session. The result is ignored on purpose, like every caller did. */
export async function signOut(): Promise<void> {
  await createClient().auth.signOut();
}

/** The current session's access token, or `null` when there is no session. */
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await createClient().auth.getSession();
  return session?.access_token ?? null;
}

interface PasswordCredentials {
  email: string
  password: string
  /** Turnstile token (FRESCO-799); `null` when the captcha is off. */
  captchaToken: string | null
}

/** Password sign-in, also used to re-authenticate before a destructive action. */
export async function signInWithPassword({ email, password, captchaToken }: PasswordCredentials) {
  return createClient().auth.signInWithPassword({ email, password, options: captchaOptions(captchaToken) });
}

/** Sends the password-reset email. */
export async function sendPasswordReset({ email, captchaToken }: { email: string, captchaToken: string | null }) {
  return createClient().auth.resetPasswordForEmail(email, captchaOptions(captchaToken));
}
