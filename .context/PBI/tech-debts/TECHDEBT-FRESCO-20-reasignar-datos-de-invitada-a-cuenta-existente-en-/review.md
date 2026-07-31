# Review — FRESCO-20

Solo mode: deliberate fresh-eyes review pass, inline, self-adjudicated.

## Findings

1. ~~The `/signup` UI's new inline password form (conflict flow) was not click-tested in a real browser.~~ **Closed.** Full live click-through done: fresh guest → real onboarding → real Gemini generation (same week as the existing test account, forcing the conflict) → `/signup` → wrong-then-arbitrary email typed triggers the conflict card → password field renders, button correctly starts `disabled` and enables once a password is typed → clicked "Continuar con esta cuenta" with the real account's password → redirected to `/menu` as the real account. DB re-checked after: target still has exactly 1 plan (its original week), no duplication or corruption. No console errors beyond the same pre-existing, unrelated cosmetics already flagged (favicon 404, logo aspect-ratio warning).
2. **`auth.admin.deleteUser()` failure is logged, not surfaced as a request failure.** If the RPC succeeds (data safely moved) but the delete call fails, the response still reports `reassigned: true`. This is intentional (ADR-0004 doesn't tie success to cleanup) but means an orphaned, now-empty anonymous auth user could persist if `deleteUser` ever fails — no automatic retry.
   - **Verdict: accepted, matches the ADR's stated trade-off — not a defect.**
3. **Deploy required 2 attempts** — first `deploy_edge_function` call failed with a generic "Failed to deploy Edge Function" (no detail), identical file payload succeeded on retry. Treated as transient (MCP/build-service hiccup), not a code issue — no error on the 2nd, identical attempt.

4. **Minor a11y nit found during the live pass**: the conflict-flow password `Input` isn't wrapped in a `<form>` (only the original signup form is) — browser DevTools logs a verbose "Password field is not contained in a form" note. No functional impact (the button's `onClick` handler works regardless), but worth a follow-up pass for autofill/accessibility hygiene.
   - **Verdict: cosmetic, not blocking. Not fixed here — out of this task's scope.**

## Adjudication

No blocking findings. Finding 1 is the only disclosed coverage gap; findings 2-3 are non-issues.
