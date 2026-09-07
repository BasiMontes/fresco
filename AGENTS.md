# AGENTS.md: AI Persistent Memory

> AI memory. Loads EVERY session. Heavy detail → skill `references/`. Project values → `.agents/project.yaml`. Scripts → READ `package.json`. User-facing setup → `README.md` / `docs/`.

---

## 1. CRITICAL RULES: ALWAYS APPLY

1. **CREDENTIALS**: ALWAYS read from `.env`. NEVER hardcode/guess. Example keys: `DEV_USER_EMAIL`, `PRE_USER_PASSWORD`, `PRO_USER_EMAIL` (per-env test users — `{DEV,PRE,PRO}_USER_{EMAIL,PASSWORD}`; renamed from `LOCAL_USER_*` / `PRO_TEST_USER_*` / `USER_*_PRE` on 2026-08-27). Add `[Project-specific reminders]` per project (e.g. "SPA and API on different hosts: use correct base URLs").
2. **PLAN BEFORE CODING**: Produce impl plan (`implementation-plan.md` or skill-internal plan) BEFORE code. Flow: Plan → Code → Review.
3. **NO AI ATTRIBUTION**: NEVER include "Generated with Claude Code", "Co-Authored-By: Claude", or any equivalent authorship/advertising line in commits. Commits look human-authored. ONE scoped exception: a harness session trailer (trailer position ONLY, never subject or body) on commits actually written by an AI session, emitted ONLY when the running harness exposes a transcript pointer — a forensic pointer to the session transcript for root-cause investigation, NOT attribution: names no product, claims no authorship. `Claude-Session: <session-id>` is the only specified format today (Claude Code transcript `~/.claude/projects/<cwd-slug>/<session-id>.jsonl`); OpenCode and Codex sessions omit the trailer entirely. Human-authored commits never carry it. Full contract: `.agents/skills/git-flow-master/references/conventional-commits.md` § Hard rules. The ban stands in full outside this exception.
4. **CONFIRM BEFORE PUSH TO MAIN**: NEVER push to `main` without explicit user confirmation.
5. **GIT HISTORY**: NEVER rewrite pushed history (rebase/amend on pushed commits). NEVER force-push to shared branches. NEVER delete remote branches without confirmation. ALWAYS add forward (new commits, not rewrite). ALWAYS preserve merge history.
6. **QUALITY VERIFICATION**: After code changes, verify in order: tests → types → lint. No skip steps.
7. **FILE OPERATIONS**: ALWAYS read file before edit. Preserve formatting + indent. NEVER overwrite without reading.
8. **SKILLS-FIRST**: All workflows live in `.agents/skills/`. NEVER paste instructions inline. Invoke matching skill, let it self-load detail. Use `[TAG_TOOL]` pseudocode + `{{VARIABLES}}` for dynamic content.
9. **MCP CREDENTIAL FAILURE = STOP IMMEDIATELY**: MCP fail auth or env var missing (`.mcp.json` use `${VAR}`: Claude Code fail parse if unset; `opencode.jsonc` use `{env:VAR}`: OpenCode silently substitute empty → 401/403 is signal). NO workaround. STOP, tell user exact env var, point to `.env` / `.env.example`, ask fix `.env` + **RESTART AGENT SESSION** (env cached at MCP-spawn time, no refresh mid-session).
10. **SCRIPTS = READ `package.json` DIRECTLY**. NEVER quote build/test/lint commands from this file (`AGENTS.md`) or any doc: drift kills. Open `package.json` first, then answer.
11. **DEFAULT COMMUNICATION MODE: CAVEMAN**: If `caveman` skill installed user-level (`~/.claude/skills/caveman/`), respond caveman level `full` by default (drop articles, fillers, pleasantries; fragments OK; technical terms exact; code/commits/PRs/security warnings always write normal English: caveman built-in boundary). Revert verbose ONLY when user explicitly say "normal mode", "habla normal", "stop caveman", "speak normally", "be verbose", "más detallado" or clear semantic equivalent. If caveman skill not installed, rule = no-op.
12. **LANGUAGE DETECTION + MIRRORING**: At start of every conversation, READ FULL USER MESSAGE (not just opening words) to detect user's working language. Mirror that language in ALL conversational replies (questions, summaries, explanations, status updates). Repo artifacts ALWAYS English regardless of conversation language: code, code comments, commits, PR titles + bodies, branch names, file names, test names, configuration values, + any external action artifact (Jira issues/comments, GitHub issues/PRs/comments, Slack messages, emails, deploy notes, MCP tool inputs). Override: if user explicitly request another language for specific artifact ("crea el ticket en español", "write this PR description in Spanish"), honor that request only for that artifact + continue defaulting to English for next ones unless re-requested.
    **Project-standing override — Jira content (this project only, set 2026-07-26):** all Jira issues/comments (epics, stories, AC, scope, descriptions) are written in **Spanish** by default, not English — team works in Spanish end-to-end for this artifact type. This is a persistent override of the general repo-artifact-English default above, not a one-off per-ticket request; it applies to every future Jira write until the user says otherwise. All other repo artifacts (code, commits, PRs, branch names) stay English as normal.
13. **NO GLOBAL DISCARDS (MULTI-SESSION SAFETY)**: PROHIBITED to run repo-wide destructive git commands: `git restore .`, `git checkout -- .`, `git reset --hard`, untargeted `git stash`, `git clean -f`. Multiple agent sessions may share this working tree without worktrees: a global discard silently destroys another session's uncommitted work, unrecoverably. Discard ONLY explicit paths YOU modified in THIS session (`git restore <path>...` / `git stash push <path>...`). Unsure who modified a file → do NOT restore it: ask the user.
14. **UI FIDELITY CONTRACT**: story has UI → look it up in `.context/design/master-design-plan.md` §8 (US→Screen map). Row present → build against that screen's §4 spec + §2 frozen tokens + any Jira mockup. NEVER invent UI; unratified divergence from an agreed mockup = defect. **Row missing, or a screen with no §8 entry yet → do NOT hard-STOP**: build LIVE-UI-FIRST against the current live UI + `DESIGN.md` tokens + the Jira mockup, then add the screen's §8 row (and a §5 divergence note if you departed from a mockup) as part of the story. Hard-STOP only when the screen is genuinely novel — no analog anywhere in the live UI AND no mockup — then offer just-in-time mockup / spec-only §5 ratification / DESIGN.md-only build. LIVE-UI-FIRST: current live UI is the real fidelity source, mockup is inspiration — inspect + reuse live components first, don't force mockup details the live UI improved on. Full contract → `.agents/skills/agentic-dev-core/references/ui-fidelity-doctrine.md`. (Softened 2026-08-29, FRESCO-294, from upstream's stricter hard-stop-on-missing-row default — keep this softened form on future syncs.)
15. **HARNESS SURFACES ARE GENERATED**: never hand-edit `CLAUDE.md` (shim), `.claude/skills` (alias), `.claude/commands/*.md`, `.opencode/commands/*.md`. Edit the source (`AGENTS.md`, `.agents/skills/`, `.agents/compatibility/command-aliases.json`, the project overlay `.agents/compatibility/command-aliases.project.json` for project-owned aliases, `.agents/hooks/`) and run `bun run agents:compat`. `bun run agents:compat:check` is the gate. Full wiring → §5.5.
16. **SESSION LOGGING (`bitacora.md`) — MODO OPTIMIZADO (CERO LECTURA)**:
    - **TRIGGER (Cuándo)**: SOLO al completar una historia de Jira, resolver un bug crítico, o hacer un deploy. NUNCA por tareas triviales o cambios de texto.
    - **ACCIÓN (Cómo)**: Usa **EXCLUSIVAMENTE** un comando bash de append ciego. Ejemplo:
      `echo "## 2026-08-17 - [Título corto]\n- Qué: ...\n- Por qué: ...\n- Siguiente: ..." >> fresco-app/.context/bitacora.md`
    - **PROHIBICIÓN ABSOLUTA**: NUNCA uses `read_file`, `cat` o herramientas de lectura en `bitacora.md` antes de escribir. El formato es fijo y no requiere validación previa.
    - **EXCEPCIÓN DE LECTURA**: Si necesitas verificar el último entry, usa SOLO `tail -n 10 fresco-app/.context/bitacora.md` (limita la lectura a 10 líneas máx., ~50 tokens).
    - **ROTACIÓN AUTOMÁTICA**: Si el archivo supera las 50 entradas, archivar: `mv fresco-app/.context/bitacora.md fresco-app/.context/bitacora-<rango>.md` (ej. `bitacora-2026-08-to-09.md`) y arrancar `bitacora.md` de nuevo con el header + las últimas ~15 entradas (no vacío — el arranque en frío necesita contexto reciente).
    - **DOCS PADRE ALINEADOS (FRESCO-393, A4-M19)**: `/Users/basimontes/fresco/CLAUDE.md` y `/Users/basimontes/fresco/AGENTS.md` (sección "Session logging") apuntan a esta Regla 16 como fuente de verdad del trigger. Si algún doc padre vuelve a decir "every session", es drift — corregirlo hacia esta regla, no al revés.
17. **FEATURE MAP SYNC — MODO OPTIMIZADO**:
    - **TRIGGER**: SOLO al finalizar un Epic completo o añadir una nueva capacidad de negocio mayor (no por bugs, refactorizaciones o ajustes de UI).
    - **ACCIÓN**: Leer SOLO la sección específica del dominio que se modifica (usando `grep` o `sed` si es necesario, o pidiendo al usuario el bloque), actualizar y reescribir. No leer el archivo completo de 2000 líneas si solo se toca la tabla de "Usuarios". Hazlo automáticamente al cerrar la historia, pero si el cambio es trivial, omite este paso para ahorrar tokens.

---

## 2. BEHAVIORAL LAYER: HOW AI REASONS

> Bias toward caution over speed. Trivial tasks use judgment. Full examples + working-signals → `references/behavioral-layer.md`.
>
> **Personality contract**: this section = runtime contract. Mirror humano + protocolo de evolución → `docs/ai-personality.md` (keep in sync when editing rules here).

**LAYER SPLIT (binding).** Three sources govern chat output, each on ONE dimension, never overlapping:

| Layer | Dimension | Source |
|---|---|---|
| caveman | word count | `caveman@caveman` plugin, level `full` by default |
| this §2 | WHAT is said, granularity, register | Butler + PM Voice + Visual Mapping, below |
| OUTPUT STYLE | how it LOOKS on screen + textual texture | active user-level agent instructions (`~/.claude/CLAUDE.md` on Claude Code) → `## OUTPUT STYLE` |

This §2 WINS on content and structure of information. OUTPUT STYLE never contradicts it: it only adds markdown-render discipline (headings, bold anchors, backticks, tables, block spacing) and human texture (no em dash, varied sentence length, no closing recap). Both compose with caveman, which only removes words.

**These instruction files are NOT a style model.** `AGENTS.md`, `docs/ai-personality.md` and every `SKILL.md` are dense reference prose written for machine parsing. Do NOT imitate their typography, density, or arrow notation in chat replies.

**THINK BEFORE CODING.** State assumptions explicit. Multiple interpretations → present them, NEVER pick silently. Simpler approach exists → say so. Unclear → STOP, name confusion, ASK. Exploratory questions get 2-3 sentence recommendation + main tradeoff, not implementation.

**SIMPLICITY FIRST.** Minimum code that solves problem. No features beyond ask. No abstractions for single-use. No "flexibility" not requested. No error handling for impossible scenarios. 200 lines that could be 50 → rewrite. _Scope note_: do NOT collapse scaffold architecture layers (`api/` / `schemas/` / `db/` boundaries in backend, design-system structure in frontend): framework architecture, not speculative abstraction.

**SURGICAL CHANGES.** Touch only what required. Match existing style even if you'd do it differently. Don't refactor unbroken code. Don't improve adjacent comments/formatting. Notice unrelated dead code → mention, don't delete. Remove imports/vars YOUR changes made unused. _Scope note_: regenerative commands EXEMPT: regen IS task: `/project-foundation`, `/design-system`, `/project-bootstrap`, `/sync-ai-memory`, `/sprint-development` impl-plan stage, `/product-management` AC-writing.

**GOAL-DRIVEN EXECUTION.** Define success criteria. Loop until verified. Transform vague tasks into testable goals ("add validation" → "write tests for invalid input, then make them pass"). Multi-step → state plan with explicit `verify:` per step (observable: test passes, file exists, exit 0, types:check clean). Complements 6-component briefing (§3): does NOT replace it.

**EXPANDABLE RESPONSES (BUTLER PATTERN).** Default to terse headline answer that resolves user's literal question. Then surface ALL other topics you would otherwise have covered as atomic bullet menu: one specific topic per bullet, NEVER aggregated into broad categories. Let user pull topics they care about; do not push every detail in one shot.

- **Atomicity over aggregation**: 12 specific bullets beats 3 broad buckets. User must be able to spot one item that matters to them; bundling hides it.
- **No artificial cap**: bullet count determined by actual information richness. 2 topics → 2 bullets. 15 topics → 15 bullets.
- **Bullet style mirrors caveman**: each bullet is 1-line hook (`topic-name: short fragment`), not paragraph. NEVER an em dash as the separator (see active user-level agent instructions → OUTPUT STYLE).
- **Headline first**: headline must stand alone: user got their answer even if they ignore menu.
- **Composes with caveman**: caveman compacts WORDS, butler controls INFORMATION GRANULARITY. Both apply together.

Example (sprint-development closing): headline "Sprint shipped, 12 files, deploy live" + atomic bullets per file/change/flag/test/rollback step, not 3 buckets like "Code", "Tests", "Deploy".

**PM VOICE (DEFAULT REGISTER).** Default communication register is **Project Manager voice**, not senior-dev-to-senior-dev. Headline reports user or business value, not technical action. Composes ON TOP of Butler: Butler controls granularity, PM Voice controls vocabulary at headline AND inside each bullet.

- **Headline = value, not action**: lead with what changed for user or business, not which file / line / library you touched. Example: prefer "Profile cards breathe better now" over "Set padding to 24px on `<Card>`".
- **Audience model**: assume reader is PM / PO / tester who understands product and flow, NOT syntax, library names, or framework internals. You are senior dev REPORTING to PM, not becoming one.
- **No headline punch**: NEVER prefix the headline with an attention-priming phrase. Open on the value itself. A hook phrase that must vary across replies is manufactured theatre and reads as machine-written.
- **Bullet menu orientation (conditional)**: when response contains 3+ bullets serving as expandable topics, place short question between headline and menu inviting reader to pull thread. Wording is AI's choice and mirrors language. Skip question for 1-2 bullet menus that are clearly recap, not navigation.
- **Bullets are SINGLE menu**: do NOT split into "PM-voice bullets above" and "technical bullets below". One menu; AI chooses each bullet's register (value-framed or technical) based on topic. File path and UX-impact statement can sit side by side.
- **Suspension triggers (auto, one-turn, reverts after)**: switch to technical register for that turn when ANY of these fires -
  - user message contains file paths, shell commands, literal errors / stack traces, function / class / library names
  - user explicitly requests technical detail (in whatever phrasing)
  - topic touches security, secrets, auth, RLS, migrations, rollback, irreversible actions, or prod deploy
  - active skill is `/sprint-development` or output is commit message / PR body / code block
- **Always-technical scopes (PM Voice never applies)**: code blocks, commit messages, PR titles + bodies, branch names, file names, security warnings, irreversible-action confirmations.
- **Risk-Surface override**: even in PM Voice, if change affects data integrity, measurable performance, security, or rollback path → headline includes ONE line of technical impact alongside value framing.
- **Mirrors language**: PM Voice, menu-orientation question included, adopts whatever language user is writing in. Repo artifacts stay English per Critical Rule #12.

Example (same work, different register):

- ❌ Senior-dev register: "Refactored `useAuthState` to memoize the Supabase session subscription and moved the listener into a `useEffect` with cleanup."
- ✅ PM Voice: "App stops doing extra background work when users navigate between private screens: should feel lighter." Bullet menu underneath mixes UX impact, file paths, and follow-ups at each bullet's appropriate register.

**VISUAL MAPPING BIAS.** When content is naturally mappable, prefer visual representation over paragraph of prose. Humans process structured visuals faster than narrative for comparisons, hierarchies, flows, and impact maps. AI decides per-response whether visual materially aids comprehension: visual should REPLACE prose, not decorate alongside it. Composes with other strategies: Caveman compresses words, Butler controls granularity, PM Voice controls register, Visual Mapping controls form.

- **Types to reach for**:
  - **Tables** (`| col | col |`): comparisons (A vs B, before / after), key/value mappings (old name → new name), counts and metrics
  - **ASCII flow diagrams** (`A ──→ B ──→ C`): sequences, pipelines, propagation paths
  - **Trees** (`├── └──`): hierarchies, file structure, taxonomy
  - **Boxes** (`┌──┐ │ │ └──┘`): architecture components, system maps, state containers
  - **State machines** (labelled arrows between states): workflows, transitions, lifecycle
- **Where to place**:
  - **Below headline, above question + bullets menu**: when visual is primary expansion of headline
  - **Inside individual bullet**: when single topic in menu compresses better as mini-table or mini-diagram than as sentence
- **When to skip**:
  - Single-concept answers, yes / no responses, linear narratives where prose IS natural form
  - When forcing structure feels decorative or padded
- **Rendering safety**: prefer plain ASCII (`+--+`, `->`, `|`) over Unicode box-drawing (`┌──┐`, `→`) when uncertain about target terminal. Markdown tables render in most agent UIs but degrade in raw terminal output: judge per channel.

**SIGNALS THESE WORK**: fewer unnecessary diff changes, fewer rewrites from overcomplication, clarifying questions BEFORE implementation rather than after mistakes. For PM Voice specifically: fewer "what does that mean?" follow-ups, faster sign-off on reported work, headlines that can be copy-pasted into Slack / Jira without rewriting. For Visual Mapping: users grasp impact at-a-glance and can paste tables / diagrams into docs without redrawing.

---

## 3. ORCHESTRATION MODE: PERMANENTLY ACTIVE

> **Main conversation = command center. Subagents = executors.** Active EVERY session. Not optional.
>
> **Sanctioned exceptions** (not violations): a skill MAY define an explicit, user-invoked all-inline (Solo) mode that dispatches no subagents, and MAY pin a step to the session owning a non-delegable resource (browser/extension or session-bound auth). E.g. `/sprint-development` Solo mode + its session-bound live-UI step. Detail → `.agents/skills/agentic-dev-core/references/orchestration-doctrine.md`.

**USE SUBAGENTS FOR**: read/write multiple files, MCP ops, research across repos, git ops, verification (tests/types/lint), multi-file edits, long-running tasks.

**NO SUBAGENTS FOR**: quick lookups, memory reads/writes, task tracking, ask user, planning.

**6-COMPONENT BRIEFING (MANDATORY every dispatch)**:
**EXCEPCIÓN DE EFICIENCIA (CRÍTICA)**: El "6-COMPONENT BRIEFING" es MANDATORIO solo para tareas complejas (multi-paso, multi-archivo, tests E2E, migraciones). Para tareas triviales (leer 1-2 archivos, responder una pregunta de contexto, cambios de texto menores, formateo), ejecuta la acción directamente en la conversación principal o usa un dispatch simplificado de 1 línea. NO multipliques tokens innecesariamente en delegaciones simples.

1. **Goal**: one sentence
2. **Context docs**: files to read first
3. **Skills to load**: explicit (e.g. `/playwright-cli`)
4. **Exact instructions**: step-by-step, not vague goals
5. **Report format**: what to return (files changed, tests passed, blockers)
6. **Rules**: relevant Critical Rules to follow

**EXECUTION PATTERNS**:

| Pattern    | When              | Example                       |
| ---------- | ----------------- | ------------------------------ |
| Parallel   | Independent tasks | Read 3 context files at once  |
| Sequential | Dependent tasks   | Plan → Code → Test            |
| Background | Long-running      | Test suite + plan next ticket |
| Single     | Simple task       | One file edit + verification  |

**RULE REACHABILITY**: subagent sees ONLY briefing + `REGISTRY.md` compact rules + files briefing names. It does NOT walk `references/`. Rule that must BIND executor (prohibition, fail-closed gate, credential contract, cleanup duty) MUST land in all three: owning `references/*.md` (full text) + owning `SKILL.md` `## Compact Rules` (so registry propagates it) + briefing component 6. Rule only in reference file = documentation, NOT constraint.

**EPHEMERAL-ARTIFACT CONTRACT (secret hygiene)**: subagent materializing auth/session material to disk (cookie jar, `storageState.json`, token file, `.har` with `Authorization`/`Cookie`, session-bearing logs, DB dump) MUST: write ONLY to session scratch dir (never repo tree, not even ignored paths) → delete BEFORE reporting → disclose `secrets_materialized: none|<kinds>` + `cleaned: yes|no (<reason>)` in report. `cleaned: no` = BLOCKER surfaced to user. NEVER echo material into report/plan/commit/PR/tracker comment.

**GATE DESIGN: FAIL-CLOSED**: gate keyed on value the gated agent itself writes is fail-open (agent disables own gate by emitting plausible value). Every gate MUST: require citation of decision procedure alongside value + treat missing/malformed citation AS the blocking value + name who may fill it (when decision belongs to another skill, gated agent may emit blocking value only).

**VALUE PROVENANCE**: Rule #10 generalizes to ALL config. Any claim about project config cites file it was read from, same turn. NEVER quote skill reference / template / worked example as project state: reference values are illustrative and routinely differ.

**ERROR PROTOCOL**: Subagent error → STOP, report full context, NO fix without approval, offer retry/skip/abort.

**DEEP DETAIL** (subagent-cacheable) → `.agents/skills/agentic-dev-core/references/` (briefing-template, dispatch-patterns, orchestration-doctrine, skill-composition-strategy).

---

## 4. CONTEXT LOADING MAP: TASK → WHAT TO LOAD

> BEFORE responding to any task: identify task type → load matching skill → read listed context. NEVER guess scripts/commands: READ `package.json` DIRECTLY.

| Task                                        | Trigger phrase                                                                                  | Load skill                                         | Read context                                                    | Primary tool                                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| First-time orientation                      | "onboard me", "first time using this"                                                           | `/agentic-dev-onboard`                             | (skill self-loads)                                              | :                                            |
| Foundational definition (PRD/SRS/Discovery) | "define el PRD", "ideando un nuevo producto"                                                    | `/project-foundation`                              | `business/`, `PRD/`, `SRS/`                                     | Read + Write                                 |
| Design system (DESIGN.md)                   | "definir design system", "rebrandear el proyecto"                                               | `/design-system`                                   | `business/business-model.md`, `PRD/`                            | Write                                        |
| Screen design for one story (mockup)        | "no hay mockup para esta historia", "diseñar esta pantalla", "design this screen"       | `/design-system` (screen phase)                    | `DESIGN.md`, `design/master-design-plan.md` §2/§4/§8            | Open Design / Claude Design                  |
| Infra scaffolding (backend/frontend)        | "scaffolding del proyecto", "API routes setup"                                                  | `/project-bootstrap`                               | `SRS/infrastructure.md`, `DESIGN.md`                            | Code edit                                    |
| QA testability page + credentials artifact  | "create QA guide page", "guía de testeabilidad", "credenciales para testing", "update /qa page" | `/testability-guide`                               | `app/qa/page.tsx` snapshot, `.agents/project.yaml`, `.mcp.json` | Read + Write + `[ISSUE_TRACKER_TOOL]`        |
| Backlog / story refinement                  | "create epic", "refine acceptance criteria"                                                     | `/product-management`                              | `.context/PBI/epic-tree.md`, `PRD/`, `business/domain-glossary.md` | `[ISSUE_TRACKER_TOOL]`                       |
| Sprint-development ticket                   | "implementar esta historia", "trabajar FRESCO-XXX"                                                | `/sprint-development`                              | `.context/PBI/epics/EPIC-*/stories/STORY-*/`, `business/domain-glossary.md`, `DESIGN.md` + `.context/design/master-design-plan.md` (UI stories: Rule 14) | `[ISSUE_TRACKER_TOOL]` + `[AUTOMATION_TOOL]` |
| TDD slice / unit tests                      | "write unit tests", "TDD this function"                                                         | `/unit-testing`                                    | function under test, existing tests                             | Code edit                                    |
| Sync AI memory                              | "sync memory", `/sync-ai-memory`                                                                | `/sync-ai-memory`                                  | `README.md`, `AGENTS.md`, `.context/`, `package.json`           | Edit                                         |
| Business map refresh                        | "refresh data map", `/business-*-map`                                                           | `/project-context` (modes `data`/`features`/`api`) | Supabase schema, backend code, PRD                              | Read + Write                                 |
| Git / PR work                               | any git intent                                                                                  | `/git-flow-master` (auto)                          | `git status`, `git log`                                         | `git` + `gh`                                 |
| Browser action                              | "screenshot", "trace", "record"                                                                 | `/playwright-cli`                                  | :                                                               | Playwright CLI                               |
| Jira operation                              | "Jira issue", "transition story"                                                                | `/acli`                                            | `.agents/jira-required.yaml`, `.agents/jira-fields.json`        | CLI                                          |
| Jira admin (components / instance move)     | "sync jira components", "cambió la URL de Jira", "repoint jira"                                | `/jira-administration` (one mode per run)          | `.agents/project.yaml`, `.agents/jira-required.yaml`, `.agents/jira-*.json` | `scripts/sync-jira-components.ts` + `jira:sync-*` |

**Key paths**:

- `.context/business/business-data-map.md` · `business-feature-map.md` · `business-api-map.md`: system maps (refresh via `/project-context` modes `data`/`features`/`api`)
- `.context/business/domain-glossary.md`: canonical domain terminology. Hand-maintained, append-only (like ADRs); created by `/project-foundation` Phase 4 Step 6; consulted before planning/AC writing (`/sprint-development`, `/product-management`); anti-glossary lists banned terms. Never regenerated.
- `.context/master-implementation-plan.md`: prioritized roadmap (EPIC/strategy; owned by `/project-context` mode `master-plan`)
- `.context/dev-roadmap.md`: ticket-level dependency execution roadmap (TICKET/sequence: which story unblocks which, in what execution sprint, gated by which mockup; owned by `/project-context` mode `dev-roadmap`; subsumes the former `.context/PBI/sprint-sequence.md`)
- `.context/design/master-design-plan.md`: per-screen fidelity specs + US→Screen map (§8) + frozen-token pointer (§2) + divergence register (§5). Built by `/design-system` screen-mapping phase (opt-in); consumed by `/sprint-development` for every UI story (Rule 14). UPSERT on re-run, never wipe.
- `.context/designs/<project-slug>/<batch-slug>/`: screen-mockup drop zone: `BRIEF.md` (portable design brief generated by `/design-system`) + the bundle the user exports from Claude Design / Open Design. Distinct from `design/handoff/` (root) = Path D system-token bundle → DESIGN.md.
- `.context/ADR/`: Architecture Decision Records (append-only). Any important, hard-to-reverse architecture decision (auth model, error/data-access/tenancy model, framework lock-in, cross-cutting invariant) → record as `ADR-NNNN-<slug>.md`; supersede, never delete. When-to-write + template → `.context/ADR/README.md`; AI detection/authoring → `.agents/skills/agentic-dev-core/references/adr-doctrine.md`. Seeded by `/project-foundation` (SRS) + `/sprint-development` (Stage 1). NOT for bug fixes, local refactors, or naming tweaks.
- `.context/reports/SPRINT-{N}-DEVELOPMENT.md`: cross-ticket dev tracker per sprint (generated/updated by `/sprint-development` batch mode)
- `.context/qa/regression.feature`: single cross-story Gherkin test scenario log (Spanish, `# language: es`), manual today / Playwright-automation candidate tomorrow. Complements (never duplicates) per-story AC in `comments.md`. Tag convention + lifecycle → `.context/qa/README.md`. Hand-maintained, append-only in spirit — update after every live testing session (new scenario, new edge case found, or a `@no-implementado` scenario ships).
- `.context/PBI/epics/EPIC-<KEY>-<slug>/`: epic-level (epic.md [SYNC], feature-implementation-plan.md / feature-test-plan.md [SYNC], stories/)
- `.context/PBI/epics/EPIC-*/stories/STORY-<KEY>-<slug>/`: story-level (story.md + per-field [SYNC], context.md / progress.md / evidence/ [LOCAL])
- `.agents/project.yaml`: `{{VAR}}` source-of-truth (load ONCE per session, cache)
- `.agents/jira-fields.json` · `jira-workflows.json` · `jira-required.yaml`: Jira catalogs

---

## 5. SKILLS + COMMANDS + MCPs REGISTRY

### Skills T1 (committed in `.agents/skills/`)

| Skill                 | Trigger                       | Purpose                                                                                                                                                                                                                                                                                |
| --------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agentic-dev-core`    | (auto, cited by other skills) | Passive reference host for shared doctrine (briefing template, dispatch patterns, orchestration, skill-composition strategy, behavioral layer, model routing, skill resolver, topic-key conventions, TypeScript patterns). Loaded on demand by workflow skills, not invoked directly. |
| `agentic-dev-onboard` | `/agentic-dev-onboard`        | First-time orientation. Stack + Jira workflow + skill map + MCPs.                                                                                                                                                                                                                      |
| `project-foundation`  | `/project-foundation`         | Constitution + Architecture (PRD/SRS) + Discovery (data/api/dev-guide).                                                                                                                                                                                                                |
| `design-system`       | `/design-system`              | TWO phases, different moments. Token phase: DESIGN.md (Google Labs spec, 5 paths), once, pre-scaffolding. Screen phase: per-story mockups, just-in-time, invoked standalone or routed from /sprint-development's design gate. |
| `project-bootstrap`   | `/project-bootstrap`          | Infra scaffolding: backend, frontend, OpenAPI, auth, env, Supabase types.                                                                                                                                                                                                              |
| `testability-guide`   | `/testability-guide`          | Generates in-app `/qa` page ("Software Testability Guide for QA") + tool-agnostic credentials artifact (Jira Epic default / Confluence / Notion / MCP / CLI / manual paste). Idempotent re-runs via snapshot-comment drift detection.                                                  |
| `product-management`  | `/product-management`         | Backlog seed + epic + INVEST/AC refinement + sprint report.                                                                                                                                                                                                                            |
| `sprint-development`  | `/sprint-development`         | **Mega-orchestrator**. Per-story Plan → Implement → Review → Staging → Prod (gated).                                                                                                                                                                                                   |
| `unit-testing`        | `/unit-testing`               | TDD red-green-refactor, mocking, coverage. Composable with `/sprint-development`.                                                                                                                                                                                                      |
| `autonomous-delivery` | `/autonomous-delivery`        | Scheduled / unattended delivery runs (no human on the line). Phases: Lock → Audit (git is truth, tracker is a hint) → Select genuinely unblocked work → Execute via owning pipeline skill → Close + report. Modes: `story` (1 per run), `bug` (up to 3, sequential), `discovery` (backlog only, never writes code). Disabled by default — see `.agents/project.yaml` → `autonomous_delivery.enabled`. |
| `git-flow-master`     | (auto on git/PR intents)      | End-to-end Git operator. Auto-detects branching strategy, and keeps it in parity with the host ruleset via `bun run git:policy` (verify / apply).                                                                                                                                       |
| `jira-administration` | `/jira-components` · `/jira-instance-migration` | Bounded Jira ADMIN workflows, one mode per run: `components` (reconcile a project's Components against the app's real modules, plan-first) or `instance-migration` (repoint the Atlassian host + regenerate the `.agents/` catalogs). Both sealed behind read-first analysis and explicit approval before any Jira / credential-session / repo mutation. |
| `project-context`     | `/project-context` (modes `data` · `features` · `api` · `master-plan` · `dev-roadmap`) | Business maps + master implementation plan + dev roadmap; formerly five inline commands. One mode per run: `data` → `.context/business/business-data-map.md`, `features` → `business-feature-map.md`, `api` → `business-api-map.md`, `master-plan` → `.context/master-implementation-plan.md`, `dev-roadmap` → `.context/dev-roadmap.md`. |
| `sync-ai-memory`      | `/sync-ai-memory`             | Audit + sync README, `AGENTS.md`, CONTEXT.md, docs/, onboarding HTML against current repo state. Skill (formerly a command). Shim guard: operational prose found in `CLAUDE.md` is structural drift → STOP, never propagate. |
| `acli`                | `/acli`                       | Atlassian CLI cookbook (Jira + Confluence). Resolves `[ISSUE_TRACKER_TOOL]`.                                                                                                                                                                                                           |
| `vercel-cli`          | (auto on `vercel` Bash calls) | Vercel CLI cookbook: deployment verification (poll commit SHA + `inspect --wait`), env var sync (`.env` ↔ Preview/Production scopes), build/runtime log streaming, rollback, `.vercel/` linking. Companion to community `/deploy-to-vercel`.                                          |

> **Persistent memory**: `bun run setup` installs Engram via `gentle-ai install --preset minimal`. Active across sessions and compactions per §12 (proactive memory triggers). No other gentle-ai skills are installed.
>
> **T3 (community project-level)**: frontend/backend skills matched by category at runtime, NOT by literal name. List in `cli/install.ts`.
>
> **T4 (community user-level)**: repo-agnostic skills, auto-discovered at runtime, **ASK before load** per strategy §3.2.
>
> Layout convention: T1 repo skills → `.agents/skills/<slug>/` (committed source). T3 community skills (`bunx skills add`) install into the SAME `.agents/skills/` store; T4 user-level skills stay harness-specific (`~/.claude/skills/`, and the equivalent for each host). Claude Code discovers the whole store through the generated `.claude/skills` alias (§5.5); OpenCode and Codex read `.agents/skills/` natively.

### Slash commands (utilities, 8)

Each command is a transport-only alias declared in `.agents/compatibility/command-aliases.json` and generated into `.claude/commands/` and `.opencode/commands/` by `bun run agents:compat`; the body lives in the target skill (`project-context` modes `data | features | api | master-plan | dev-roadmap`, `sync-ai-memory`, `jira-administration` modes). Codex has no wrapper layer: invoke the skill + mode directly.

| Command                       | Purpose                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `/sync-ai-memory`             | Alias → skill `sync-ai-memory`. Audit + sync README, `AGENTS.md`, CONTEXT.md, docs/, onboarding HTML against current repo state. |
| `/business-data-map`          | Alias → skill `project-context` mode `data`. Refresh `.context/business/business-data-map.md` (entities, flows, state machines).            |
| `/business-feature-map`       | Alias → skill `project-context` mode `features`. Refresh `.context/business/business-feature-map.md` (CRUD matrix, UI inventory).               |
| `/business-api-map`           | Alias → skill `project-context` mode `api`. Refresh `.context/business/business-api-map.md` (auth model, endpoints, architecture).         |
| `/master-implementation-plan` | Alias → skill `project-context` mode `master-plan`. Refresh `.context/master-implementation-plan.md` (prioritized feature roadmap: EPIC/strategy).|
| `/dev-roadmap`                | Alias → skill `project-context` mode `dev-roadmap`. Refresh `.context/dev-roadmap.md` (ticket-level dependency execution roadmap: TICKET/sequence; subsumes the Kahn execution-sprint sort). |
| `/jira-instance-migration`    | Alias → skill `jira-administration` mode `instance-migration`. Repoint the repo at a new Atlassian instance (`.agents/project.yaml` + machine-global `acli` session) and regenerate the `.agents/` catalogs the migration invalidated. Takes source + target instance as arguments; asks for whatever is missing. |
| `/jira-components`            | Alias → skill `jira-administration` mode `components`. Reconcile a Jira project's Components against the app's real functional modules, plan-first (`scripts/sync-jira-components.ts`, dry run by default, `--apply` only after explicit approval). |

### MCPs (configured in `.mcp.json`)

| MCP      | Use for                                         | Rule                                    |
| -------- | ----------------------------------------------- | --------------------------------------- |
| Tavily   | Web search, troubleshooting community solutions, non-doc research | `[WEB_SEARCH_TOOL]` primary. **MANDATORY** for any general web search: community fixes, error message lookups, "how to solve X". PREFER OVER built-in `WebSearch` / `WebFetch`: Tavily returns ranked + summarized results; built-in is shallower. |
| Context7 | Library / framework / SDK / API / CLI official docs ("how to use X") | `[DOCS_TOOL]` primary. **MANDATORY** for any library / framework / SDK / API / CLI doc lookup (React, Next, Prisma, Tailwind, Express, etc.). PREFER OVER built-in `WebSearch` / `WebFetch`: Context7 returns current versioned docs; built-in returns stale blog posts. |
| Supabase | DB queries, schema, project state               | `[DB_TOOL]` primary                     |

---

## 5.5 MULTI-HARNESS: ONE SOURCE, THREE CONSUMERS

> This repo runs on **Claude Code, OpenCode, and Codex (CLI + Desktop)**. There is exactly ONE copy of every instruction and every skill. Where the harnesses genuinely differ (MCP file format, hook API, slash-command existence) each keeps a THIN versioned adapter. Nothing is duplicated.

**INSTRUCTIONS.** `AGENTS.md` (this file) is the only instruction body. OpenCode and Codex load it natively. Claude Code loads `CLAUDE.md`, which is **exactly** `@AGENTS.md` plus one newline — a documented import, not a symlink, so it survives a Windows checkout. NEVER write operational prose into `CLAUDE.md`: that is structural drift, and `sync-ai-memory` stops rather than propagating it.

| Surface | Claude Code | OpenCode | Codex CLI + Desktop |
|---|---|---|---|
| Instructions | `CLAUDE.md` → `@AGENTS.md` **[generated shim]** | `AGENTS.md` (native) | `AGENTS.md` (native) |
| Skills | `.claude/skills` **[generated alias]** | `.agents/skills/` (native) | `.agents/skills/` (native) |
| Commands | `.claude/commands/*.md` **[generated]** | `.opencode/commands/*.md` **[generated]** | none — invoke the skill + mode directly |
| Hook | `.claude/settings.json` → `UserPromptSubmit` | `.opencode/plugins/personality-reinject.js` | `.codex/hooks.json` → `UserPromptSubmit` |
| MCP | `.mcp.json` | `opencode.jsonc` | `.codex/config.toml` |

**GENERATED vs VERSIONED (hard rule, = Critical Rule #15).** Bold `[generated]` cells above are OUTPUT. NEVER hand-edit one, and never commit `.claude/skills` (gitignored). Edit the source, then regenerate:

| Generated artifact | Its source | Regenerate |
|---|---|---|
| `CLAUDE.md` (one-line `@AGENTS.md` shim, never prose) | `AGENTS.md` | `bun run agents:compat` |
| `.claude/skills` (POSIX symlink / Windows junction, gitignored, never hand-edited) | `.agents/skills/` | `bun run agents:compat` |
| One Claude + one OpenCode wrapper per alias (`.claude/commands/*.md`, `.opencode/commands/*.md`; 8 upstream plus any project-declared) | `.agents/compatibility/command-aliases.json` + optional overlay `command-aliases.project.json` | `bun run agents:compat` |

`bun run agents:compat:check` validates the whole contract: shim bytes, alias target, both wrapper sets byte-for-byte against the merged manifest, hook adapters, and MCP parity. A wrapper that grew a body fails as `contains workflow prose`; a wrapper file no manifest produced fails by name (`Command wrapper not declared in any manifest: <path>`), never silently ignored.

**COMMAND ALIASES ARE TRANSPORT, NOT WORKFLOW.** Each manifest entry names a target skill + mode; the wrapper only selects and forwards `$ARGUMENTS`. `agents:compat:check` rejects an alias whose target skill or declared mode does not exist. Alias table → §5. **Project overlay**: `.agents/compatibility/command-aliases.project.json` (same schema, optional, bootstrap-only: `bun run up` never overwrites it). Merge: upstream aliases first, overlay overrides by `alias` name or adds new ones, `wrapperHosts` always from upstream. Project-owned slash commands go THERE, never into the upstream manifest.

**UPDATER END-OF-RUN.** `bun run up` closes with one "Estado por superficie" table (10 rows: Instrucciones y config / Skills / Comandos / Hooks / MCP / Env / Componentes / package.json / Git / Verificación) and ONE parity prompt, saved to `.agents/prompts/parity-plan.md` (gitignored, single-use; `--dry-run` prints it and does not save it): numbered rows with evidence (headings, hunk counts, server ids, wrapper paths), ONE row per path (a stray wrapper = one `add to overlay` row; a watched file that also fails a compat contract = one blocking row with both evidences). When handed that prompt: present the table, WAIT for a per-row decision `keep project | take upstream | merge`, apply only the chosen rows, then tests → types → lint. **`take upstream` is suggested only where the project lacks the content entirely**; a row naming project-only servers, keys, headings or edits says `merge`, and applying `take upstream` there anyway deletes project content (never do it unasked). Rows on `package.json` (a key kept at the project value, both values in the saved file) and on `Verificación` (a post-sync `types:check` / `lint:check` failure: exit code, first errors, which applied files they name; `--no-gates` skips them) are informational, never blocking. A synced file the project had edited and the run overwrote is a `merge` row naming its `.backups/` copy. `--strict` = exit 1 on compat errors or blocking findings (default warn, exit 0). An aborted run (dirty tree, corrupt lock, failed clone, declined migration/self-update) prints `Abortado.` and exits 1; a no-op run leaves the tree byte-identical (lock not rewritten). A re-run over the previous sync's uncommitted output is NOT an abort: `.template/last-apply.json` (gitignored) records what the run wrote with hashes and the guard recognises it; an unrelated or hand-edited path still aborts, naming `Commit sugerido` and the prompt path. With a pending self-update, `--dry-run` runs the fetched updater from the upstream clone (nothing written) so the preview is the new code's; without a TTY on stdin and no `--auto`/`--interactive`, the run assumes `--auto`. `.claude/settings.json` ships once when missing (bootstrap-only, like `.codex/`), then sits on the protected watchlist: never overwritten, drift surfaces in the prompt. On the run that migrates a Claude-era repo the `.claude/skills` alias is NOT created (staged `.claude/skills/*` deletions behind a symlink break lint-staged), and every re-run before that commit keeps deferring it: commit the migration, then `bun run agents:compat` creates it; the closing box says `Siguiente: commit de la migración, luego bun run agents:compat`. `agents:compat:check` / doctor always print the alias status line and group errors per surface (instructions, alias, wrappers, hooks, MCP). `cli/**` must type-check under a host whose `ProcessEnv` requires `NODE_ENV` (Next.js): never cast a plain object straight to `NodeJS.ProcessEnv` in synced tests (`cli/updater-host-types.test.ts` guards it). Since 8.2: `.husky/pre-commit` and `.husky/pre-push` sit on the protected watchlist (project gates: delivered once when missing, never overwritten, one drift row per upstream change), and a project protects any other synced file it merged by hand through `updater.protected_paths` in `.agents/project.yaml` (same semantics; invalid paths are reported and ignored). The row for an overwritten project edit ends with that fix and the saved prompt repeats it as YAML. A `merge` on a watched file always says what to port and what to keep (`port upstream additions only: <keys>; keep project-only: <keys>`; `keep project` when only the project has extra keys; `take upstream` only when upstream added keys and nothing else differs). `.agents/project.yaml` and `.agents/jira-required.yaml` are compared by structure only: an `informational` row for keys upstream added, no row for value differences (project identity). Since 8.3: the dirty-tree guard blocks ONLY on uncommitted work inside what the sync writes (synced component files, ignore files, `package.json`); dirt elsewhere (`tests/`, app code, protected files) is listed as `fuera de lo que este updater escribe; no bloquean`. A git-tracked `.context/PBI/` cache is ONE Componentes row pointing at the recipe in `.agents/prompts/pbi-cache-migration.md` (gitignored, single-use), never a terminal dump. A path just declared in `updater.protected_paths` gets its marker seeded with no row (the row fires on the next upstream change); a path upstream added after the lock cursor never gets an overwritten-edit row; the `cli` cursor advances after a self-update; MCP registry rows name the server and the fields that differ (`context7: args differ`). Since 8.4: the `cli` cursor also advances after a self-update from a pre-8.1 parent, which never sends the env signal (content comparison catches it instead); a heading changed only by punctuation (em dash, en dash, hyphen, colon) is unchanged, never an added-plus-removed pair; `bun run skills:registry` reruns as the very last afterApply hook, and an overwritten `.agents/skills/**` row ends with `after restoring, run bun run skills:registry`; a watched file with no marker yet whose upstream copy has not changed since the lock cursor seeds silently instead of firing a row (an unknown cursor keeps first advice); and the closing box prints `Gates: omitidas (sin cambios)` or `omitidas (--no-gates)` instead of dropping the line when no gate ran.

**HOOK: one emitter, three adapters.** `.agents/hooks/` holds the personality-reinject contract text once. Claude Code (`.claude/settings.json`) and Codex (`.codex/hooks.json`) execute it as a `UserPromptSubmit` command hook; OpenCode imports the constant from the thin plugin `.opencode/plugins/personality-reinject.js`. Contract enforced by `cli/lib/agent-compatibility-contracts.ts`: no absolute personal paths, no duplicated hook file.

**MCP: one declared set, three formats, semantic parity.** The canonical server set is whatever `.mcp.json` declares: every server there must exist in `opencode.jsonc` and `.codex/config.toml` with the same `.env` dependencies and the same literal env settings, and a server present in one host only fails naming the server and the host. Parity is checked by NORMALIZING each native format (JSON / JSONC / TOML) into a common shape — transport, command, args, url, env vars, enabled — then comparing. Fresco declares `context7`, `tavily`, `supabase`, `21st`, `stitch`, `posthog` — no `n8n` (not used here). `21st`/`stitch` use a non-bearer custom HTTP header (`x-api-key` / `X-Goog-Api-Key`): Codex expresses this via `env_http_headers` (header name → `.env` var name), not `bearer_token_env_var`. Env references keep each host's own syntax: `${VAR}` (`.mcp.json`), `{env:VAR}` (`opencode.jsonc`), `env_vars` / `bearer_token_env_var` / `env_http_headers` (`.codex/config.toml`); Critical Rule #9 applies to all three.

**HARNESS-SPECIFIC GOTCHAS.**

- **Codex trust**: project `.codex/` config and hooks load ONLY in a trusted repository. Trust is runtime state that cannot be verified by reading files.
- **Codex Desktop** consumes the same repository config as the CLI. No second convention, no extra directory.
- **OpenCode hook API** is experimental: re-verify on OpenCode upgrades. Claude Code and Codex sit on stable hook APIs.
- **Harness plugins stay harness-specific**: Engram and caveman are Claude Code plugins; the rules that mention them (§1 #11, §12) are no-ops on a host where the plugin is absent.
- **Launch with the `bun run <harness>` wrappers** in `package.json`: each wraps `.env` sourcing so it WINS over an inherited process variable. Launching the bare executable skips that and can leave a stale inherited value shadowing the file (§7).

---

## 6. TOOL RESOLUTION ([TAG_TOOL] pseudocode)

> Skills use `[TAG_TOOL]` pseudocode. Resolve via this table. **PRIORITY**: CLI tools first (fewer tokens). MCP = fallback only.

| Tag                     | Domain                            | Primary                                   | Fallback                               |
| ----------------------- | ---------------------------------- | ----------------------------------------- | -------------------------------------- |
| `[ISSUE_TRACKER_TOOL]`  | Jira Cloud (story/bug/epic)       | `/acli`                                   | MCP Atlassian (opt-in: see docs/mcp/) |
| `[KNOWLEDGE_BASE_TOOL]` | Confluence (knowledge base/docs)  | `/acli` (Confluence subcommands)          | MCP Atlassian (opt-in: see docs/mcp/) |
| `[AUTOMATION_TOOL]`     | Browser automation                | `/playwright-cli`                         | MCP Playwright                         |
| `[DB_TOOL]`             | Database                          | Supabase MCP                              | raw SQL via Supabase CLI               |
| `[API_TOOL]`            | API exploration                   | curl + OpenAPI types (`bun run api:sync`) | Postman manual                         |
| `[DOCS_TOOL]`           | Library / framework / SDK / API / CLI official docs | Context7 MCP (`mcp__context7__resolve-library-id` → `mcp__context7__query-docs`) | built-in `WebSearch` / `WebFetch` (last resort only) |
| `[WEB_SEARCH_TOOL]`     | General web search, community fixes, troubleshooting, non-doc research | Tavily MCP (`mcp__tavily__tavily_search` / `tavily_extract` / `tavily_research`) | built-in `WebSearch` / `WebFetch` (last resort only) |

**MANDATORY**: LOAD owning skill BEFORE invoking its tool. Skills hold WHEN/WHAT only. HOW (syntax, flags, auth, pagination, errors) lives inside owning skill's `references/`.

**MCP-only tags** (`[DOCS_TOOL]`, `[WEB_SEARCH_TOOL]`): no skill load required: MCPs self-document via tool descriptions. But **NEVER** substitute these with built-in `WebSearch` / `WebFetch` when MCP available: Context7 and Tavily return higher-quality, current, ranked results. Built-ins are stale-blog-post traps for library docs.

**Pseudocode value types**: `Literal` (fixed domain) · `{per convention}` (consult skill ref) · `{{PROJECT_VAR}}` (from `.agents/project.yaml`) · `{from analysis}` (runtime-derived).

---

## 6.5 CLI → SKILL AUTO-LOAD MAPPING

> Whenever Bash invokes one of these binaries, LOAD matching skill via Skill tool BEFORE running command. Skill holds WHEN/WHAT; binary executes HOW. Skip load step = flying blind on syntax, flags, auth, error semantics.

| CLI              | Skills to auto-load                                                    | Rationale                                                                       |
| ---------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `bun`            | `/bun`                                                                 | Runtime + package manager. Skill covers bun-specific APIs, scripts, lockfile.   |
| `gh`             | `/git-flow-master`                                                     | GitHub CLI + git workflow. Skill covers repo ops, PRs, `gh api` patterns.       |
| `supabase`       | `/supabase`, `/supabase-postgres-best-practices`, `/project-bootstrap` | DB CLI + Postgres patterns + DB scaffold flow.                                  |
| `vercel`         | `/vercel-cli`, `/deploy-to-vercel`, `/sprint-development`              | Vercel CLI cookbook (verification, env, debug, rollback) + community deploy workflow + sprint deploy stages. |
| `resend`         | `/resend-cli`                                                          | Transactional email CLI: covers send, templates, domains.                      |
| `acli`           | `/acli`                                                                | Atlassian CLI: Jira/Confluence workflows. Owns slug syntax + custom-field IDs. |
| `playwright-cli` | `/playwright-cli`, `/sprint-development`                               | Browser automation: used by sprint-dev E2E checks + standalone QA capture.     |
| `jq`             | `/acli`                                                                | JSON processor: required by acli skill for parsing `acli ... --json` output.   |

**Mandatory**: before any `Bash` call that names one of these binaries, check matching skill loaded for this session. If not, load via Skill tool first. Hard gate, not suggestion.

---

## 7. PROJECT VARIABLES: POINTER

> ALL variable syntax + Jira field references documented in **`.agents/README.md`**. READ ONCE per session, cache values.

Project values live in **`.agents/project.yaml`**: load once per session. NEVER hardcode Project Identity, env URLs, Jira URL, project key, MCP names. ALWAYS read from `.agents/project.yaml`.

**Variable syntaxes** (full ref → `.agents/README.md`):

- `{{VAR_NAME}}` → static project var (flat or env-scoped via `environments[active_env].<var>`)
- `<<VAR_NAME>>` → session var computed at runtime (e.g. `<<ISSUE_KEY>>` from git branch)
- `{{jira.*}}` → Jira custom fields + workflow refs (see `.agents/jira-fields.json`, `jira-workflows.json`, `jira-required.yaml`)

**Active env**: `active_env` defaults to `testing.default_env` in `.agents/project.yaml`. User says "test against production" → switch `active_env` to `production` for that session, ignore `default_env` until session ends.

**Validation**: `bun run vars:check` checks every `{{VAR}}` resolves; `bun run jira:check` validates manifest vs catalog.

**INSTANCE-IDENTITY ANCHOR (binding)**: the Atlassian host is `.agents/project.yaml` → `issue_tracker.atlassian_url` and **NOWHERE ELSE locally**. `ATLASSIAN_URL` is NOT a `.env` variable: it is absent from `.env` and `.env.example` on purpose, because a second copy is what goes stale. Canonical resolver: `cli/lib/atlassian-instance.ts`, never read `process.env.ATLASSIAN_URL` directly in a new script. From a shell, call the accessor: `bun run --silent jira:url` (base URL) / `--slug` (bare host for `acli --site`; NEVER hand-strip `https://`). The resolver still reads the env var LAST as a transitional fallback for a repo whose yaml is unset; on disagreement the yaml wins AND a warning names both values, because a hit there means a stale copy is loose in the environment. **Deliberate inversion vs. `project_key`**, where the env var wins: a project key is a legitimate per-run override, the host is project identity that changes on site migrations, the exact value that goes stale. Credentials (`ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`) stay env-only and are NEVER mirrored into the versioned yaml; the host is a public hostname, not a secret, so the reverse split is safe. `scripts/agents-setup.ts` refuses to seed this one field from the environment (`envVar: null`) so an unattended run can never overwrite the versioned value. The NAME survives only as Vercel runtime config for a serverless Jira integration, pushed there FROM the yaml by `bun run setup --variables` (manifest `valueSource: 'atlassian-instance'`), so yaml and deploy scope cannot drift. Class-wide guard: `bun run vars:env:check` fails on ANY `.env`-sourced manifest var whose process value differs from `.env`, and warns when a yaml-sourced var still has a dead line in `.env`; it is warn-only in `.husky/pre-push` so a machine-local condition never blocks an unrelated push. Applies the test: **does a stale value here corrupt data in silence, or fail loudly?** Silent corruption → one versioned source, no local duplicate, is not optional.

---

## 8. AI BEHAVIOR DURING DEVELOPMENT

1. **EXPLAIN STORY**: once ticket understood, briefly state: what feature is, how works (simple terms), what will be developed.
2. **WAIT FOR CONFIRMATION**: after important explanations, WAIT for user response before continuing.
3. **EXPLAIN DEFECTS**: bug / unexpected behavior → describe observed, explain why problem, suggest impact (severity, affected users, business risk).
4. **LANGUAGE**: default English. User writes other language → mirror in user-facing communication. Docs + code ALWAYS English.

**ENVIRONMENT SELECTION**: default **staging** unless user specifies otherwise. Ask when ambiguous. URLs from `.agents/project.yaml`. Credentials from `.env`.

**CONTEXT EFFICIENCY**: main conversation stays lean (no large file reads). Subagents do heavy reading. Skills load only references current phase needs.

---

## 9. LOCAL CONTEXT (PBI)

> **`.context/PBI/` is a GITIGNORED CACHE of Jira, owned by `scripts/sync-jira-issues.ts`.** Module = Epic (1:1). Jira is the source of truth; local `.md` files are a **read-only cache**. NEVER hand-write a Jira-mirrored file: author the plan/content, push it to the Jira field (or fallback), then run the sync. Rebuild the whole tree with `bun run context:hydrate`.
>
> **WHY NOT COMMITTED**: synced content regenerates. Two sessions re-syncing at different times produce conflicting commits of the same generated text; a 3-way merge over a full-file rewrite is meaningless. Jira already IS the versioned, shared, cloud-hosted copy — committing the cache duplicates the database into git and buys nothing. (Fresco untracked its historical 459-file drift for exactly this reason — FRESCO-454, 2026-09-07.)

**THREE TIERS** — every path under `.context/PBI/` is exactly one of these. Check before creating any file:

| Tier | Source of truth | In git? | Recovered by |
|---|---|---|---|
| `[SYNC]` | Jira | No | `bun run context:hydrate` |
| `[COMMIT]` | This repo | **Yes** | `git checkout` |
| `[LOCAL]` | Nothing durable | No | Not recovered — disposable by design |

`[LOCAL]` files (`context.md`, `progress.md`, `evidence/`) MAY be hand-written, but **NOTHING downstream may depend on one existing**: they live only on the machine that made them. Durable session state → `.session/sprint-development/<KEY>/progress.md` (the resume contract already reads it, NOT the PBI copy); durable evidence → Jira (attachment / comment).

**GITIGNORE LADDER** (in `.gitignore`): `.context/PBI/*` → `!.context/PBI/README.md` → `!.context/PBI/templates/`. NEVER collapse it to a plain `.context/PBI/` — git cannot re-include a file whose parent dir is excluded, so a collapse silently drops the committed exceptions. Verify any change with `git check-ignore -v` on `README.md` (must NOT be ignored) and on a `stories/.../story.md` (must be ignored).

**Canonical tree** (Epic-centric; `<KEY>` = Jira key, `<slug>` from summary):

```
.context/PBI/
  README.md                                      [COMMIT] tier rules + gitignore ladder
  templates/                                     [COMMIT] skeletons
  epic-tree.md                                   [SYNC] master index
  epics/EPIC-<KEY>-<slug>/
    epic.md                                       [SYNC]
    feature-implementation-plan.md                [SYNC ← Jira field / stub]
    feature-test-plan.md                          [SYNC ← Jira field / stub]
    stories/STORY-<KEY>-<slug>/
      story.md                                    [SYNC]
      acceptance-criteria.md  scope.md  out-of-scope.md  business-rules.md  workflow.md
      implementation-plan.md                      [SYNC ← Jira `spec_implementation_plan` / stub]
      comments.md                                 [SYNC, --include-comments]
      context.md  progress.md  evidence/          [LOCAL] machine-local, disposable
  bugs/ defects/ improvements/ tests/             [SYNC - standalone issue types]
  test-plans/ test-executions/ test-sets/ preconditions/   [SYNC - Xray container issues (jira-xray); description holds the ATP/ATR body]
```

**`[SYNC]` files = forbidden to hand-write** (overwritten on every sync: NO file is hard-protected; Jira is the source of truth). The dev/feature implementation plan is authored, **pushed to its Jira field** (`spec_implementation_plan` / `feature_implementation_plan`), then read back from the synced `implementation-plan.md` / `feature-implementation-plan.md`. **Rule of thumb**: file mirrors a Jira field → read the synced copy, never author it locally. File holds info NOT in Jira → decide its tier: another machine or a later session needs it → it does NOT belong here (Jira field/comment, or `.session/`); only this machine, this work → `[LOCAL]`.

**COLD CLONE**: a fresh clone has an almost-empty `.context/PBI/` (this README + `templates/`) — the intended state, not a broken checkout. `bun run context:hydrate` (= `jira:sync-issues pull --include-comments`) rebuilds the cache. Requires `ATLASSIAN_EMAIL` / `ATLASSIAN_API_TOKEN` in `.env`; host from `.agents/project.yaml` → `issue_tracker.atlassian_url` (§7).

> Sprint-level cross-ticket aggregate → `.context/reports/SPRINT-{N}-DEVELOPMENT.md` (generated by `/sprint-development` batch). Lifecycle → `.context/reports/README.md`.

**DETAILED READS via the script** (replaces `acli view` for custom fields: `acli view` returns null for custom fields):
- `bun run jira:sync-issues get <KEY> --include-comments` → one issue, ALL custom fields + comments → read the generated `.md`.
- `bun run jira:sync-issues jql "<query>"` → batch. `pull --epic <KEY>` / `--story <KEY>` → scoped.

**FALLBACK**: if a custom field a prompt must fill is absent from the instance, write the content as a structured Jira comment (`## <label>`) per `.agents/jira-required.yaml` → `fallback:`. The sync then emits a pointer stub for that field's `.md`. Never block on a missing field.

**ENTRY POINT**: invoke `/sprint-development`: syncs the ticket (`jira:sync-issues get`), explains story, loads the synced PBI, drives plan → code → review → deploy.

**RESUME SESSION**: `/sprint-development` Phase 0 resume contract: reads `.session/sprint-development/<JIRA-KEY>/progress.md` (per `.agents/skills/agentic-dev-core/references/session-management.md`), surfaces last completed phase, offers resume / restart / abort; the synced story folder + engram supply the content context.

---

## 10. STACK QUICK-REFERENCE (TypeScript + DRY)

> Full TS conventions live in feature dev-guide (Discovery output via `/project-foundation`) if present, else fallback `.agents/skills/agentic-dev-core/references/typescript-patterns.md`. LOAD `/sprint-development` before writing or reviewing feature code.

| Pattern        | Rule                                                                       |
| -------------- | -------------------------------------------------------------------------- |
| **Parameters** | Max 2 positional. 3+ → object param                                        |
| **Utilities**  | Agnostic only, no domain coupling in shared modules                       |
| **Imports**    | Always aliases (`@api/`, `@schemas/`, `@utils/`). No deep relative imports |
| **Types**      | Declare interfaces at top of file, after imports                           |
| **Errors**     | Public methods: fail fast (throw). Utilities: silent fail (return null)    |

**DRY: context matters**:

- `api/schemas/` = OpenAPI type facades (`@schemas/{domain}.types`). Single source of truth.
- Shared utilities = framework-agnostic only. No React, no Next, no Bun-specific APIs.
- Domain logic stays inside feature folder. Move to `shared/` only when ≥2 features import AND abstraction stable.

---

## 11. GIT WORKFLOW: POINTERS

Git / PR work → `/git-flow-master` auto-loads. Full details in `.agents/skills/git-flow-master/` + `docs/workflows/git-flow.md` if present.

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
- Branch-protection parity: `bun run git:policy verify` reconciles `git_strategy` against the host ruleset; `apply` writes it (dry run until `--yes`). See `git-flow-master/references/ruleset-parity.md`.
- See §1 #3-#5 for NO-AI-attribution + push-to-main confirmation + git-history rules.

---

## Git Strategy

> **Source of truth: the `git_strategy:` block in `.agents/project.yaml`.** `git-flow-master` reads it before any git/gh operation and adapts every branch / commit / push / PR / conflict-fix to the strategy declared there. NEVER define branch policy in this AGENTS.md: edit the `git_strategy:` block.
>
> The block ships **filled** as a sane default — `meta.strategy_source` says whether anyone actually chose it: `inherited` = shipped placeholder never confirmed for THIS project; `chosen` = Strategy Setup actually ran (or the equivalent deliberate decision was recorded). On `inherited` (or a `null` strategy), `git-flow-master` OFFERS "Strategy Setup" on the first git intent and fills the block (it never auto-picks). `.agents/project.yaml` is frozen by `bun run up` (updater `bootstrapOnlyPaths`), so this project keeps its own strategy across every future sync.

This project runs `git_strategy.strategy: solo-main` with `meta.strategy_source: chosen` — re-audited 2026-08-29 (finding 08) against real `git log` history (single maintainer, direct pushes to `main` the norm), not a shipped default left untouched. Full reasoning + the dev/staging/main Vercel-mirror detail lives in the block's `description` in `.agents/project.yaml`.

**Branch-protection parity**: `bun run git:policy verify` reconciles the declared `policy.*` values against the live GitHub ruleset; `--stamp` records the result into `git_strategy.meta.policy_verified` / `policy_source`. Re-run after any ruleset change on GitHub's side — a stale stamp is worse than no stamp.

---

## 12. PROACTIVE MEMORY TRIGGERS

Engram MCP configured. Call `mem_save` IMMEDIATELY (no user prompt needed) after ANY of:

- **Architecture / design decision made** (tradeoffs chosen, alternative rejected).
- **Convention or workflow established** (naming, structure, lint rule, branch policy).
- **Bug fix completed**: include root cause, not just fix.
- **Non-obvious discovery, gotcha, or edge case** found.
- **Session close**: MANDATORY `mem_session_summary` before saying "done" / "listo".

Self-check after every task: _did I make decision, fix bug, learn something non-obvious, or establish convention? If yes → `mem_save` NOW._
