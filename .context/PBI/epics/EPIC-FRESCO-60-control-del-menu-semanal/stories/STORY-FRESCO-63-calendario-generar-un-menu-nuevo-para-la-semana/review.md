# Review — FRESCO-63

Solo mode, self-review (fresh-eyes pass over the diff before commit).

## Diff

- `components/menu/no-menu-empty-state.tsx`: new optional `action?: ReactNode` prop, defaulting to the existing "Generar mi menú" → `/onboarding` link. `/menu`'s call site is unaffected (no prop passed).
- `components/calendar/generate-week-button.tsx` (new, `'use client'`): calls `generateMealPlan()` for the viewed week, `router.refresh()` on success.
- `app/(app)/calendar/page.tsx`: passes `GenerateWeekButton` as `NoMenuEmptyState`'s `action` override in the empty-state branch.

## Findings

None legitimate. Considered and dismissed:

- **Fork a second empty-state component for `/calendar` instead of extending `NoMenuEmptyState`?** Dismissed — the underlying `EmptyState` primitive already supports an `action` override; `NoMenuEmptyState` just never exposed it. Extending it is a smaller, safer diff than a parallel component that could drift from the shared copy/icon.
- **New Edge Function or migration for "generate for an arbitrary week"?** Dismissed — `generate-meal-plan` already takes an explicit `semana_iso`/`fecha_inicio` (confirmed at FRESCO-60's Stage 1, re-confirmed here) and already 409s on an existing plan. Zero backend changes needed.
- **Skip the defensive `409` handling since the button never renders when a plan exists?** Dismissed — a stale page (open in another tab, or a `router.refresh()` race) could still hit it; the Edge Function's own guard exists specifically for this, worth surfacing with a real message rather than falling through to the generic one.
- **Re-run the full onboarding wizard from `/calendar` instead of calling `generateMealPlan()` directly?** Dismissed — the story's own scope is explicit: "no solo la primera generación de onboarding." The profile already exists; re-onboarding would re-collect data that's already stored and wouldn't let the button target the currently-viewed (possibly non-current) week at all.

## Live-UI verification

Ran against the real dev server + the shared QA test account (no plan for any week at the time), **real Gemini generation, not mocked**:

- Clicked "Generar mi menú" directly from `/calendar`'s empty state (current week): the page stayed on `/calendar` (no redirect to `/onboarding` or `/menu`) and rendered a real 21-slot generated menu after ~8s — confirms the story's core promise (generate without leaving `/calendar` or re-onboarding).
- After generation, the delete button (FRESCO-62) reappeared and the generate button correctly disappeared — same structural guarantee pattern already used for FRESCO-62's "no hay nada que eliminar" scenario, now proven for the inverse case too.
- AC Scenario 3 (generation fails) not independently re-triggered live in this pass — the exact same 422/generic error-handling shape was already live-validated in an earlier session against `app/onboarding/page.tsx`'s `handleGenerate()` (same messages, same `EdgeFunctionError` check), and this component reuses that logic verbatim rather than reimplementing it.
- Test plan deleted as part of the verification itself (same convention as FRESCO-62) — DB left clean, no manual cleanup needed.
