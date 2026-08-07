# Comments for FRESCO-119

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-119)

---

### Basi Montes - 8/7/2026, 10:18:29 AM

## Spec Implementation Plan (Dev)

### Root cause

`components/ui/segmented-control.tsx` renders each `role="radio"` as a plain `<button>` with no `tabIndex` management and no keyboard handler — every option is a normal Tab stop, and arrow keys do nothing. ARIA APG's `radiogroup` pattern expects roving tabindex (only the checked option, or the first if none checked, is Tab-reachable) plus left/right arrow keys to move both focus and selection.

### Fix

- Roving tabindex: `tabIndex={0}` on the checked option (or index 0 when nothing is checked yet), `-1` on the rest.
- `onKeyDown` on each radio: ArrowLeft/ArrowRight move to the previous/next option (wrapping), call `onChange` AND move DOM focus to the newly-selected button (`useRef` array).

### Test

No component-testing infra in this repo (no testing-library/DOM for `bun test`). Verified live via Playwright CLI against `/recipes`: confirmed only the checked radio has `tabindex="0"`, ArrowRight moves check+focus to the next option, ArrowLeft from index 0 wraps to the last option.

### Out of scope

Home/End key support (APG-recommended but not in this ticket's stated scope).

---


_Synced from Jira by sync-jira-issues_
