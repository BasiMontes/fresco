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

/** The current browser session, or `null` when there is none. */
export async function getSession() {
  const { data: { session } } = await createClient().auth.getSession();
  return session;
}

/** The current session's access token, or `null` when there is no session. */
export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
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

/** Anonymous (guest) sign-in. */
export async function signInAnonymously({ captchaToken }: { captchaToken: string | null }) {
  return createClient().auth.signInAnonymously({ options: captchaOptions(captchaToken) });
}

interface SignUpArgs extends PasswordCredentials {
  /** Where the confirmation email link sends the user; built by the caller from its own origin. */
  emailRedirectTo: string
  /** Stored in the new user's metadata (FRESCO-794: consents waiting for the first signed-in visit). */
  metadata: Record<string, unknown>
}

/** Creates an account. With email confirmation on, the result usually carries no session. */
export async function signUp({ email, password, captchaToken, emailRedirectTo, metadata }: SignUpArgs) {
  return createClient().auth.signUp({
    email,
    password,
    options: { ...captchaOptions(captchaToken), emailRedirectTo, data: metadata },
  });
}

/** Sends the password-reset email. */
export async function sendPasswordReset({ email, captchaToken }: { email: string, captchaToken: string | null }) {
  return createClient().auth.resetPasswordForEmail(email, captchaOptions(captchaToken));
}
