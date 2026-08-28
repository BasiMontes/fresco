# Tarea: Jira: el tablero es un Kanban genérico de 7 estados; el flujo rico solo vive en `.agents/`

**Jira Key:** [FRESCO-287](https://basiliomontescastano.atlassian.net/browse/FRESCO-287)
**Status:** Listo
**Type:** Tarea

---

## Description

## Contexto

Re-auditoría 27 ago 2026, hallazgo 09 (MEDIO), eje Backlog. Análisis del changelog de los 262 items.

## Hallazgo

Un solo workflow para todos los tipos de trabajo, todavía llamado "Software workflow for project KAN" (nombre por defecto de la plantilla). Tablero todavía "KAN board". ***7 estados físicos***: Listo · WIP · Merged · Control de calidad · Blocked · Rechazos · Finalizada.

El flujo rico de `.agents/jira-workflows.json` (`shift*left*qa`, `qa*approved`, `ready*for*release`, `deployed*to*production`, `in*test`, `in*automation`…) es un ***catálogo de alias local***: cada alias colapsa (`to*canonical`) sobre uno de los 7. No hay `qa*approved` distinto de `ready*for_qa` — ambos son `Control de calidad`.

Síntomas:

- `Control de calidad` mezcla esperando-QA / pasó-QA / aparcado (FRESCO-239–243, backlog sin empezar, llevan ahí 6 días).
- `Merged` es un dead-letter (FRESCO-204/211/214/220, ~10 días sin avanzar).
- Estados de épica sin mantener: FRESCO-81 (Cuenta) y FRESCO-223 (Centro de Avisos) en `Listo` con ***todos los hijos Finalizada***.
- `Listo` dobla como backlog + ready-for-dev.

## Solución propuesta

O añadir estados reales al workflow (Ready-for-QA, QA-Passed, In-Review, Backlog), o dejar de reclamarlos en `.agents/` y aceptar el modelo de 7 estados. Renombrar "KAN board" y el workflow a algo de FRESCO de paso.

## Retorno esperado

El tablero deja de mentir sobre su propia madurez. Es lo primero que ve un evaluador externo.

---

## Fields

### Clasificación

0|i001t3:

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
