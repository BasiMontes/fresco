# Code Review — FRESCO-225

PR: https://github.com/BasiMontes/fresco/pull/95 (feature/FRESCO-225-centro-avisos-rutas-principales → staging)

## Adversarial pass (Solo mode, orchestrator-run)

No legitimate findings. Read/write pair mirrors FRESCO-224's `getShouldShowWelcomeNotice`/`markWelcomeNoticeSeen` exactly. Client dismiss button uses the same client-Supabase pattern `NombreForm` already uses for `updateNombre` — no new RLS surface. `CardHeader` className override verified safe (`cn()` uses `tailwind-merge`, resolves `flex-col`→`flex-row` correctly, no class-order footgun).

Noted, not a defect: dismiss is optimistic (hides locally before the write resolves) — a failed persist just means it may reappear once more on a later visit, same conservative trade-off as every other flag in this feature.

## Spec Compliance Matrix

| AC scenario (Gherkin) | covered_by | evidence | status |
|---|---|---|---|
| Veo el aviso de rutas principales | manual + test | Playwright CLI live run — notice rendered with Menú/Calendario/Lista links; `getShouldShowRoutesNotice` unit tests | covered |
| Sigo un enlace del aviso | manual | Playwright CLI — clicked "Calendario" link, navigated to `/calendar` | covered |
| Descarto el aviso | manual + test | Playwright CLI — dismiss click hides card, survives reload (server-persisted); `markRoutesNoticeDismissed` unit tests | covered |

Static checklist: lint/types/tests green (39/39). Live-UI validated against running dev server. No `shift-left-status-report.md`/`release-notes.md` in this repo — skipped, same as FRESCO-224.
