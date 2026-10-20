---
id: project
title: "Project instructions"
load_when: "anything specific to this project: its own rules, conventions, exceptions and its reading of shared doctrine"
triggers: ["bit[aá]cora", "feature[- ]?map", "git:promote", "promot(e|ion)", "promoci[oó]n"]
paths: [".context/bitacora.md"]
---

# Project instructions

> Section `project` of the project instructions: the PROJECT-OWNED overlay. Every other file in `.agents/instructions/` is shared doctrine that `bun sync` keeps in step with the boilerplate; this one holds what is true only for this repository, and no sync ever touches it. A rule here may narrow a shared rule for this project and must say which one; it never silently contradicts a Critical Rule.

<!-- Add one `##` heading per topic. Name the source of truth for any value that changes (Critical Rule #17); keep values themselves in `.agents/project.yaml` or the tracker. -->

## Project rules (each narrows a shared Critical Rule)

<!-- binds-in-section: project-owned narrowings of Rules 4, 11, 12 and 14; the L0 binding sentence of each rule stays in AGENTS.md -->

### Communication mode: caveman (narrows Rule 11)

The owner runs the `caveman` plugin at user level. When `~/.claude/skills/caveman/` is installed, reply in caveman level `full` by default: drop articles, fillers and pleasantries, fragments are fine, technical terms stay exact. Revert to plain prose only when the user asks for it ("normal mode", "habla normal", "stop caveman", "be verbose", "más detallado" or a clear equivalent). Code, commits, PR bodies and security warnings are always written in full sentences, as Rule 11 requires. Plugin not installed: this heading is a no-op, so no reply depends on it.

### Jira artifacts are written in Spanish (narrows Rule 12)

Every Jira issue and comment (epics, stories, acceptance criteria, scope, descriptions) is written in Spanish by default. This is a standing project override of the English default for tracker artifacts, not a per-ticket request, and it holds until the owner says otherwise. Every other repo artifact (code, commits, PRs, branch names) stays English.

### UI stories: no hard stop on a missing screen row (narrows Rule 14)

A story with UI whose screen has no row in `.context/design/master-design-plan.md` §8, or no plan at all, does NOT stop the work. Build live-UI-first against the current live UI, the `DESIGN.md` tokens and the Jira mockup, then add the screen's §8 row, plus a §5 divergence note if the build departed from a mockup, as part of the story. Hard-stop only when the screen is genuinely novel (no analog anywhere in the live UI AND no mockup), and then offer Rule 14's options (a), (b) and (c). Hand-authoring a mockup outside a design skill stays forbidden. Full contract: `.agents/skills/agentic-dev-core/references/ui-fidelity-doctrine.md`.

### Promotion to `main` (narrows Rule 4)

Whatever `git_strategy.policy.direct_push_to_protected` resolves to, a promotion to `main` runs through `bun run git:promote`: dry run first, `--yes` only after the user confirms. Never promote a SHA without a finished green staging PR Check, never with a placeholder identity, never a code commit without its `(#PR)`. The script and `docs/workflows/promotion.md` own the mechanics; the accepted host divergence and its compensating control live in `git_strategy.policy.accepted_divergences` of `.agents/project.yaml`.

### Supabase MCP is read-only and scoped to one project (narrows `[DB_TOOL]`, Rule 9)

`.mcp.json` launches the Supabase MCP with `--read-only --project-ref=<db_project_ref of .agents/project.yaml>` and an exact package version (FRESCO-1017). Reads (`execute_sql` with a `SELECT`, `list_tables`, `get_advisors`, `query_logs`, `list_migrations`) work; `apply_migration`, `deploy_edge_function` and any write do not. A schema change goes through the Supabase CLI (`stack.database.migrations_tool: supabase-cli`: `supabase db push --linked`, dry run first), and an Edge Function deploys from CI. Account tools (`list_projects`) are off because the server is project-scoped. The pins live in `cli/lib/agent-compatibility-contracts.ts` (on `updater.protected_paths`) and `scripts/mcp-pinned-versions.test.ts` fails on an unpinned package, so a bump is a reviewed diff there plus the three MCP configs.

## Session log: `bitacora.md`

Append one entry to `.context/bitacora.md` ONLY when a session completes a Jira story, resolves a critical bug or ships a deploy. Never for trivial work, text edits or exploratory sessions.

<!-- binds-in-section: the parent CLAUDE.md and AGENTS.md carry the trigger on every session; this section holds the mechanics -->

- **Append blind**: `echo` a block with the shape `## <date> - <short title>` then `- Qué: ...`, `- Por qué: ...`, `- Siguiente: ...` into the file. NEVER read the file before writing.
- **Verify the last entry**: only with `tail -n 10 .context/bitacora.md`, never a full read.
- **Rotate** when the file passes 50 entries: `mv` it to `.context/bitacora-<range>.md` and restart `bitacora.md` with its header plus the last ~15 entries, never empty.
- The parent `CLAUDE.md` and `AGENTS.md` ("Session logging") point here as the source of truth for the trigger. If one says "every session", that is drift: fix it toward this section.

## Feature map sync: `business-feature-map.md`

Update the business feature map ONLY when an entire Epic closes or a major new business capability ships. Never for bugs, refactors or UI tweaks.

<!-- binds-in-section: project-owned trigger for the feature map; no shared rule carries it -->

- Read only the section of the domain being changed (a table, not the whole file), update it and rewrite that section. Do it when the story closes; skip it when the change is trivial.
- Refresh the whole map through `/project-context` mode `features`, not by hand.

## Git Strategy (this repository)

None recorded yet. `git-flow-master` reads the strategy and its policy from the `git_strategy:` block of `.agents/project.yaml`; an exception this project accepts on purpose (a host rule it bypasses, a divergence it keeps) is written here, with its reason, by the people who decided it.

## Project context skills

The `<aspect>-context` skills this project created (`/project-context context-skill`), one row each. The prompt hook routes a prompt that matches a row's Triggers to that skill's `SKILL.md`, and `bun run docs:check` counts a skill listed here as rostered. This file survives `bun sync`, so a row here keeps routing after every update; the shared skills section does not. Triggers are backticked, case-insensitive regexes separated by commas; write a `|` inside one as `\|`.

<!-- project-skills:start -->
| Skill | Load when | Triggers | Loaded by |
| --- | --- | --- | --- |
| `brag` | turning the project website into a short shareable launch video | `/brag`, `launch video`, `make a launch video` | the user |
| `resend-cli` | sending or managing transactional email through the Resend CLI | `\bresend\b`, `transactional email` | the user |
<!-- project-skills:end -->
