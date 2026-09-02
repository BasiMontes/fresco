# FRESCO-404 — Definition of Done (A4-PROC)

Audit-4, epic FRESCO-359, ola-3. Spawned from FRESCO-392. Docs + Jira only, zero code.

## What shipped

| Item | Where |
|------|-------|
| Full DoD policy — principle, close gates per ticket kind, accepted-residue escape hatch, plug-in points, revisit triggers | `.context/backlog/definition-of-done.md` (new) |
| `audit-process.md` §3 now points to the DoD doc (was "owned by FRESCO-404 once it lands") | `.context/audits/audit-process.md` |
| `bug-fix-workflow.md` FRESCO-313 gate framed as the defect-specific instance of the DoD | `.claude/skills/sprint-development/references/bug-fix-workflow.md` |
| New Gotcha 17 in `/sprint-development` — DoD close policy, Gotchas 13–15 as the defect instance | `.claude/skills/sprint-development/SKILL.md` |

## Notes

- Home chosen: `.context/backlog/` sibling of `estimation-and-tracking-model.md`
  (both: process policy, revisitable, explicitly "not an ADR"). ADR route rejected —
  a close-gate is not architectural + hard-to-reverse.
- No CLAUDE.md edit — wiring stays in the skills that drive transitions.
- Origin: FRESCO-392 had to re-verify FRESCO-282/313/320/328, all closed
  forward-only ("mechanism exists" ≠ "done").
