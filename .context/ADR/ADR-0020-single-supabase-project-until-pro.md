# ADR-0020 — One Supabase project for all environments until Supabase Pro

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** Founder (approved live in-session); AI workflow drafted
- **Tags:** infrastructure, environments, cost, cross-cutting-invariant, deployment-topology
- **Supersedes:** —
- **Superseded by:** —

---

## Context

`local`, `dev`, `staging`, and `production` all point at a **single** Supabase
project — `jdqemhewjrjuopssdurn` (Fresco, eu-west-1). The environment split is
real at the Vercel / branching layer (each branch has its own auto-following
domain) but **not** at the database layer: every environment reads and writes
the same Postgres, Auth, and Storage.

Supabase's free tier allows **two** active projects. A properly isolated
production project would need either the second free slot (leaving nothing
for scratch / a future second app) or Supabase Pro (~$25/mo), which the
project — a course/demo build with no revenue — does not currently justify.

The shared-project setup has already caused real incidents:
- FRESCO-310: the CI e2e suite was writing to the production database with a
  production client, contaminating the recipe catalog and the cohort's data.
- FRESCO-311: the deploy gate didn't cover the commit that actually reached
  production.
- audit-4 A4-M7 / A4-M13 and others repeatedly flagged "CI/tooling can touch
  prod" as a class of risk.

Audit-4 raised A4-M11: *"isolate production in its own Supabase project"*.
This ADR is the deliberate decision **not** to do that yet, with the triggers
that would flip it.

## Decision

**We will keep one Supabase project for all environments, and defer a
dedicated isolated production project until Supabase Pro is affordable (or a
reopen trigger below fires).** The invariant that makes this acceptable:

> **No CI job, scheduled workflow, smoke test, or local dev process may run
> with credentials that point at the hosted Supabase project for a
> *write* path.** Reads with the prod anon key are tolerated; writes are not.

Mitigations that uphold the invariant today:
- **CI e2e runs against an ephemeral local Supabase stack** (`supabase start`
  in the runner), never the hosted project — ADR-0017.
- **`pr-check.yml` has an explicit guard step** ("Assert e2e is isolated from
  the prod Supabase project") that greps every `SUPABASE_*` /
  `NEXT_PUBLIC_SUPABASE_*` var for `*.supabase.co` / the project ref and
  fails the job loudly if any points at the hosted project.
- **`post-deploy-smoke` is read-mostly** and any write path it exercises uses
  a dedicated throwaway identity, not real cohort data (FRESCO-322 / FRESCO-329
  trimmed the smoke set for exactly this reason).
- **Migrations reach prod only via a manual `supabase db push`** by the sole
  maintainer — no automation applies schema to the hosted project.
- **`scripts/check-migration-drift.ts` + `scripts/check-seed-drift.ts`** run
  on a schedule (read-only) and open an issue if the repo and prod diverge.

## Consequences

**Positive:**
- Zero infra cost; the second free-tier project slot stays available.
- One migration ledger, one seed fixture, one schema to reason about — no
  cross-project drift to manage (which is itself a source of incidents).
- Simple mental model for a solo maintainer.

**Negative / trade-offs:**
- **Blast radius:** a bad migration, a `DELETE` without a `WHERE`, or a
  runaway script hits the data that serves real users. The maintainer must
  treat every hosted-project write as a production write.
- The isolation invariant is enforced by a **grep guard and discipline**, not
  by the credentials being physically incapable of reaching prod. A new var
  name the guard doesn't check is a gap.
- Cohort analytics can be polluted by non-user traffic if a mitigation slips
  (this is the exact FRESCO-310 failure mode).
- Load / rate-limit / storage quotas are shared: a CI run or a load test
  eats the same budget prod users do.

**Neutral / follow-ups:**
- FRESCO-328 tracks the eventual split; it stays **deferred**, not closed.
- If the split happens, `.agents/project.yaml`'s `environments[*].db_project_ref`
  is the single place the per-env ref is recorded — that's the seam.

## Reopen triggers

Revisit this decision (write a superseding ADR and do the split) when **any**
of these becomes true:

1. **`post-deploy-smoke` (or any scheduled job) starts writing to the hosted
   project again** — the FRESCO-310 failure mode recurring means the guard
   discipline has failed and physical isolation is now required.
2. **A second committer joins.** The blast radius of a shared prod DB
   multiplies with each person who can push a migration, and the "every
   hosted write is a prod write" discipline stops being holdable by one
   person's habits.
3. **The project crosses a Supabase free-tier ceiling** (DB size, MAU, egress,
   Edge Function invocations) — a paid plan is then already on the table, so
   Pro + a second project is a small delta.
4. **Fresco takes real users / revenue** (public launch beyond the closed
   cohort, or any paid Stripe subscription that isn't a test) — production
   data isolation is table stakes at that point.
5. **A cohort-data contamination incident** traceable to the shared project
   occurs — the risk this ADR accepts has materialised and the cost has been
   paid once already.

## Alternatives considered

- **Use the second free-tier project for an isolated production now.**
  Rejected: it consumes the only spare slot (no room for a scratch project or
  a future second app) and still leaves `dev`/`staging`/`local` sharing one
  project among themselves, which is where most of the CI-touches-a-shared-DB
  risk actually lives.
- **Buy Supabase Pro now and split properly.** Rejected on cost — no revenue,
  a demo/course context, and the mitigations above hold the invariant well
  enough for a closed cohort. This becomes the obvious move the moment
  trigger 3 or 4 fires.
- **Branch databases (Supabase's preview-branch feature).** Rejected: also a
  Pro feature, and it solves ephemeral PR isolation (which ADR-0017 already
  covers with the local stack) rather than the standing prod-vs-non-prod
  split this ADR is about.

## References

- audit-4 A4-M11 — the "isolate production" finding this ADR answers.
- FRESCO-328 — the deferred split (kept open).
- FRESCO-310 / FRESCO-311 — the incidents that made the shared-project risk
  concrete.
- ADR-0017 — CI e2e on an ephemeral local stack (the main mitigation).
- `.github/workflows/pr-check.yml` — the "Assert e2e is isolated" guard step.
- `.agents/project.yaml` — `environments[*].db_project_ref`, all currently
  `jdqemhewjrjuopssdurn`.
