# Changelog

All notable changes to this boilerplate are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking

- Hardcoded `customfield_NNNNN` references in the `product-management` skill replaced by `{{jira.<slug>}}` slug references. Downstream repos must re-run `bun run jira:sync-fields` to refresh `.agents/jira-fields.json`.
- "Wave" terminology retired across the `product-management` skill, the `master-implementation-plan` slash command, and the `.context/master-implementation-plan.md` template. Replaced with "Sprint" / "Master Sprint" / "Execution Sprint" (see Glossary in `SKILL.md` for disambiguation).
- Acceptance Criteria, Scope, and Out-of-Scope content removed from story description templates. Those now live exclusively in dedicated Jira custom fields (`{{jira.acceptance_criteria_gherkin}}`, `{{jira.scope}}`, `{{jira.out_of_scope}}`). Existing stories with duplicated content require a manual dedup pass.
- Workflow skill content is now tool-agnostic — every literal `acli ...`, `mcp__atlassian__...`, or `curl ... /rest/api/3/...` command stripped and replaced with `[ISSUE_TRACKER_TOOL]` pseudo-code per the `CLAUDE.md` Tool Resolution table.

### Added

- New slugs in `.agents/jira-required.yaml`:
  - `out_of_scope` (required custom field — explicit exclusions, complementary to `scope`).
  - Top-level `statuses:` section with `epic_default` (literal default `Planning`) and `story_default` (literal default `Shift-Left QA`).
  - Top-level `link_types:` section with `required.dependencies` (outward `depends on`, inward `is dependency for`, fallback `relates`) and `required.blocks` (Jira built-in synonym), plus optional `relates`, `causes`, `tested_by`.
- Five new reference files under `.claude/skills/product-management/references/`:
  - `jira-operations.md` — tool-routing decision table for every Jira operation.
  - `dependency-linking.md` — when / how / direction semantics for issue links.
  - `description-custom-field-dedup.md` — single-source-of-truth contract.
  - `sprint-sequencing.md` — Kahn's topological sort over the dependency graph.
  - `jira-publishing-gotchas.md` — two known ADF bugs and workarounds.
- 14 explicit anti-patterns enumerated in `SKILL.md` (I1–I14).
- New top-level workflow `H — Sprint sequencing (topological execution order)` in `SKILL.md`.
- New script binding `bun run jira:sync-link-types` (stub — full implementation deferred to follow-up PR).
- New CI lint checks: hardcoded `customfield_NNNNN` blocked; `FR-XXX —` summary prefix blocked; literal tool commands blocked; `{{jira.*}}` slug references validated against `.agents/jira-required.yaml`; "Wave" terminology blocked.

### Changed

- Workflows A (initial backlog seed), B (incremental feature), and C (epic creation) now mandate post-create status transitions (epic → `Planning`, story → `Shift-Left QA`), the dependency-linking phase after multiple stories exist, the cross-story Scope overlap check per epic, and the sprint-sequencing terminal phase.
- Workflow D (story refinement) ready-for-dev checklist now includes the deduplication audit and dependency-link verification.
- `master-implementation-plan` slash command and template renamed "Wave N" headers to "Master Sprint N".

### Migration — for downstream repos cloned from earlier boilerplate

1. Pull the boilerplate update: `bun run boilerplate:update` (or your repo's equivalent sync command).
2. Refresh the custom-field catalog: `bun run jira:sync-fields`.
3. Validate the workspace declares all required slugs: `bun run jira:check`. Expect a WARN for missing `.agents/jira-link-types.json` until the follow-up PR ships.
4. Audit existing Jira stories: run the dedup audit per `references/description-custom-field-dedup.md` — strip Acceptance Criteria / Scope / Out-of-Scope H2 sections from descriptions where the content already lives in the dedicated custom fields.
5. Rename `## Wave N` headers in existing `.context/master-implementation-plan.md` outputs to `## Master Sprint N`.
6. Re-read `.claude/skills/product-management/SKILL.md` glossary for the Master Sprint vs Execution Sprint distinction before running `/master-implementation-plan` or `/product-management` again.

### Deferred (next PR)

- Implementation of `scripts/sync-jira-link-types.ts` (binding declared as a stub in this PR).
- Fix for the `md-to-adf.ts` `code` + `strong` mark combination bug (lives in the `acli` skill).
- Execution Sprint visualization (Gantt / dependency-graph render).
