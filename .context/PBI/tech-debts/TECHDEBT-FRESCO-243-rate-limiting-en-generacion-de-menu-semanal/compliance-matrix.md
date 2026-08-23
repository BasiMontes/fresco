# Spec Compliance Matrix — FRESCO-243 (Rate limiting en generación de menú semanal)

AC derived in Stage 1 (ticket had no formal AC field — see implementation plan / Jira comment).

| AC scenario | covered_by | evidence | status |
|---|---|---|---|
| Dado un usuario autenticado que hizo <5 generaciones en la última hora, cuando llama a `generate-meal-plan`, entonces la llamada procede normalmente (no 429) | test:rate-limit.test.ts (`assertRateLimitAllowed(true)` no lanza) + review-approved:adversarial-reviewer (atomicidad verificada a mano) | `supabase/functions/generate-meal-plan/rate-limit.test.ts`, `.context/PBI/tech-debts/TECHDEBT-FRESCO-243-rate-limiting-en-generacion-de-menu-semanal/review.md` §Atomicidad | covered |
| Dado un usuario que ya hizo 5 generaciones en la hora en curso, cuando hace la 6ª llamada, entonces recibe 429 con mensaje en español | review-approved:adversarial-reviewer (boundary walk: count 1→5 éxito, 6ª ve count=5, `WHERE count < p_limit` falso, `v_count` NULL, retorna false → 429) + test:rate-limit.test.ts (`assertRateLimitAllowed(false)` lanza HttpError 429) | `review.md` §Atomicidad, `rate-limit.test.ts` | covered |
| Dos requests concurrentes del mismo usuario en el mismo límite (count=4) — exactamente una pasa, la otra recibe 429 (no ambas pasan) | review-approved:adversarial-reviewer (lock de fila en `INSERT ... ON CONFLICT` serializa a los dos writers) | `review.md` §Atomicidad | review-approved — **manual:staging-verification pendiente** (ver DoD en review.md) antes de pasar a Ready For QA; no bloquea merge a `dev` |
| La ventana resetea al cambiar la hora (fixed-window, no acumula entre horas) | review-approved:adversarial-reviewer (lógica `date_trunc('hour', now())` revisada) | migration SQL + `review.md` | review-approved — manual:staging-verification pendiente (ver DoD), no bloquea merge |
| El límite es por usuario, no global ni por IP (dos usuarios distintos no comparten contador) | review-approved:adversarial-reviewer (`primary key (user_id, endpoint, window_start)`, `auth.uid()` self-check impide cross-user) | migration SQL:32-38,68-70 | covered |
| Un caller no puede rate-limitear a otro usuario vía la RPC | review-approved:adversarial-reviewer (self-check `p_user_id <> auth.uid()` bloquea impersonación cross-user) | migration SQL:68-70, `review.md` §Security | covered |

## Gate status

No row is `uncovered`. Two rows carry a pending `manual:staging-verification` note (concurrency + window-reset in a live environment) — required before the ticket reaches Ready For QA per the DoD in `review.md`, not required to merge this PR to `dev` (staging is the environment where the manual check runs).
