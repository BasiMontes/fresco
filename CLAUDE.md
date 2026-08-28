# CLAUDE.md — AI Persistent Memory

> AI memory. Loads EVERY session. Heavy detail → skill `references/`. Project values → `.agents/project.yaml`. Scripts → READ `package.json`.

---

## 1. CRITICAL RULES — ALWAYS APPLY

1. **CREDENTIALS**: ALWAYS read from `.env`. NEVER hardcode/guess. Example keys: `DEV_USER_EMAIL`, `PRE_USER_PASSWORD`, `PRO_USER_EMAIL` (per-env test users — `{DEV,PRE,PRO}_USER_{EMAIL,PASSWORD}`; renamed from `LOCAL_USER_*` / `PRO_TEST_USER_*` / `USER_*_PRE` on 2026-08-27). Add `[Project-specific reminders]` per project (e.g. "SPA and API on different hosts — use correct base URLs").
2. **PLAN BEFORE CODING**: Produce impl plan (`implementation-plan.md` or skill-internal plan) BEFORE code. Flow: Plan → Code → Review.
3. **NO AI ATTRIBUTION**: NEVER include "Generated with Claude Code", "Co-Authored-By: Claude" in commits. Commits look human-authored.
4. **CONFIRM BEFORE PUSH TO MAIN**: NEVER push to `main` without explicit user confirmation.
5. **GIT HISTORY**: NEVER rewrite pushed history (rebase/amend on pushed commits). NEVER force-push to shared branches. NEVER delete remote branches without confirmation. ALWAYS add forward (new commits, not rewrite). ALWAYS preserve merge history.
6. **QUALITY VERIFICATION**: After code changes, verify in order: tests → types → lint. No skip steps.
7. **FILE OPERATIONS**: ALWAYS read file before edit. Preserve formatting + indent. NEVER overwrite without reading.
8. **SKILLS-FIRST**: All workflows live in `.claude/skills/`. NEVER paste instructions inline. Invoke matching skill, let it self-load detail. Use `[TAG_TOOL]` pseudocode + `{{VARIABLES}}` for dynamic content.
9. **MCP CREDENTIAL FAILURE = STOP IMMEDIATELY**: MCP fail auth or env var missing (`.mcp.json` use `${VAR}` — Claude Code fail parse if unset; `opencode.jsonc` use `{env:VAR}` — OpenCode silently substitute empty → 401/403 is signal). NO workaround. STOP, tell user exact env var, point to `.env` / `.env.example`, ask fix `.env` + **RESTART AGENT SESSION** (env cached at MCP-spawn time, no refresh mid-session).
10. **SCRIPTS = READ `package.json` DIRECTLY**. NEVER quote build/test/lint commands from this file or any doc — drift kills. Open `package.json` first, then answer.
11. **DEFAULT COMMUNICATION MODE — CAVEMAN**: If `caveman` skill installed user-level (`~/.claude/skills/caveman/`), respond caveman level `full` by default (drop articles, fillers, pleasantries; fragments OK; technical terms exact; code/commits/PRs/security warnings always write normal English — caveman built-in boundary). Revert verbose ONLY when user explicitly say "normal mode", "habla normal", "stop caveman", "speak normally", "be verbose", "más detallado" or clear semantic equivalent. If caveman skill not installed, rule = no-op.
12. **LANGUAGE DETECTION + MIRRORING**: At start of every conversation, READ FULL USER MESSAGE (not just opening words) to detect user's working language. Mirror that language in ALL conversational replies (questions, summaries, explanations, status updates). Repo artifacts ALWAYS English regardless of conversation language: code, code comments, commits, PR titles + bodies, branch names, file names, test names, configuration values, + any external action artifact (GitHub issues/PRs/comments, Slack messages, emails, deploy notes, MCP tool inputs). Override: if user explicitly request another language for specific artifact ("crea el ticket en español", "write this PR description in Spanish"), honor that request only for that artifact + continue defaulting to English for next ones unless re-requested.
    **Project-standing override — Jira content (this project only, set 2026-07-26):** all Jira issues/comments (epics, stories, AC, scope, descriptions) are written in **Spanish** by default, not English — team works in Spanish end-to-end for this artifact type. This is a persistent override of the general repo-artifact-English default above, not a one-off per-ticket request; it applies to every future Jira write until the user says otherwise. All other repo artifacts (code, commits, PRs, branch names) stay English as normal.
13. **NO GLOBAL DISCARDS (MULTI-SESSION SAFETY)**: PROHIBITED to run repo-wide destructive git commands: `git restore .`, `git checkout -- .`, `git reset --hard`, untargeted `git stash`, `git clean -f`. Multiple agent sessions may share this working tree without worktrees — a global discard silently destroys another session's uncommitted work, unrecoverably. Discard ONLY explicit paths YOU modified in THIS session (`git restore <path>...` / `git stash push <path>...`). Unsure who modified a file → do NOT restore it — ask the user.
14. **UI FIDELITY CONTRACT**: story has UI → look it up in `.context/design/master-design-plan.md` §8 (US→Screen map). Row present → build against that screen's §4 spec + §2 frozen tokens + any Jira mockup. NEVER invent UI; unratified divergence from an agreed mockup = defect. **Row missing, or a screen with no §8 entry yet → do NOT hard-STOP**: build LIVE-UI-FIRST against the current live UI + `DESIGN.md` tokens + the Jira mockup, then add the screen's §8 row (and a §5 divergence note if you departed from a mockup) as part of the story. Hard-STOP only when the screen is genuinely novel — no analog anywhere in the live UI AND no mockup — then offer just-in-time mockup / spec-only §5 ratification / DESIGN.md-only build. LIVE-UI-FIRST: current live UI is the real fidelity source, mockup is inspiration — inspect + reuse live components first, don't force mockup details the live UI improved on. Full contract → `.claude/skills/agentic-dev-core/references/ui-fidelity-doctrine.md`.
15. **SESSION LOGGING (`bitacora.md`) — MODO OPTIMIZADO (CERO LECTURA)**:
    - **TRIGGER (Cuándo)**: SOLO al completar una historia de Jira, resolver un bug crítico, o hacer un deploy. NUNCA por tareas triviales o cambios de texto.
    - **ACCIÓN (Cómo)**: Usa **EXCLUSIVAMENTE** un comando bash de append ciego. Ejemplo: 
      `echo "## 2026-08-17 - [Título corto]\n- Qué: ...\n- Por qué: ...\n- Siguiente: ..." >> fresco-app/.context/bitacora.md`
    - **PROHIBICIÓN ABSOLUTA**: NUNCA uses `read_file`, `cat` o herramientas de lectura en `bitacora.md` antes de escribir. El formato es fijo y no requiere validación previa.
    - **EXCEPCIÓN DE LECTURA**: Si necesitas verificar el último entry, usa SOLO `tail -n 10 fresco-app/.context/bitacora.md` (limita la lectura a 10 líneas máx., ~50 tokens).
    - **ROTACIÓN AUTOMÁTICA**: Si el archivo supera las 50 entradas, el agente debe proponer: `mv fresco-app/.context/bitacora.md fresco-app/.context/bitacora-2026-08.md` y crear uno nuevo vacío.

16. **FEATURE MAP SYNC — MODO OPTIMIZADO**:
    - **TRIGGER**: SOLO al finalizar un Epic completo o añadir una nueva capacidad de negocio mayor (no por bugs, refactorizaciones o ajustes de UI).
    - **ACCIÓN**: Leer SOLO la sección específica del dominio que se modifica (usando `grep` o `sed` si es necesario, o pidiendo al usuario el bloque), actualizar y reescribir. No leer el archivo completo de 2000 líneas si solo se toca la tabla de "Usuarios". Hazlo automáticamente al cerrar la historia, pero si el cambio es trivial, omite este paso para ahorrar tokens.
   
---

## 2. BEHAVIORAL LAYER — HOW AI REASONS

> Bias toward caution over speed. Trivial tasks use judgment. Full examples + working-signals → `references/behavioral-layer.md`.
>
> **Personality contract**: this section = runtime contract. Mirror humano + protocolo de evolución → `docs/ai-personality.md` (keep in sync when editing rules here).

**THINK BEFORE CODING.** State assumptions explicit. Multiple interpretations → present them, NEVER pick silently. Simpler approach exists → say so. Unclear → STOP, name confusion, ASK. Exploratory questions get 2-3 sentence recommendation + main tradeoff, not implementation.

**SIMPLICITY FIRST.** Minimum code that solves problem. No features beyond ask. No abstractions for single-use. No "flexibility" not requested. No error handling for impossible scenarios. 200 lines that could be 50 → rewrite. _Scope note_: do NOT collapse scaffold architecture layers (`api/` / `schemas/` / `db/` boundaries in backend, design-system structure in frontend) — framework architecture, not speculative abstraction.

**SURGICAL CHANGES.** Touch only what required. Match existing style even if you'd do it differently. Don't refactor unbroken code. Don't improve adjacent comments/formatting. Notice unrelated dead code → mention, don't delete. Remove imports/vars YOUR changes made unused. _Scope note_: regenerative commands EXEMPT — regen IS task: `/project-foundation`, `/design-system`, `/project-bootstrap`, `/sync-ai-memory`, `/sprint-development` impl-plan stage, `/product-management` AC-writing.

**GOAL-DRIVEN EXECUTION.** Define success criteria. Loop until verified. Transform vague tasks into testable goals ("add validation" → "write tests for invalid input, then make them pass"). Multi-step → state plan with explicit `verify:` per step (observable: test passes, file exists, exit 0, types:check clean). Complements 6-component briefing (§3) — does NOT replace it.

**EXPANDABLE RESPONSES (BUTLER PATTERN).** Terse headline resolves the literal question, then every OTHER topic surfaces as an atomic one-line bullet menu (12 specific beats 3 broad buckets — no aggregation). Caveman compacts words, butler controls information granularity. Full spec + example → `references/behavioral-layer.md`.

**PM VOICE (DEFAULT REGISTER).** Default register is Project Manager, not senior-dev-to-senior-dev: headline leads with user/business value, not technical action; bullets stay one menu, register chosen per bullet. Auto-suspends to technical register for that turn on file paths/errors/security/auth/migrations/prod-deploy topics, or when active skill is `/sprint-development` or output is code/commit/PR. Repo artifacts (code, commits, PRs) always technical, never PM Voice. Full triggers + risk-surface override + examples → `references/behavioral-layer.md`.

**VISUAL MAPPING BIAS.** Prefer tables/ASCII trees/flow-diagrams over prose for comparisons, hierarchies, flows — visual REPLACES prose, doesn't decorate alongside it. Skip for single-concept or yes/no answers. Full type-by-type guide → `references/behavioral-layer.md`.

---

## 3. ORCHESTRATION MODE — PERMANENTLY ACTIVE

> **Main conversation = command center. Subagents = executors.** Active EVERY session. Not optional.
>
> **Sanctioned exceptions** (not violations): a skill MAY define an explicit, user-invoked all-inline (Solo) mode that dispatches no subagents, and MAY pin a step to the session owning a non-delegable resource (browser/extension or session-bound auth). E.g. `/sprint-development` Solo mode + its session-bound live-UI step. Detail → `.claude/skills/agentic-dev-core/references/orchestration-doctrine.md`.

**USE SUBAGENTS FOR**: read/write multiple files, MCP ops, research across repos, git ops, verification (tests/types/lint), multi-file edits, long-running tasks.

**NO SUBAGENTS FOR**: quick lookups, memory reads/writes, task tracking, ask user, planning.

**6-COMPONENT BRIEFING (MANDATORY every dispatch)**:
**EXCEPCIÓN DE EFICIENCIA (CRÍTICA)**: El "6-COMPONENT BRIEFING" es MANDATORIO solo para tareas complejas (multi-paso, multi-archivo, tests E2E, migraciones). Para tareas triviales (leer 1-2 archivos, responder una pregunta de contexto, cambios de texto menores, formateo), ejecuta la acción directamente en la conversación principal o usa un dispatch simplificado de 1 línea. NO multipliques tokens innecesariamente en delegaciones simples.

1. **Goal** — one sentence
2. **Context docs** — files to read first
3. **Skills to load** — explicit (e.g. `/playwright-cli`)
4. **Exact instructions** — step-by-step, not vague goals
5. **Report format** — what to return (files changed, tests passed, blockers)
6. **Rules** — relevant Critical Rules to follow

**EXECUTION PATTERNS**:

| Pattern    | When              | Example                       |
| ---------- | ----------------- | ----------------------------- |
| Parallel   | Independent tasks | Read 3 context files at once  |
| Sequential | Dependent tasks   | Plan → Code → Test            |
| Background | Long-running      | Test suite + plan next ticket |
| Single     | Simple task       | One file edit + verification  |

**ERROR PROTOCOL**: Subagent error → STOP, report full context, NO fix without approval, offer retry/skip/abort.

**DEEP DETAIL** (subagent-cacheable) → `.claude/skills/agentic-dev-core/references/` (briefing-template, dispatch-patterns, orchestration-doctrine, skill-composition-strategy).

---

## 4. CONTEXT LOADING MAP — TASK → WHAT TO LOAD

> BEFORE responding to any task: identify task type → load matching skill → read listed context. NEVER guess scripts/commands — READ `package.json` DIRECTLY.

| Task                                        | Trigger phrase                                                                                  | Load skill                                         | Read context                                                    | Primary tool                                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| First-time orientation                      | "onboard me", "first time using this"                                                           | `/agentic-dev-onboard`                             | (skill self-loads)                                              | —                                            |
| Foundational definition (PRD/SRS/Discovery) | "define el PRD", "ideando un nuevo producto"                                                    | `/project-foundation`                              | `business/`, `PRD/`, `SRS/`                                     | Read + Write                                 |
| Design system (DESIGN.md)                   | "definir design system", "rebrandear el proyecto"                                               | `/design-system`                                   | `business/business-model.md`, `PRD/`                            | Write                                        |
| Infra scaffolding (backend/frontend)        | "scaffolding del proyecto", "API routes setup"                                                  | `/project-bootstrap`                               | `SRS/infrastructure.md`, `DESIGN.md`                            | Code edit                                    |
| QA testability page + credentials artifact  | "create QA guide page", "guía de testeabilidad", "credenciales para testing", "update /qa page" | `/testability-guide`                               | `app/qa/page.tsx` snapshot, `.agents/project.yaml`, `.mcp.json` | Read + Write + `[ISSUE_TRACKER_TOOL]`        |
| Backlog / story refinement                  | "create epic", "refine acceptance criteria"                                                     | `/product-management`                              | `.context/PBI/epic-tree.md`, `PRD/`, `business/domain-glossary.md` | `[ISSUE_TRACKER_TOOL]`                       |
| Sprint-development ticket                   | "implementar esta historia", "trabajar FRESCO-XXX"                                                | `/sprint-development`                              | `.context/PBI/epics/EPIC-*/stories/STORY-*/`, `business/domain-glossary.md`, `DESIGN.md` + `.context/design/master-design-plan.md` (UI stories — Rule 14) | `[ISSUE_TRACKER_TOOL]` + `[AUTOMATION_TOOL]` |
| TDD slice / unit tests                      | "write unit tests", "TDD this function"                                                         | `/unit-testing`                                    | function under test, existing tests                             | Code edit                                    |
| Sync AI memory                              | "sync memory", `/sync-ai-memory`                                                                | `/sync-ai-memory`                                  | `README.md`, this file, `.context/`, `package.json`             | Edit                                         |
| Business map refresh                        | "refresh data map", `/business-*-map`                                                           | `/business-data-map` / `-feature-map` / `-api-map` | Supabase schema, backend code, PRD                              | Read + Write                                 |
| Git / PR work                               | any git intent                                                                                  | `/git-flow-master` (auto)                          | `git status`, `git log`                                         | `git` + `gh`                                 |
| Browser action                              | "screenshot", "trace", "record"                                                                 | `/playwright-cli`                                  | —                                                               | Playwright CLI                               |
| Jira operation                              | "Jira issue", "transition story"                                                                | `/acli`                                            | `.agents/jira-required.yaml`, `.agents/jira-fields.json`        | CLI                                          |

**Key paths**:

- `.context/business/business-data-map.md` · `business-feature-map.md` · `business-api-map.md` — system maps (refresh via `/business-*-map`)
- `.context/business/domain-glossary.md` — canonical domain terminology. Hand-maintained, append-only (like ADRs); created by `/project-foundation` Phase 4 Step 6; consulted before planning/AC writing (`/sprint-development`, `/product-management`); anti-glossary lists banned terms. Never regenerated.
- `.context/master-implementation-plan.md` — prioritized roadmap (EPIC/strategy; owned by `/master-implementation-plan`)
- `.context/dev-roadmap.md` — ticket-level dependency execution roadmap (TICKET/sequence: which story unblocks which, in what execution sprint, gated by which mockup; owned by `/dev-roadmap`; subsumes the former `.context/PBI/sprint-sequence.md`)
- `.context/design/master-design-plan.md` — per-screen fidelity specs + US→Screen map (§8) + frozen-token pointer (§2) + divergence register (§5). Built by `/design-system` screen-mapping phase (opt-in); consumed by `/sprint-development` for every UI story (Rule 14). UPSERT on re-run, never wipe.
- `.context/designs/<project-slug>/<batch-slug>/` — screen-mockup drop zone: `BRIEF.md` (portable design brief generated by `/design-system`) + the bundle the user exports from Claude Design / Open Design. Distinct from `design/handoff/` (root) = Path D system-token bundle → DESIGN.md.
- `.context/ADR/` — Architecture Decision Records (append-only). Any important, hard-to-reverse architecture decision (auth model, error/data-access/tenancy model, framework lock-in, cross-cutting invariant) → record as `ADR-NNNN-<slug>.md`; supersede, never delete. When-to-write + template → `.context/ADR/README.md`; AI detection/authoring → `.claude/skills/agentic-dev-core/references/adr-doctrine.md`. Seeded by `/project-foundation` (SRS) + `/sprint-development` (Stage 1). NOT for bug fixes, local refactors, or naming tweaks.
- `.context/reports/SPRINT-{N}-DEVELOPMENT.md` — cross-ticket dev tracker per sprint (generated/updated by `/sprint-development` batch mode)
- `.context/qa/regression.feature` — single cross-story Gherkin test scenario log (Spanish, `# language: es`), manual today / Playwright-automation candidate tomorrow. Complements (never duplicates) per-story AC in `comments.md`. Tag convention + lifecycle → `.context/qa/README.md`. Hand-maintained, append-only in spirit — update after every live testing session (new scenario, new edge case found, or a `@no-implementado` scenario ships).
- `.context/PBI/epics/EPIC-<KEY>-<slug>/` — epic-level (epic.md [SYNC], feature-implementation-plan.md / feature-test-plan.md [SYNC], stories/)
- `.context/PBI/epics/EPIC-*/stories/STORY-<KEY>-<slug>/` — story-level (story.md + per-field [SYNC], context.md, evidence/)
- `.agents/project.yaml` — `{{VAR}}` source-of-truth (load ONCE per session, cache)
- `.agents/jira-fields.json` · `jira-workflows.json` · `jira-required.yaml` — Jira catalogs

---

## 5. SKILLS + COMMANDS + MCPs REGISTRY

### Skills T1 (committed in `.claude/skills/`)

| Skill                 | Trigger                       | Purpose                                                                                                                                                                                                                                                                                |
| --------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agentic-dev-core`    | (auto, cited by other skills) | Passive reference host for shared doctrine (briefing template, dispatch patterns, orchestration, skill-composition strategy, behavioral layer, model routing, skill resolver, topic-key conventions, TypeScript patterns). Loaded on demand by workflow skills — not invoked directly. |
| `agentic-dev-onboard` | `/agentic-dev-onboard`        | First-time orientation. Stack + Jira workflow + skill map + MCPs.                                                                                                                                                                                                                      |
| `project-foundation`  | `/project-foundation`         | Constitution + Architecture (PRD/SRS) + Discovery (data/api/dev-guide).                                                                                                                                                                                                                |
| `design-system`       | `/design-system`              | DESIGN.md (Google Labs spec) — 5 paths. Pre-scaffolding visual contract.                                                                                                                                                                                                               |
| `project-bootstrap`   | `/project-bootstrap`          | Infra scaffolding: backend, frontend, OpenAPI, auth, env, Supabase types.                                                                                                                                                                                                              |
| `testability-guide`   | `/testability-guide`          | Generates in-app `/qa` page ("Software Testability Guide for QA") + tool-agnostic credentials artifact (Jira Epic default / Confluence / Notion / MCP / CLI / manual paste). Idempotent re-runs via snapshot-comment drift detection.                                                  |
| `product-management`  | `/product-management`         | Backlog seed + epic + INVEST/AC refinement + sprint report.                                                                                                                                                                                                                            |
| `sprint-development`  | `/sprint-development`         | **Mega-orchestrator**. Per-story Plan → Implement → Review → Staging → Prod (gated).                                                                                                                                                                                                   |
| `unit-testing`        | `/unit-testing`               | TDD red-green-refactor, mocking, coverage. Composable with `/sprint-development`.                                                                                                                                                                                                      |
| `git-flow-master`     | (auto on git/PR intents)      | End-to-end Git operator. Auto-detects branching strategy.                                                                                                                                                                                                                              |
| `acli`                | `/acli`                       | Atlassian CLI cookbook (Jira + Confluence). Resolves `[ISSUE_TRACKER_TOOL]`.                                                                                                                                                                                                           |
| `vercel-cli`          | (auto on `vercel` Bash calls) | Vercel CLI cookbook: deployment verification (poll commit SHA + `inspect --wait`), env var sync (`.env` ↔ Preview/Production scopes), build/runtime log streaming, rollback, `.vercel/` linking. Companion to community `/deploy-to-vercel`.                                          |

> **Persistent memory** — `bun run setup` installs Engram via `gentle-ai install --preset minimal`. Active across sessions and compactions per §12 (proactive memory triggers). No other gentle-ai skills are installed.
>
> **T3 (community project-level)** — frontend/backend skills matched by category at runtime, NOT by literal name. List in `cli/install.ts`.
>
> **T4 (community user-level)** — repo-agnostic skills, auto-discovered at runtime, **ASK before load** per strategy §3.2.
>
> Layout convention: T1 repo skills → `.claude/skills/<slug>/` (committed source). T3/T4 community skills installed via `bunx skills add` → `.agents/skills/<slug>/` (gitignored, default CLI behavior).

### Slash commands (utilities, 6)

| Command                       | Purpose                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `/sync-ai-memory`             | Audit + sync README, CLAUDE.md, CONTEXT.md, docs/, onboarding HTML against current repo state. |
| `/business-data-map`          | Refresh `.context/business/business-data-map.md` (entities, flows, state machines).            |
| `/business-feature-map`       | Refresh `.context/business/business-feature-map.md` (CRUD matrix, UI inventory).               |
| `/business-api-map`           | Refresh `.context/business/business-api-map.md` (auth model, endpoints, architecture).         |
| `/master-implementation-plan` | Refresh `.context/master-implementation-plan.md` (prioritized feature roadmap — EPIC/strategy).|
| `/dev-roadmap`                | Refresh `.context/dev-roadmap.md` (ticket-level dependency execution roadmap — TICKET/sequence; subsumes the Kahn execution-sprint sort). |

### MCPs (configured in `.mcp.json`)

| MCP      | Use for                                         | Rule                                    |
| -------- | ----------------------------------------------- | --------------------------------------- |
| Tavily   | Web search, troubleshooting community solutions, non-doc research | `[WEB_SEARCH_TOOL]` primary. **MANDATORY** for any general web search — community fixes, error message lookups, "how to solve X". PREFER OVER built-in `WebSearch` / `WebFetch` — Tavily returns ranked + summarized results; built-in is shallower. |
| Context7 | Library / framework / SDK / API / CLI official docs ("how to use X") | `[DOCS_TOOL]` primary. **MANDATORY** for any library / framework / SDK / API / CLI doc lookup (React, Next, Prisma, Tailwind, Express, etc.). PREFER OVER built-in `WebSearch` / `WebFetch` — Context7 returns current versioned docs; built-in returns stale blog posts. |
| Supabase | DB queries, schema, project state               | `[DB_TOOL]` primary                     |
| n8n      | Workflow automation, integrations               | `[AUTOMATION_FLOWS_TOOL]`               |

---

## 6. TOOL RESOLUTION ([TAG_TOOL] pseudocode)

> Skills use `[TAG_TOOL]` pseudocode. Resolve via this table. **PRIORITY**: CLI tools first (fewer tokens). MCP = fallback only.

| Tag                     | Domain                            | Primary                                   | Fallback                               |
| ----------------------- | --------------------------------- | ----------------------------------------- | -------------------------------------- |
| `[ISSUE_TRACKER_TOOL]`  | Jira Cloud (story/bug/epic)       | `/acli`                                   | MCP Atlassian (opt-in — see docs/mcp/) |
| `[KNOWLEDGE_BASE_TOOL]` | Confluence (knowledge base/docs)  | `/acli` (Confluence subcommands)          | MCP Atlassian (opt-in — see docs/mcp/) |
| `[AUTOMATION_TOOL]`     | Browser automation                | `/playwright-cli`                         | MCP Playwright                         |
| `[DB_TOOL]`             | Database                          | Supabase MCP                              | raw SQL via Supabase CLI               |
| `[API_TOOL]`            | API exploration                   | curl + OpenAPI types (`bun run api:sync`) | Postman manual                         |
| `[DOCS_TOOL]`           | Library / framework / SDK / API / CLI official docs | Context7 MCP (`mcp__context7__resolve-library-id` → `mcp__context7__query-docs`) | built-in `WebSearch` / `WebFetch` (last resort only) |
| `[WEB_SEARCH_TOOL]`     | General web search, community fixes, troubleshooting, non-doc research | Tavily MCP (`mcp__tavily__tavily_search` / `tavily_extract` / `tavily_research`) | built-in `WebSearch` / `WebFetch` (last resort only) |

**MANDATORY**: LOAD owning skill BEFORE invoking its tool. Skills hold WHEN/WHAT only. HOW (syntax, flags, auth, pagination, errors) lives inside owning skill's `references/`.

**MCP-only tags** (`[DOCS_TOOL]`, `[WEB_SEARCH_TOOL]`): no skill load required — MCPs self-document via tool descriptions. But **NEVER** substitute these with built-in `WebSearch` / `WebFetch` when MCP available — Context7 and Tavily return higher-quality, current, ranked results. Built-ins are stale-blog-post traps for library docs.

**Pseudocode value types**: `Literal` (fixed domain) · `{per convention}` (consult skill ref) · `{{PROJECT_VAR}}` (from `.agents/project.yaml`) · `{from analysis}` (runtime-derived).

---

## 6.5 CLI → SKILL AUTO-LOAD MAPPING

> Whenever Bash invokes one of these binaries, LOAD matching skill via Skill tool BEFORE running command. Skill holds WHEN/WHAT; binary executes HOW. Skip load step = flying blind on syntax, flags, auth, error semantics.

| CLI              | Skills to auto-load                                                    |
| ---------------- | ---------------------------------------------------------------------- |
| `bun`            | `/bun`                                                                 |
| `gh`             | `/git-flow-master`                                                     |
| `supabase`       | `/supabase`, `/supabase-postgres-best-practices`, `/project-bootstrap` |
| `vercel`         | `/vercel-cli`, `/deploy-to-vercel`, `/sprint-development`              |
| `resend`         | `/resend-cli`                                                          |
| `acli`           | `/acli`                                                                |
| `playwright-cli` | `/playwright-cli`, `/sprint-development`                               |
| `jq`             | `/acli`                                                                |

**Mandatory**: before any `Bash` call that names one of these binaries, check matching skill loaded for this session. If not, load via Skill tool first. Hard gate, not suggestion.

---

## 7. PROJECT VARIABLES — POINTER

> ALL variable syntax + Jira field references documented in **`.agents/README.md`**. READ ONCE per session, cache values.

Project values live in **`.agents/project.yaml`** — load once per session. NEVER hardcode Project Identity, env URLs, Jira URL, project key, MCP names. ALWAYS read from `.agents/project.yaml`.

**Variable syntaxes** (full ref → `.agents/README.md`):

- `{{VAR_NAME}}` → static project var (flat or env-scoped via `environments[active_env].<var>`)
- `<<VAR_NAME>>` → session var computed at runtime (e.g. `<<ISSUE_KEY>>` from git branch)
- `{{jira.*}}` → Jira custom fields + workflow refs (see `.agents/jira-fields.json`, `jira-workflows.json`, `jira-required.yaml`)

**Active env**: `active_env` defaults to `testing.default_env` in `.agents/project.yaml`. User says "test against production" → switch `active_env` to `production` for that session, ignore `default_env` until session ends.

**Validation**: `bun run vars:check` checks every `{{VAR}}` resolves; `bun run jira:check` validates manifest vs catalog.

---

## 8. AI BEHAVIOR DURING DEVELOPMENT

1. **EXPLAIN STORY**: once ticket understood, briefly state — what feature is, how works (simple terms), what will be developed.
2. **WAIT FOR CONFIRMATION**: after important explanations, WAIT for user response before continuing.
3. **EXPLAIN DEFECTS**: bug / unexpected behavior → describe observed, explain why problem, suggest impact (severity, affected users, business risk).
4. **LANGUAGE**: default English. User writes other language → mirror in user-facing communication. Docs + code ALWAYS English.

**ENVIRONMENT SELECTION**: default **staging** unless user specifies otherwise. Ask when ambiguous. URLs from `.agents/project.yaml`. Credentials from `.env`.

**CONTEXT EFFICIENCY**: main conversation stays lean (no large file reads). Subagents do heavy reading. Skills load only references current phase needs.

---

## 9. LOCAL CONTEXT (PBI) — POINTER

> `.context/PBI/` layout is OWNED by `scripts/sync-jira-issues.ts`. Module = Epic (1:1). Jira is the source of truth; local `.md` files are a **read-only cache**. NEVER hand-write a `[SYNC]` file (overwritten every sync) — author content, push to the Jira field, sync, read back. Full tree + fallback rule + detailed-read commands → `.claude/skills/agentic-dev-core/references/pbi-local-context.md`.

**ENTRY POINT**: invoke `/sprint-development` — syncs the ticket (`jira:sync-issues get`), explains story, loads the synced PBI, drives plan → code → review → deploy. Resume contract reads `.session/sprint-development/<JIRA-KEY>/progress.md` (per `.claude/skills/agentic-dev-core/references/session-management.md`).

---

## 10. STACK QUICK-REFERENCE (TypeScript + DRY)

> Full TS conventions live in feature dev-guide (Discovery output via `/project-foundation`) if present, else fallback `.claude/skills/agentic-dev-core/references/typescript-patterns.md`. LOAD `/sprint-development` before writing or reviewing feature code.

| Pattern        | Rule                                                                       |
| -------------- | -------------------------------------------------------------------------- |
| **Parameters** | Max 2 positional. 3+ → object param                                        |
| **Utilities**  | Agnostic only — no domain coupling in shared modules                       |
| **Imports**    | Always aliases (`@api/`, `@schemas/`, `@utils/`). No deep relative imports |
| **Types**      | Declare interfaces at top of file, after imports                           |
| **Errors**     | Public methods: fail fast (throw). Utilities: silent fail (return null)    |

**DRY — context matters**:

- `api/schemas/` = OpenAPI type facades (`@schemas/{domain}.types`). Single source of truth.
- Shared utilities = framework-agnostic only. No React, no Next, no Bun-specific APIs.
- Domain logic stays inside feature folder. Move to `shared/` only when ≥2 features import AND abstraction stable.

---

## 11. GIT WORKFLOW — POINTERS

Git / PR work → `/git-flow-master` auto-loads. Full details in `.claude/skills/git-flow-master/` + `docs/workflows/git-flow.md` if present.

> **Active strategy + branch policy = the `git_strategy:` block in `.agents/project.yaml`** (source of truth). This repo operates as `solo-main`.

**Protected branches**:

| Branch      | Role                                                               |
| ----------- | ------------------------------------------------------------------ |
| `main`      | Production. PRs merged from `staging` or `feature/*` after review. |
| `staging`   | Integration branch for AI commits + pre-release validation.        |
| `feature/*` | Task-specific. Use `feature/TICKET-ID-desc`.                       |
| `fix/*`     | Bug-fix branches. Use `fix/TICKET-ID-desc`.                        |

**Critical commit rules**:

- Semantic prefixes: `feat:` / `fix:` / `docs:` / `test:` / `refactor:` / `chore:`
- One commit = one responsibility. Clear messages.
- Branch + commit + push + PR + conflict-fix + chained-PR planning all in `/git-flow-master`.
- See §1 #3-#5 for NO-AI-attribution + push-to-main confirmation + git-history rules.

---

## Git Strategy

> **Source of truth: the `git_strategy:` block in `.agents/project.yaml`.** `git-flow-master` reads it before any git/gh operation and adapts every branch / commit / push / PR / conflict-fix to the strategy declared there. NEVER define branch policy in this CLAUDE.md — edit the `git_strategy:` block.
>
> If `git_strategy.strategy` is **null** (the shipped template value), the strategy is UNSET: `git-flow-master` OFFERS "Strategy Setup" on the first git intent and fills the block (it never auto-picks). `.agents/project.yaml` ships as a per-project template (all `null`) and is frozen by `bun run update` (updater `bootstrapOnlyPaths`), so every project keeps its own strategy.

This repository (the boilerplate itself) ships `git_strategy.strategy: null`; with a single `main` branch, `git-flow-master` operates as **`solo-main`** (single maintainer, commit + push directly to `main`). To pin it explicitly: ask git-flow-master to "set up our git strategy".

---

## 12. PROACTIVE MEMORY TRIGGERS

Engram MCP configured. Call `mem_save` IMMEDIATELY (no user prompt needed) after ANY of:

- **Architecture / design decision made** (tradeoffs chosen, alternative rejected).
- **Convention or workflow established** (naming, structure, lint rule, branch policy).
- **Bug fix completed** — include root cause, not just fix.
- **Non-obvious discovery, gotcha, or edge case** found.
- **Session close** — MANDATORY `mem_session_summary` before saying "done" / "listo".

Self-check after every task: _did I make decision, fix bug, learn something non-obvious, or establish convention? If yes → `mem_save` NOW._
