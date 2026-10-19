import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { confirmWaitlistSignup, isWaitlistToken, removeWaitlistSignup, withinIpLimit } from '@/lib/legal/waitlist';
import { createServiceClient } from '@/lib/supabase/service';

/** The token is 256 bits, so guessing is hopeless; the limit only stops the endpoint being hammered. */
const ATTEMPTS_PER_IP_PER_HOUR = 30;

/**
 * POST /api/waitlist/confirm (FRESCO-1008) — the second step of the waitlist's double opt-in, and
 * the way out. Body: `{ token: string, action: 'confirm' | 'remove' }`. It is a POST behind a
 * button on `/lista-de-espera`, not a GET link, so a mail scanner that opens every link in a message
 * cannot confirm an address by itself.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  }
  catch {
    return NextResponse.json({ error: 'El cuerpo de la petición no es JSON válido.' }, { status: 400 });
  }

  const { token, action } = (typeof body === 'object' && body !== null ? body : {}) as { token?: unknown, action?: unknown };
  if (!isWaitlistToken(token) || (action !== 'confirm' && action !== 'remove')) {
    return NextResponse.json({ error: 'Enlace no válido.' }, { status: 400 });
  }

  const service = createServiceClient();

  const limit = await withinIpLimit(service, { headers: request.headers, endpoint: 'waitlist-confirm', limit: ATTEMPTS_PER_IP_PER_HOUR });
  if (limit.error) {
    console.error('[/api/waitlist/confirm] rate limit check failed', limit.error);
    return NextResponse.json({ error: 'No se pudo completar la acción. Inténtalo de nuevo.' }, { status: 500 });
  }
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Demasiados intentos. Inténtalo de nuevo más tarde.' }, { status: 429 });
  }

  const result = action === 'confirm' ? await confirmWaitlistSignup(service, token) : await removeWaitlistSignup(service, token);
  if (result.error) {
    console.error('[/api/waitlist/confirm] database error', result.error);
    return NextResponse.json({ error: 'No se pudo completar la acción. Inténtalo de nuevo.' }, { status: 500 });
  }
  if (!result.found) {
    return NextResponse.json({ error: 'Este enlace ya no es válido.' }, { status: 404 });
  }

  return NextResponse.json({ done: action });
}
