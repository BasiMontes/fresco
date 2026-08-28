# EPIC: Re-auditoría técnica agosto 2026 — remediación

**Jira Key:** [FRESCO-278](https://basiliomontescastano.atlassian.net/browse/FRESCO-278)
**Priority:** Medium
**Status:** Listo
**Total Story Points:** 0

---

## Description

## Contexto

Re-auditoría técnica interna del 27 de agosto de 2026 (cuatro subagentes en paralelo: repo/git, backlog+Jira vía acli, suite de tests+CI, y Playwright a 390 px sobre producción), contrastada con el baseline de Dojo/Ely del 14 de agosto (4,7/5).

Resultado global: ***~******3,7 / 5***. Movimiento por eje: Fundación 5,0→3,5 · Backlog 5,0→3,5 · Trazabilidad 5,0→4,0 · Diseño 4,0→3,5 · Testabilidad 4,0→3,5 · Uso del agente 5,0→4,3. La caída es profundidad de inspección (esta pasada llegó al tablero de Jira, al contraste real y a branch protection) + deriva de agosto, no regresión: el baseline se accionó bien (5 de 6 tickets cerrados en 13 días).

## Patrón común de los hallazgos ALTO

Tres de los cinco ALTO son la misma forma: ***algo construido que todavía no muerde***. La CI corre en cada PR pero ninguna rama exige sus checks. Los campos de QA estructurada de Jira existen y están al 0%. El token primario ámbar está en la hoja de estilos y falla el contraste AA.

## Alcance de esta épica

17 tickets hijos, etiquetados `auditoria-2`, ordenados por retorno: 5 ALTO (CI que bloquea, campos de Jira, defectos huérfanos, contraste ámbar), 7 MEDIO, 5 BAJO. El informe completo autónomo está en `scratchpad/audit2/reauditoria-fresco.html`.

---

## Metadata

- **Created:** 8/27/2026
- **Updated:** 8/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-2

---

_Synced from Jira by sync-jira-issues_
