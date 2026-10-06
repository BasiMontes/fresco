import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { captchaOptions } from '@/lib/auth/captcha';
import { clientEnv } from '@/lib/env';
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

/** The signed-in user (a guest included), or `null` when there is no session. */
export async function getCurrentUser() {
  const { data: { user } } = await createClient().auth.getUser();
  return user;
}

/**
 * FRESCO-89, step 1 of the guest-to-account conversion (also the "resend"):
 * links `email` to the current anonymous user; Supabase mails a code to it.
 */
export async function requestEmailChange(email: string) {
  return createClient().auth.updateUser({ email });
}

/** FRESCO-89, step 2: verifies the code mailed to the new address. */
export async function verifyEmailChangeOtp({ email, token }: { email: string, token: string }) {
  return createClient().auth.verifyOtp({ email, token, type: 'email_change' });
}

/** FRESCO-89, step 3: sets the password, only allowed once the email is verified. */
export async function updatePassword(password: string) {
  return createClient().auth.updateUser({ password });
}

/**
 * ADR-0004 / ADR-0022: proves the caller owns an existing account by signing in
 * on a throwaway in-memory client (`persistSession: false`), so the live guest
 * session stays untouched until the data move is done.
 */
export async function proveAccountOwnership({ email, password, captchaToken }: PasswordCredentials) {
  const proofClient = createSupabaseClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return proofClient.auth.signInWithPassword({ email, password, options: captchaOptions(captchaToken) });
}

/**
 * FRESCO-799: switches the main client to an already-authenticated session
 * instead of signing in a second time (a Turnstile token is single-use).
 */
export async function adoptSession({ accessToken, refreshToken }: { accessToken: string, refreshToken: string }) {
  return createClient().auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
}

/** Sends the password-reset email. */
export async function sendPasswordReset({ email, captchaToken }: { email: string, captchaToken: string | null }) {
  return createClient().auth.resetPasswordForEmail(email, captchaOptions(captchaToken));
}
