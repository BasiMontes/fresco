# UI Fidelity Contract — Full Reference

> Loaded on demand by `/sprint-development` for any story with UI. `CLAUDE.md` §1 rule 14 holds the compressed pointer.

## Base contract

Story has UI + `.context/design/master-design-plan.md` exists → look the story up in §8 (US→Screen map) → open §4 screen spec + §2 frozen tokens → build against the physical mockup in `.context/designs/<project-slug>/<batch-slug>/`. NEVER invent UI. Unratified divergence from the mockup = defect (review gate).

Story missing from §8 → STOP and choose:

- (a) just-in-time mockup via `/design-system` screen phase (generates a portable design brief, user takes it to Claude Design / Open Design, bundle returns to the drop zone)
- (b) ratify a spec-only build in §5 (+ ADR if architectural)
- (c) explicit user-approved DESIGN.md-only build

No plan at all → DESIGN.md-only fidelity (tokens, no screen reference). AI NEVER generates mockups (design-system D7) — briefs out, human designs, bundles in.

## Live-UI-first (refines design fidelity)

The CURRENT LIVE UI is the source of truth for fidelity, NOT the mockup. Mockup = INSPIRATION to stay close to or improve upon, adapted to what already exists. Therefore:

1. Before building UI, INSPECT the current live components and REUSE them.
2. Never blind-copy the mockup where it conflicts with the improved live UI.
3. Navigation — how a user reaches and moves through the app — is paramount for UX.
4. If the mockup has something genuinely good the live UI lacks, do NOT force it into the current story — file it as a future tech-story / tech-debt.

Live-UI validation (`/sprint-development`) checks consistency with the current app + design system, not pixel-match to the mockup. Composes with — does NOT replace — the mockup/ADR ratification machinery above: a deliberate departure with no mockup is still recorded as a §5 spec-only divergence (+ ADR if architectural).
