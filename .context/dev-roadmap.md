# Dev Roadmap — placeholder

> **Run `/dev-roadmap` (Claude Code command) to populate or refresh this file.**

This file is the canonical **ticket-level dependency execution roadmap** for this repo — the operational view of "which Jira ticket do we work next, and what is blocking it?". It sits **below** `master-implementation-plan.md` (epic strategy) and **above** the per-story `implementation-plan.md` files. It subsumes the topological execution-sprint sort that earlier boilerplate versions wrote to `.context/PBI/sprint-sequence.md`.

- **Hard requirement**: at least one epic with child stories (and their dependency links) must exist in the issue tracker before the generator runs.
- **Soft inputs**: `.context/business/business-data-map.md` §2 (epic backbone), `.context/design/master-design-plan.md` §8 (mockup-gates), `.context/master-implementation-plan.md` §4–§5 (Master Sprint grouping).
- **Consumed by**: `/sprint-development` (Phase 0 — "what's next" + dependency context; bootstraps this file if missing), `/product-management` (cascades here after backlog seed / feature add / epic creation), and any human reading the dev roadmap.

Once generated, this file replaces the placeholder with the full structure: authority split (§1), epic backbone (§2), story dependency graph (§3), execution sprints (§4 — Kahn topological sort), mockup-gate registry (§5), a live-status query recipe (§6 — status is never frozen here), and the maintenance protocol (§7).

See `.claude/commands/dev-roadmap.md` for the exact output contract, the surgical-merge UPDATE rules (regenerate §4, preserve hand-authored §2/§3/§5/§6), and the subsumption note for `sprint-sequence.md`.
