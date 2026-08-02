import type { EmailOtpType } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * FRESCO-52 — lands here from the link in Supabase's password-recovery email
 * (also reusable for any future `type` Supabase's email templates emit:
 * signup confirmation, magic link, invite). Recovery links carry a
 * `token_hash` + `type` pair verified via `verifyOtp` — NOT the `code` +
 * `exchangeCodeForSession` PKCE pair, which is OAuth/SSO-only (confirmed
 * against Supabase's current docs before writing this; the two are easy to
 * conflate and only one applies to email-link recovery).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const rawNext = searchParams.get('next');
  // `next` is attacker-controllable (it's a query param) — without this
  // guard, `next=https://evil.com` (or the protocol-relative `next=//evil.com`)
  // would make `new URL(next, request.url)` resolve to that external origin,
  // an open redirect fired right after a real, successful auth verification.
  // Only an in-app relative path is ever a valid destination here.
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL('/forgot-password?error=invalid_link', request.url));
}
