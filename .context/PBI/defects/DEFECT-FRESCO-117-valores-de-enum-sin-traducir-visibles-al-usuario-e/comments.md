# Comments for FRESCO-117

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-117)

---

### Basi Montes - 8/7/2026, 10:39:43 AM

## Spec Implementation Plan (Dev)

### Root cause

`recipe-card.tsx` and `recipe-detail.tsx` rendered `recipe.meta?.coste*estimado` / `dificultad` raw — snake*case enum values (`muy*bajo`, `muy*facil`) leaking into a 100%-Spanish UI. `DIETA_LABELS` already solves this for `dieta`, just never extended to these two fields.

### Fix

Added `COSTE*ESTIMADO*LABELS` and `DIFICULTAD*LABELS` (same file as `DIETA*LABELS`, `recipe-card.tsx`), exported, consumed in both `recipe-card.tsx` and `recipe-detail.tsx`.

### Out of scope

`shopping-list-view.tsx`'s `coste*estimado*min/max` — a different, numeric field, not this enum. The missing-space bug on the card's meta line ("30 min ·alto") is FRESCO-116, a separate ticket — left untouched here.

### Test

Verified live via Playwright on `/recipes` and a recipe detail page.

---

### Basi Montes - 8/7/2026, 10:47:35 AM

## Implementation note (found live during Stage 2)

The initial fix (adding `COSTE*ESTIMADO*LABELS`/`DIFICULTAD*LABELS` next to `DIETA*LABELS` inside `recipe-card.tsx`) silently didn't work on `/recipes/[id]` — Playwright showed "20 min · ·" (both labels rendered empty), while the `/recipes` list page worked fine.

Root cause: `recipe-card.tsx` has `'use client'` at the top. `recipe-detail.tsx`'s `CatalogRecipeDetail` is a Server Component. A Server Component importing a plain data export (not a component) from a `'use client'` module gets a client-reference stub at runtime, not the real object — confirmed via a temporary debug dump (`JSON.stringify(DIFICULTAD_LABELS)` printed `{}` server-side). This is a real, silent trap: no build error, no type error, just empty renders.

This same bug was ***already live*** for `DIETA_LABELS` (imported the same way, pre-existing) — the recipe detail page's diet tags (`activeDietaLabels`) have never rendered for catalog recipes, since `Object.keys({})` is always `[]`. Confirmed via live SQL + Playwright: this recipe's real `dieta` has 7 active flags; the detail page showed 0 tags before the fix, all 7 after.

Fix: moved `DIETA*LABELS`, `COSTE*ESTIMADO*LABELS`, `DIFICULTAD*LABELS`, `firstActiveDietaLabel` out of `recipe-card.tsx` into a new plain module `lib/recipes/labels.ts` (no `'use client'`), safe to import from both server and client components. Updated all 4 call sites (`recipe-card.tsx`, `recipe-library.tsx`, `calendar-grid.tsx`, `recipe-detail.tsx`).

---


_Synced from Jira by sync-jira-issues_
