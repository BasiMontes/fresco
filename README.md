# Fresco

**Fresco generates a full weekly menu (21 meals) and an aisle-grouped shopping list in
under 30 seconds, and gets better week over week by learning from what a household
actually cooks — not from what they say they like.**

It is not a recipe-discovery app. It removes the weekly *"what do I cook this week?"*
planning decision: a 3-step onboarding (diet, favourite cuisines, household size) produces
an editable drag-and-drop calendar plus a zero-maintenance shopping list. A `cooked /
discarded` toggle per recipe feeds the behavioural-learning moat (Pro tier). Guest mode
generates one full menu with no signup.

Full product context: [`.context/PRD/`](.context/PRD/) ·
business model: [`.context/business/`](.context/business/) ·
target user: Laura, the exhausted planner ([`.context/PRD/user-personas.md`](.context/PRD/user-personas.md)).

---

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind · Zod ·
Supabase (Postgres + Auth + Edge Functions) · Vercel hosting ·
Playwright + `playwright-bdd` for E2E · Bun as runtime and test runner · Sentry.

Architecture contract: [`.context/SRS/architecture.md`](.context/SRS/architecture.md).
The system surface is three authenticated Supabase Edge Functions
(`generate-meal-plan`, `generate-shopping-list`, plus the learning function) —
see [`.context/SRS/api-contracts.md`](.context/SRS/api-contracts.md).

---

## Environments

| Env | Branch | URL | Notes |
| --- | --- | --- | --- |
| Development | `dev` | https://fresco-dev.vercel.app | Auto-follows the `dev` branch HEAD. Feature PRs land here first. |
| Pre-production | `staging` | https://fresco-pre.vercel.app | Manually aliased to the latest `staging` Preview — verify with `vercel inspect fresco-pre.vercel.app` before trusting it. |
| Production | `main` | https://fresco-pro.vercel.app | Real auto-following Vercel Production domain. |

Promotion is `dev` → `staging` → `main` (fast-forward). All three branches share one
Supabase project. Per-environment values live in
[`.agents/project.yaml`](.agents/project.yaml); credentials live in `.env` (never hardcoded).

---

## Running locally

```bash
bun install
cp .env.example .env    # then fill in the values — see .env.example comments
bun run dev             # Next.js dev server on http://localhost:3000
```

Anything that calls an **Edge Function from the browser** (menu generation,
marking a recipe, deleting an account, guest reassignment) must run against a
**local Supabase stack**, not the hosted project — the hosted CORS allowlist
does not include `localhost` (FRESCO-364 / A4-L2). Start it and point `.env`
at it, the same way CI does:

```bash
supabase start
supabase db reset                 # migrations + seed.sql
bun scripts/seed-e2e-users.ts     # the fixed DEV_USER / PRO_USER accounts
cat .env.ci >> .env               # local-stack URLs + keys win over the hosted ones
```

### Tests

```bash
bun test                    # unit tests (Bun test runner)
bun run test:e2e            # Playwright + playwright-bdd, against localhost
bun run test:e2e:smoke     # @smoke-tagged E2E subset only
bun run test:e2e:staging   # E2E against https://fresco-pre.vercel.app
bun run test:e2e:production # E2E against https://fresco-pro.vercel.app
```

### Quality gate

```bash
bun run repo:check    # format + lint + types + vars + skills checks (what CI runs)
bun run repo:fix      # same, autofixing what it can
```

All scripts are defined in [`package.json`](package.json) — read it there, it is the
source of truth.

---

## Where the documentation lives

| Path | What it holds |
| --- | --- |
| [`.context/PRD/`](.context/PRD/) · [`.context/SRS/`](.context/SRS/) | Product and software requirements |
| [`.context/business/`](.context/business/) | Business model, market context, data / feature / API maps, domain glossary |
| [`.context/PBI/`](.context/PBI/) | Per-epic and per-ticket backlog cache (synced from Jira) |
| [`.context/ADR/`](.context/ADR/) | Architecture Decision Records (append-only) |
| [`CLAUDE.md`](CLAUDE.md) | Operational rules loaded every AI session |
| [`CONTEXT.md`](CONTEXT.md) | How this repo structures context for AI agents |
| [`docs/`](docs/) | Human-facing guides (architecture, workflows, MCP setup) |
| [`docs/boilerplate.md`](docs/boilerplate.md) | The upstream `agentic-dev-boilerplate` framework this repo is built on |

Jira: [FRESCO project](https://basiliomontescastano.atlassian.net/browse/FRESCO).

---

## License

MIT — see [`LICENSE`](LICENSE).
