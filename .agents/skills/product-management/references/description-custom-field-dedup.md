# Description ↔ Custom Field Deduplication

> **Purpose**: Codify the single-source-of-truth contract between the Jira issue description body and the dedicated rich-text custom fields. Scope / Out-of-Scope content lives in its own custom field, NEVER in the description body. The acceptance criteria are the exception (FRESCO-1253): they live in the description under `## Criterio de cierre`, NEVER in the legacy `{{jira.acceptance_criteria}}` field. The downstream product backlog surfaced widespread duplication during Pass 2 refinement — every workflow that writes to a story must respect this contract or the duplication returns.
> **Use when**: Authoring a new story, refining an existing one, or auditing a story before the ready-for-dev gate.
> **Companion references**: `story-refinement.md` (ready-for-dev gate calls the audit below), `acceptance-criteria.md`, `epic-creation.md`, `add-feature.md`, `product-backlog-seed.md`, `jira-publishing-gotchas.md` (publishing edge cases).

---

## Why this contract exists

Storing a concept in two places creates two copies that drift: a "which one is correct?" coin toss. One canonical home per concept. Scope / Out-of-Scope live in their custom fields. The acceptance criteria live in the description because the `{{jira.acceptance_criteria}}` field caps at 255 characters, which real Gherkin scenarios exceed; on the board, 77 % of the cards created since 2026-10-08 already carry them in the description and none in the field (audit 9, F1, FRESCO-1253). `scripts/sync-jira-issues.ts` reads the `## Criterio de cierre` section of the description into `acceptance-criteria.md`, and falls back to the legacy field only when the section is absent, so downstream consumers (sprint-report, sprint-development planning, QA test design) read the synced file and see the same text.

---

## Canonical body sections — what the description body SHOULD contain

In this order, top to bottom:

1. **`**Source spec:** FR-XXX`** — first line, optional. Use when the story maps 1:1 to a Functional Requirement. Omit when the story does not have a single FR owner.
2. **`## User story`** — As / I want / So that narrative. Always present.
3. **`## Business rules`** — overflow only. Use when content does not fit in `{{jira.business_rules_specification}}` (e.g. tables, long enumerations, embedded diagrams). The custom field remains canonical; this section explicitly references it.
4. **`## Workflow`** — overflow only. Same rule as Business rules: use when content does not fit in `{{jira.workflow}}`.
5. **`## Criterio de cierre`** — the acceptance criteria: Gherkin scenarios, each wrapped in a fenced ` ```gherkin ` block (anti-pattern `I17`). Always present on a story that is ready for development.
6. **`## Definition of done`** — closing checklist. Lives in the body because no dedicated field exists for it.
7. **`## Mockup`** — optional. Link or embedded image.
8. **`## Technical notes`** — optional. Architecture hints, library choices, migration notes for the implementing dev.

Anything not listed above does not belong in the description body.

---

## Sections that MUST NOT appear in the description body

| Forbidden section | Canonical home |
|---|---|
| `## Scope` | `{{jira.scope}}` |
| `## Out of scope` | `{{jira.out_of_scope}}` |

If you see either of these H2 headings in a description body, the story has a duplication bug. Run the audit below.

`## Acceptance criteria` in English is not forbidden any more, but the canonical heading is `## Criterio de cierre`; the sync also accepts `## Criterios de cierre`, `## Criterios de aceptación` and `## Acceptance criteria`, so use the canonical one on new stories. For cards written before the heading convention, the sync also reads an inline `Criterio de cierre:` label (up to the next heading) so their `acceptance-criteria.md` is not empty; new stories use the heading.

---

## Scope vs Out-of-Scope contract

`{{jira.scope}}` carries what the story IS doing — the in-scope bullet list, the affirmative boundary. `{{jira.out_of_scope}}` carries what the story is NOT doing — explicit exclusions, deferred work, things stakeholders might assume are included but are not. No cross-pollution between the two fields. Mixing in-scope bullets and out-of-scope bullets inside either field is a bug, even if the markdown is correctly labelled. Each field has one job.

---

## Deduplication audit procedure

Called from `story-refinement.md` ready-for-dev gate. Returns a structured report to the user.

1. Fetch the story via `[ISSUE_TRACKER_TOOL]`. Include the description body AND the dedicated custom fields: `{{jira.scope}}`, `{{jira.out_of_scope}}`, and the legacy `{{jira.acceptance_criteria}}`.
2. Parse the description body. Detect any of the forbidden H2 sections: `## Scope`, `## Out of scope`. Case-insensitive match.
3. For each forbidden section found:
   - Read the section content.
   - Read the corresponding canonical custom field.
   - Compare. If the content is already canonical (substantively identical or strictly contained) → mark as "safe to strip".
   - If the content is NOT canonical (description has more, or the custom field is empty) → **migrate first**: write the missing content into the custom field, then mark as "safe to strip".
4. Strip every forbidden section from the description body. Preserve everything else verbatim.
   - **Acceptance criteria**: the description must carry exactly one `## Criterio de cierre` section. If it is missing and the legacy `{{jira.acceptance_criteria}}` field has content, **migrate first**: write the field's content into a new `## Criterio de cierre` section of the description (same single write as step 5), and leave the legacy field untouched. If both exist and differ, surface the difference to the user instead of picking one.
5. Use `[ISSUE_TRACKER_TOOL]` to update the description — single write, no batching with the custom fields (see `jira-publishing-gotchas.md` Gotcha 2).
6. Surface to the user, in one structured report:
   - Which forbidden sections were detected.
   - For each: whether content was migrated to its canonical field, or was already canonical and simply stripped.
   - Final state: description body now follows the canonical layout.

If no forbidden sections are detected, return a one-line "description body is clean" and exit.

---

## Anti-patterns

- NEVER copy Scope / Out-of-Scope content into the description body "for visibility". Their custom fields ARE the visibility layer. The acceptance criteria are the reverse: they belong in the description body, and NEVER in the legacy `{{jira.acceptance_criteria}}` field.
- NEVER mix in-scope bullets and out-of-scope bullets inside the same field. Each field has exactly one direction.
- NEVER strip a forbidden section from the description without first verifying the content exists in the canonical custom field. Silent data loss is the worst outcome of this audit.
- NEVER batch the description update with the custom-field updates in a single MCP call — Gotcha 2 in `jira-publishing-gotchas.md` will reject it.
- NEVER run the audit on a story mid-implementation without coordinating with the dev — stripping AC from the description body while a dev has it open in another tab causes confusion. Audit at refinement time, not during execution.

---

## Hand-off

Refinement workflows (`story-refinement.md`, `add-feature.md` Phase 2B, `product-backlog-seed.md`) call this audit before transitioning a story to Ready for Dev. Sprint-report and other read-only consumers do NOT modify state, but they must still respect the contract: read Scope / Out-of-Scope from the dedicated custom fields and the acceptance criteria from the description's `## Criterio de cierre` section (through the synced `acceptance-criteria.md`), with the legacy field as a fallback only. Treating the description body as authoritative for Scope / Out-of-Scope is itself a bug — it accepts duplication that this audit is designed to eliminate.
