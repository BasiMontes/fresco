# Tarea: Git: alinear la estrategia declarada en `project.yaml` con la práctica real

**Jira Key:** [FRESCO-286](https://basiliomontescastano.atlassian.net/browse/FRESCO-286)
**Status:** Listo
**Type:** Tarea

---

## Description

## Contexto

Re-auditoría 27 ago 2026, hallazgo 08 (MEDIO), eje Trazabilidad.

## Hallazgo

`.agents/project.yaml` `git*strategy` (`meta.updated: 2026-08-21`): `strategy: enterprise`, tres niveles `main ← staging ← dev`, `promote*method: ff-only`, `feature*merge: merge-commit`, `direct*push*to*protected: confirm`.

Práctica desde el 21 de agosto (`git log --first-parent main --since=2026-08-21`): 73 commits → 22 merges, ***51 commits directos (no-merge)****. Varios PRs llegaron a `main` como ****squash*** (`#134`–`#143`), no como merge-commit. Commits directos a `main` sin PR (`9a88eb5`, `8762a3d`, `f3998c3`, ~40 `docs: log … in bitacora`). La propia bitácora (27 ago) admite: "los 4 PRs (#151-#154) se fusionaron directo a `main` (bypass del flujo normal)".

Mitigantes: proyecto de un mantenedor, los 3 branches acaban siempre en el mismo SHA, reconciliación `ff-only` disciplinada, reflog limpio, 98,6% de commits convencionales.

## Solución propuesta

Decidir cuál es el flujo real y hacer que el doc coincida:

- Si es "todo a `main` directo + ff a dev/staging" → volver `git_strategy.strategy` a `solo-main` y dejar de dirigir `git-flow-master` con un doc aspiracional.
- Si se quiere el de tres niveles → hacerlo cumplir (PRs a `dev`, merge-commit, promoción ff).

## Retorno esperado

`git-flow-master` deja de operar contra una estrategia que nadie sigue. Menos fricción, menos reconciliaciones a posteriori.

---

## Fields

### Clasificación

0|i001sv:

### customfield_10000

{}

---

## Metadata

- **Created:** 8/27/2026
- **Updated:** 8/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-2

---

_Synced from Jira by sync-jira-issues_
