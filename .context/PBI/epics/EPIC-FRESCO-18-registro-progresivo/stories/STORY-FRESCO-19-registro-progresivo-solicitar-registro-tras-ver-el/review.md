# Review — FRESCO-19

Solo mode: deliberate fresh-eyes review pass, inline, self-adjudicated.

## Findings

1. **Happy-path conversion (valid, unique, not-already-registered email → `updateUser` success → `/menu`) was not exercised with a real 200 response.** Live testing exercised two real branches instead: (a) an invalid/blocklisted email domain (`example.com` → `email_address_invalid`, an unrelated validator rejection, not this story's code path) and (b) the actual `email_exists` conflict using the project's existing registered test user's email — both prove the request reaches Supabase with the correct payload/auth header and that the `error.code` branch routes correctly. A true success response wasn't triggered because doing so with a real new email risks the exact rate-limit/deliverability friction ADR-0003 already names, and this project's own established convention (chosen explicitly earlier this session for the `@registro` scenario) is to mock rather than burn real signups for this kind of verification — but the `PUT /auth/v1/user` route can't be method-scoped through `playwright-cli route`'s CLI surface (it also intercepts the mount-time `GET` `getUser()` used to read `is_anonymous`), so a mock wasn't safely constructible in this manual pass.
   - **Verdict: accepted gap, disclosed, not silently claimed as fully covered.** The success branch is 3 lines (`if (!error) router.push('/menu')`) exercising the same `updateUser` call already proven reachable; risk is low. Flagged in the Spec Compliance Matrix as `manual` with the real branches tested, rather than marked `covered` outright.
2. **The `/menu` CTA card reuses `border-2 border-primary` styling manually instead of a named `Card` variant.** Considered using the existing `insight` variant, but DESIGN.md explicitly reserves it for the Pro-tier learning-moat moment only ("diluting it into general-purpose highlight styling erodes the one signal"). Using `pro`'s exact border styling without the variant name keeps the visual weight without misusing a semantically-reserved token.
   - **Verdict: intentional, not a defect.**
3. **Pre-existing, unrelated observation (already flagged in FRESCO-17's review, confirmed again here):** the "Fresco aprendió" card in `/menu` is hardcoded static JSX (`app/(app)/menu/page.tsx`), not wired to any real per-user learning data — it renders for every plan unconditionally, including this session's brand-new anonymous guest. Not touched here; belongs to EPIC-FRESCO-5.

## Adjudication

Finding 1 is a disclosed manual-coverage gap (see compliance matrix), not a blocker — the untested branch is low-risk and mechanically identical to the two real branches that were tested. Findings 2-3 are non-issues / out of scope.
