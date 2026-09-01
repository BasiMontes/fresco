/**
 * FRESCO-372 (A4-H15): one-shot `sessionStorage` signal that a menu was just
 * generated for the first time — onboarding's only generation path. Read
 * once by `PushPromptBanner` on `/menu` to decide whether THIS render is the
 * "moment of value" to ask for push permission, then consumed (removed) so
 * a later same-tab visit to `/menu` never resurfaces it. Same
 * sessionStorage + SSR-safe-guard pattern `lib/store/onboarding-store.ts`
 * already uses for surviving a same-tab client-side navigation.
 */

const KEY = 'fresco-first-menu-generated';

/** Called from `app/onboarding/page.tsx` right before `router.push('/menu')` on the success path. */
export function markFirstMenuGenerated(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(KEY, '1');
}

/** Reads the flag AND clears it in the same call — the signal is one-shot by construction. */
export function consumeFirstMenuSignal(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const present = window.sessionStorage.getItem(KEY) === '1';
  if (present) {
    window.sessionStorage.removeItem(KEY);
  }
  return present;
}
