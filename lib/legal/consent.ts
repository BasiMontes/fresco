/**
 * FRESCO-794 (ADR-0040) — the consents a user can give and the text each one
 * shows. The registry itself is `public.user_consents`
 * (`supabase/migrations/20261004120000_user_consents.sql`).
 *
 * PROVISIONAL: every literal below comes from the lawyer draft
 * `.context/legal/FRESCO-365-borrador-textos-legales.md` and has NOT been
 * validated by a lawyer (founder decision of 2026-10-04: build the mechanism
 * now, review the copy later). When the lawyer changes a sentence, edit it here
 * and bump `LEGAL_TEXTS_VERSION`; a new version is what lets a later flow ask
 * the user to consent again.
 */

export const CONSENT_KINDS = ['age_14', 'terms', 'privacy', 'health_data', 'withdrawal_waiver'] as const;

export type ConsentKind = (typeof CONSENT_KINDS)[number];

/** Version stamped on every row the API records. Server-side only: the client never sends it. */
export const LEGAL_TEXTS_VERSION = 'provisional-2026-10-06';

/** Checkbox copy for the consents that have their own sentence (Terms and Privacy share one checkbox with links). */
export const CONSENT_TEXTS = {
  age_14: 'Confirmo que tengo 14 años o más.',
  health_data: 'Consiento el tratamiento de mis datos de alergias y dieta para excluir recetas no seguras.',
  withdrawal_waiver: 'Solicito que la prestación del servicio comience de inmediato, antes de que finalice el plazo de 14 días de desistimiento, y reconozco que perderé mi derecho de desistimiento cuando el contrato haya sido completamente ejecutado por Fresco.',
} as const satisfies Partial<Record<ConsentKind, string>>;

export function isConsentKind(value: unknown): value is ConsentKind {
  return typeof value === 'string' && (CONSENT_KINDS as readonly string[]).includes(value);
}

/**
 * Parses the body of `POST /api/consents`: `{ kinds: ConsentKind[] }`. Returns
 * the de-duplicated kinds, or `null` for anything malformed (not an object,
 * missing or empty `kinds`, an unknown kind). Utility shape (CLAUDE.md §10):
 * returns null, never throws.
 */
export function parseConsentKinds(body: unknown): ConsentKind[] | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const { kinds } = body as { kinds?: unknown };
  if (!Array.isArray(kinds) || kinds.length === 0 || kinds.length > CONSENT_KINDS.length) {
    return null;
  }

  if (!kinds.every(isConsentKind)) {
    return null;
  }

  return [...new Set(kinds)];
}
