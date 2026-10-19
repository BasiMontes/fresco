import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { LEGAL_TEXTS_VERSION, parseConsentKinds } from '@/lib/legal/consent';
import { recordConsents } from '@/lib/legal/consent-store';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * POST /api/consents — records the consents the caller just gave (FRESCO-794,
 * ADR-0040). Body: `{ kinds: ConsentKind[] }`. Works for a guest too: an
 * anonymous session is an authenticated one with its own `auth.users` row.
 *
 * The version of the text is NOT taken from the body: it is the server's
 * `LEGAL_TEXTS_VERSION`, so a client cannot claim to have accepted a version it
 * was never shown. FRESCO-1007: the user id comes from the verified session, and
 * the write goes through `record_consents` with the service role, because the
 * table no longer has an INSERT grant for any client role: a client that skipped
 * this route could otherwise write any version, and as many rows as it liked.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No hay una sesión autenticada.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  }
  catch {
    return NextResponse.json({ error: 'El cuerpo de la petición no es JSON válido.' }, { status: 400 });
  }

  const kinds = parseConsentKinds(body);
  if (!kinds) {
    return NextResponse.json({ error: 'Consentimientos no válidos.' }, { status: 400 });
  }

  const { error } = await recordConsents(createServiceClient(), { userId: user.id, kinds });
  if (error) {
    console.error('[/api/consents] failed to record consents', error);
    return NextResponse.json({ error: 'No se pudo registrar tu consentimiento.' }, { status: 500 });
  }

  return NextResponse.json({ recorded: kinds, version: LEGAL_TEXTS_VERSION });
}
