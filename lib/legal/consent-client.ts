import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConsentKind } from './consent';
import { parseConsentKinds } from './consent';

/**
 * FRESCO-794 (ADR-0040) — browser side of the consent registry.
 *
 * Three of the consents are given together at the start (age, Terms, Privacy),
 * so they travel as one set. A user who creates an ACCOUNT may not have a session
 * yet (the project requires email confirmation), and `POST /api/consents` needs
 * one. For that case the set rides in the sign-up as `user_metadata.consent_pending`
 * and is recorded, then cleared, the first time the user is signed in on
 * `/onboarding`. `user_metadata` is the user's own data: it can only make a user
 * record a consent for themselves, which is what the registry is for.
 */

export const REGISTRATION_CONSENTS: ConsentKind[] = ['age_14', 'terms', 'privacy'];

export const CONSENT_PENDING_KEY = 'consent_pending';

/** Records `kinds` for the current session. `false` on any failure; never throws. */
export async function postConsents(kinds: ConsentKind[]): Promise<boolean> {
  try {
    const res = await fetch('/api/consents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kinds }),
    });
    return res.ok;
  }
  catch {
    return false;
  }
}

/** The consents waiting in a user's metadata, validated; empty when there are none or they are malformed. */
export function pendingConsentKinds(metadata: unknown): ConsentKind[] {
  if (typeof metadata !== 'object' || metadata === null) {
    return [];
  }
  return parseConsentKinds({ kinds: (metadata as Record<string, unknown>)[CONSENT_PENDING_KEY] }) ?? [];
}

/**
 * Records the consents parked in the signed-in user's metadata and clears them.
 * Idempotent: the registry ignores a repeated `(user, kind, version)`, and the
 * metadata is only cleared after the write succeeded, so a failure is retried on
 * the next call.
 */
export async function flushPendingConsents(client: SupabaseClient): Promise<void> {
  const { data: { user } } = await client.auth.getUser();
  const kinds = pendingConsentKinds(user?.user_metadata);
  if (kinds.length === 0) {
    return;
  }

  if (await postConsents(kinds)) {
    await client.auth.updateUser({ data: { [CONSENT_PENDING_KEY]: null } });
  }
}
