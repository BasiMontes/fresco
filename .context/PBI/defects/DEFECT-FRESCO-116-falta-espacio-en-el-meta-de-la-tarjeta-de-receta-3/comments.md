# Comments for FRESCO-116

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-116)

---

### Basi Montes - 8/7/2026, 10:51:51 AM

## Spec Implementation Plan (Dev)

### Root cause

`components/recipe/recipe-card.tsx` meta line had `min ·` directly followed by the coste_estimado expression, missing the explicit `{' '}` JSX has to render a real space between two expressions — `recipe-detail.tsx` already does this correctly in all 3 positions.

### Fix

One-line: added `{' '}` between `min ·` and the coste_estimado value.

### Test

Verified live via Playwright — was already spotted and noted (not fixed) while working FRESCO-117 in the same session.

---


_Synced from Jira by sync-jira-issues_
