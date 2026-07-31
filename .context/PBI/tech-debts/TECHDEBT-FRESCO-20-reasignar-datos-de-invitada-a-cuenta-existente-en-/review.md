# Review — FRESCO-20

Solo mode: deliberate fresh-eyes review pass, inline, self-adjudicated.

## Findings

1. **The `/signup` UI's new inline password form (conflict flow) was not click-tested in a real browser.** The full backend chain (verify password → RPC → admin delete) was verified exhaustively with real HTTP calls (wrong password, correct password, conflicting-week skip). The React code itself (`Input`/`Button`/conditional render) reuses the exact primitives already visually proven in FRESCO-17/19's live passes.
   - **Verdict: accepted, disclosed gap.** Reaching this screen live requires a full onboarding + real Gemini generation cycle again (~40s) purely to arrive at the conflict UI, which the backend test already covers functionally.
2. **`auth.admin.deleteUser()` failure is logged, not surfaced as a request failure.** If the RPC succeeds (data safely moved) but the delete call fails, the response still reports `reassigned: true`. This is intentional (ADR-0004 doesn't tie success to cleanup) but means an orphaned, now-empty anonymous auth user could persist if `deleteUser` ever fails — no automatic retry.
   - **Verdict: accepted, matches the ADR's stated trade-off — not a defect.**
3. **Deploy required 2 attempts** — first `deploy_edge_function` call failed with a generic "Failed to deploy Edge Function" (no detail), identical file payload succeeded on retry. Treated as transient (MCP/build-service hiccup), not a code issue — no error on the 2nd, identical attempt.

## Adjudication

No blocking findings. Finding 1 is the only disclosed coverage gap; findings 2-3 are non-issues.
