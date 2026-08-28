# Tarea: Contexto y planificación: re-sync del cache PBI, refresco de planes, decisión sobre `review.md`, estimación

**Jira Key:** [FRESCO-290](https://basiliomontescastano.atlassian.net/browse/FRESCO-290)
**Status:** Listo
**Type:** Tarea

---

## Description

## Contexto

Re-auditoría 27 ago 2026, hallazgos 12 y 13 (MEDIO), ejes Uso del agente + Backlog.

## Hallazgo

- ***Cache PBI stale***: `.context/PBI/` lleva 6 días y 232 commits atrás (107 carpetas de defecto vs 122 bugs; 37 de historia vs 43). CLAUDE.md §9 dice que `/sprint-development` "carga el PBI sincronizado" — el que se carga está desfasado.
- `review.md`*** por historia cortado el 21 ago***: 28/37 historias tienen `review.md`, 24 `compliance-matrix.md`; el más reciente es del 21 ago. Épicas 223/227/244 y todos los fixes del 25–27 ago sin artefacto de review local.
- ***Docs de planificación caducados***: `master-implementation-plan.md` 19 días (le faltan 3 épicas + todo Stripe); `epic-tree.md` sin la épica Motion (244).
- ***Cero estimación***: Story Points 0/262. Sin velocidad, sin forecast.
- ***2 races de merge*** perdieron contenido de docs de contexto (`dev-roadmap.md` EPIC-FRESCO-244; ediciones directas de `CLAUDE.md`), recuperado del historial.

## Plan de acción

1. `bun run jira:sync-issues jql "project = FRESCO"` — re-materializar el cache.
2. `/master-implementation-plan` + `/dev-roadmap` — refrescar planes con las 5 épicas de agosto.
3. Decidir: ¿el `review.md` por historia sigue en el flujo de `/sprint-development` o se retira formalmente? Si sigue, ponerse al día con las historias sin él.
4. Empezar a estimar (Story Points) las historias nuevas.

## Retorno esperado

`/sprint-development` vuelve a cargar contexto actual. Los planes reflejan la realidad. Señal de tamaño para priorizar.

---

## Fields

### Clasificación

0|i001tr:

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
