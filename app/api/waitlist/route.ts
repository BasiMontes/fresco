import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { addToWaitlist, parseWaitlistBody } from '@/lib/legal/waitlist';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/waitlist — adds a visitor to the pre-launch waitlist (FRESCO-888).
 * Body: `{ email: string, consent: true }`. No session is required: the insert
 * runs as `anon` and the table's RLS plus its `(email, consent_version)` column
 * grant are the authorization; no service-role client is involved.
 *
 * The consent version is the server's `LEGAL_TEXTS_VERSION`, not the body's. An
 * address already on the list answers the same 200 as a new one.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  }
  catch {
    return NextResponse.json({ error: 'El cuerpo de la petición no es JSON válido.' }, { status: 400 });
  }

  const parsed = parseWaitlistBody(body);
  if (!parsed) {
    return NextResponse.json({ error: 'Escribe un correo válido y acepta el consentimiento.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await addToWaitlist(supabase, parsed.email);
  if (error) {
    console.error('[/api/waitlist] failed to add to the waitlist', error);
    return NextResponse.json({ error: 'No se pudo apuntar tu correo. Inténtalo de nuevo.' }, { status: 500 });
  }

  return NextResponse.json({ joined: true });
}
