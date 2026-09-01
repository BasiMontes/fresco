import type { EmailOtpType } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { safeNextPath } from '@/lib/auth/safe-next-path';
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
  // `next` is attacker-controllable (it's a query param) — `safeNextPath`
  // collapses it to a same-origin relative path or `/`, closing the open
  // redirect that would otherwise fire right after a successful auth verify
  // (A4-L1: `//evil.com`, `\evil.com`, `/\evil.com`, `https://evil.com`).
  const next = safeNextPath(searchParams.get('next'));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL('/forgot-password?error=invalid_link', request.url));
}
