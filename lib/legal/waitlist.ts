import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { createHash, randomBytes } from 'node:crypto';
import { LEGAL_TEXTS_VERSION } from './consent';

/**
 * FRESCO-888 — the pre-launch waitlist. The registry is `public.waitlist_signups`
 * (`supabase/migrations/20261011140000_waitlist_signups.sql`): an email plus the
 * version of the consent text accepted. Same provisional-copy rule as
 * `lib/legal/consent.ts`; the version stamped here is that file's.
 *
 * FRESCO-1008: double opt-in. A signup is created unconfirmed and a random token goes to the
 * address; the database keeps only the token's SHA-256. The same token confirms the address and
 * removes it, so every email carries its own way out. Writes go through service-role functions
 * (`20261019180000_waitlist_double_opt_in.sql`); the browser roles cannot insert.
 */

// The checkbox copy lives in `waitlist-text.ts` (no imports): this file uses `node:crypto` and is server-only.
export { WAITLIST_CONSENT_TEXT } from './waitlist-text';

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

const TOKEN_PATTERN = /^[\w-]{43}$/;

/** A fresh secret for one confirmation email: 256 bits, URL-safe. */
export function newWaitlistToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashWaitlistToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** `true` for the shape `newWaitlistToken` produces; anything else is not worth a database call. */
export function isWaitlistToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value);
}

/** What the route has to do after `request_waitlist_signup`. */
export type WaitlistRequestOutcome = 'send' | 'throttled' | 'confirmed';

/**
 * Registers `email` as an unconfirmed signup with a fresh token, under the server's consent
 * version. Needs the service-role client. `token` is set only when a confirmation email has to go
 * out; the caller sends it and never stores it.
 */
export async function requestWaitlistSignup(client: SupabaseClient<Database>, email: string) {
  const token = newWaitlistToken();
  const { data, error } = await client.rpc('request_waitlist_signup', {
    p_email: email,
    p_version: LEGAL_TEXTS_VERSION,
    p_token_hash: hashWaitlistToken(token),
  });

  if (error) {
    return { error, outcome: null, token: null };
  }

  const outcome = data as WaitlistRequestOutcome;
  return { error: null, outcome, token: outcome === 'send' ? token : null };
}

/** Confirms the signup the token belongs to. `false` when no signup has that token. */
export async function confirmWaitlistSignup(client: SupabaseClient<Database>, token: string) {
  const { data, error } = await client.rpc('confirm_waitlist_signup', { p_token_hash: hashWaitlistToken(token) });
  return { error, found: data === true };
}

/** Deletes the signup the token belongs to. `false` when no signup has that token. */
export async function removeWaitlistSignup(client: SupabaseClient<Database>, token: string) {
  const { data, error } = await client.rpc('remove_waitlist_signup', { p_token_hash: hashWaitlistToken(token) });
  return { error, found: data === true };
}

/** Per-address limit for the public waitlist routes. Needs the service-role client. `true` while under `limit` this hour. */
export async function withinIpLimit(client: SupabaseClient<Database>, { headers, endpoint, limit }: { headers: Headers, endpoint: string, limit: number }) {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';
  const keyHash = createHash('sha256').update(`${endpoint}:${forwarded}`).digest('hex');
  const { data, error } = await client.rpc('check_ip_rate_limit', { p_key_hash: keyHash, p_endpoint: endpoint, p_limit: limit });
  return { error, allowed: data === true };
}
