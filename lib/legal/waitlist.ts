import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { LEGAL_TEXTS_VERSION } from './consent';

/**
 * FRESCO-888 — the pre-launch waitlist. The registry is `public.waitlist_signups`
 * (`supabase/migrations/20261011140000_waitlist_signups.sql`): an email plus the
 * version of the consent text accepted. Same provisional-copy rule as
 * `lib/legal/consent.ts`; the version stamped here is that file's.
 */

/** Checkbox copy next to the email field. PROVISIONAL, like every text in `consent.ts`. */
export const WAITLIST_CONSENT_TEXT = 'Acepto que Fresco use mi correo solo para avisarme del lanzamiento.';

// Same shape as `EmailInput`'s check: no dot-only domain labels, so it cannot backtrack badly.
const EMAIL_PATTERN = /^[^\s@]+@[^\s.@]+(?:\.[^\s.@]+)+$/;
const EMAIL_MAX_LENGTH = 254;

export interface WaitlistBody {
  email: string
}

/**
 * Parses the body of `POST /api/waitlist`: `{ email: string, consent: true }`.
 * Returns the trimmed email, or `null` for anything malformed (not an object,
 * consent not exactly `true`, not an email, too long). Utility shape
 * (CLAUDE.md §10): returns null, never throws.
 */
export function parseWaitlistBody(body: unknown): WaitlistBody | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const { email, consent } = body as { email?: unknown, consent?: unknown };
  if (consent !== true || typeof email !== 'string') {
    return null;
  }

  const trimmed = email.trim();
  if (trimmed.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(trimmed)) {
    return null;
  }

  return { email: trimmed };
}

const UNIQUE_VIOLATION = '23505';

/**
 * Adds `email` to the waitlist under the visitor's own (anonymous) session. The
 * version is the server's, never the caller's. An address already on the list is
 * reported as success so the form cannot be used to find out who signed up.
 */
export async function addToWaitlist(client: SupabaseClient<Database>, email: string) {
  const { error } = await client
    .from('waitlist_signups')
    .insert({ email, consent_version: LEGAL_TEXTS_VERSION });

  if (error && error.code !== UNIQUE_VIOLATION) {
    return { error };
  }

  return { error: null };
}
