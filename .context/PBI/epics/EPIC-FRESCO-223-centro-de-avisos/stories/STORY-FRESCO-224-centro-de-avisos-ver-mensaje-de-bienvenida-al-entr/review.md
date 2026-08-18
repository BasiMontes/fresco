# Code Review — FRESCO-224

PR: https://github.com/BasiMontes/fresco/pull/94 (feature/FRESCO-224-centro-avisos-bienvenida → staging)

## Adversarial pass (Solo mode, orchestrator-run)

No legitimate findings. Diff mirrors existing `getUserPlan`/`getUserNombre`/`updateNombre` patterns exactly (conservative-default reads, fail-fast writes, `userId` escape hatch). No secrets, no new RLS surface (same `.update().eq('id', user.id)` shape `updateNombre` already uses successfully).

Noted, not a defect: existing users (onboarded before this migration) default to `aviso_bienvenida_visto = false` and will see the welcome notice once on their next `/notifications` visit — consistent with "hasn't seen it yet", not scoped out by AC/OOS.

## Spec Compliance Matrix

| AC scenario (Gherkin) | covered_by | evidence | status |
|---|---|---|---|
| Primera visita muestra bienvenida | manual + test | Playwright CLI live run (dev server, real login) — welcome card rendered; `getShouldShowWelcomeNotice` unit tests | covered |
| La bienvenida no vuelve a aparecer | manual | Playwright CLI reload after first render — card gone | covered |
| Usuaria sin onboarding completo | test:getShouldShowWelcomeNotice | `lib/api/user-profile.test.ts` — "returns false when no profile row exists yet" | covered |

Static checklist: lint/types/tests green (30/30). Live-UI validated against running dev server (never a production build). Docs: no `shift-left-status-report.md`/`release-notes.md` in this repo — skipped, nothing to update.
