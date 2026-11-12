interface AutoStartInput {
  isAnonymous: boolean
  /** The profile row exists: the person finished the profile onboarding. */
  profileExists: boolean
  /** The account's `recorrido_visto` flag; a failed read counts as seen (see `getHasSeenTour`). */
  seen: boolean
  /** Terms the person still has to accept again: the dialog that asks for them blocks the screen. */
  missingConsents: number
}

/**
 * FRESCO-1197: whether the first-visit tour opens by itself. Owner decision (2026-11-12): registered
 * accounts only, once, after the profile onboarding. It never competes with the blocking re-consent
 * dialog (FRESCO-1007), which has to be answered first.
 */
export function shouldAutoStartTour({ isAnonymous, profileExists, seen, missingConsents }: AutoStartInput): boolean {
  return !isAnonymous && profileExists && !seen && missingConsents === 0;
}
