**Ticket:** FRESCO-247
**PR:** #110 (`feat/FRESCO-247-modal-transitions` → `staging`)
**Reviewer:** independent adversarial subagent (fresh context, no stake in the implementation)

---

## Findings + adjudication

### BLOCKER — Open transition never plays (`components/ui/dialog.tsx`)

**Verdict: LEGITIMATE.** Empirically confirmed via live dev-server + Playwright DOM sampling (`getComputedStyle` polled every ~15ms from 4ms to 318ms post-click on the real legal modal) — the element is at its final `scale(1)/opacity:1` state on the very first sample, never an intermediate value. Root cause: the modal is portal-mounted fresh on every open, and React applies `.is-open` in the *same commit* that creates the DOM node — no prior painted frame exists for the browser to transition from. The `06-modal.md` reference snippet assumes the node is always present and only toggles classes; porting that pattern onto a conditionally-mounted React node breaks the assumption. Close works correctly (node already exists, class swap is a real style change on a live element).

Directly fails AC Scenario 1 ("el modal aparece con una transición suave"). Sent back to Stage 2 via `fix-issues.md`.

### MINOR — "6 modal call sites" undercounts by one (`ayuda-section.tsx`)

**Verdict: LEGITIMATE, low priority.** `ayuda-section.tsx` renders `<Dialog>` twice (`configuracion` + `faq`) — 6 files, 7 instances. Each instance is independently stateful (no shared-state race), so this doesn't change correctness, only the plan/story's own counting. Fix alongside the blocker fix (correct the comment mentioning "6" if trivial; not worth a separate pass).

### Everything else — reviewed, no issues found

- AC Scenario 2 (rapid open/close/reopen): traced exhaustively, ref-guarded timeout correctly prevents stale unmount in every ordering, including component-unmount-while-timer-pending (cleanup clears the ref'd timeout, no setState-on-unmounted leak).
- `readCssDurationMs`: verified against `150ms`/`0.15s`/`.15s`/`0s`/empty/malformed — no NaN/silent-zero trap. Chromium's `s`-serialization behavior independently confirmed live.
- CSS: `.t-modal`/`.is-open`/`.is-closing`/reduced-motion block byte-for-byte identical to `06-modal.md`. `_root.css` token block's 203 values match exactly (cosmetic reflow only). No `transition: all`, `will-change` preserved.
- Scope: tight to `app/globals.css` + `dialog.tsx` + `.impeccable/config.json` (bounce-easing suppression for the vendored tokens, user-confirmed) + the PBI doc-sync commit. No unrelated changes.
- Security: no secrets, no unsafe DOM APIs.
- Code standards / data-testid: conform.

## Next step

Fix dispatched to Stage 2 (`fix-issues.md`) for the BLOCKER (two-frame-commit pattern or permanently-mounted-hidden-node pattern) + the MINOR count correction. Re-verify empirically with the same DOM-sampling methodology before re-requesting review, not just trusting the code reads correctly.
