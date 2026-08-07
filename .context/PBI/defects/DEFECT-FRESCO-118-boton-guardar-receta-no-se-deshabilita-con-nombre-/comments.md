# Comments for FRESCO-118

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-118)

---

### Basi Montes - 8/7/2026, 10:32:31 AM

## Spec Implementation Plan (Dev)

### Root cause

`components/recipes/create-recipe-form.tsx` submit button had `disabled={isSaving}` only, missing the `!isValid` guard that the component's own doc comment says it mirrors from `components/profile/nombre-form.tsx` (`disabled={!isValid || isSaving}`).

### Fix

One-line: `disabled={!isValid || isSaving}`, matching `nombre-form.tsx` exactly.

### Test

Verified live via Playwright: empty/whitespace-only name keeps the button disabled; typing a real name enables it.

---


_Synced from Jira by sync-jira-issues_
