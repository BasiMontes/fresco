# Tarea: Rotar `bitacora.md` (373 entradas vs regla propia de 50)

**Jira Key:** [FRESCO-291](https://basiliomontescastano.atlassian.net/browse/FRESCO-291)
**Status:** Listo
**Type:** Tarea

---

## Description

## Contexto

Re-auditoría 27 ago 2026, hallazgo 14 (BAJO), eje Uso del agente.

## Hallazgo

`.context/bitacora.md`: 4.232 líneas, 666 KB, ***373 entradas****. La Regla 15 de CLAUDE.md dice: "ROTACIÓN AUTOMÁTICA: si el archivo supera las 50 entradas, proponer `mv` a `bitacora-YYYY-MM.md` y crear uno nuevo". Nunca se ha propuesto (0 ficheros `bitacora-**.md`).

La misma regla dice que la IA "lo lee primero para contexto rápido en sesión nueva" — 666 KB ≈ 170K tokens no es rápido. Calidad de las entradas: alta (formato Qué/Por qué/Siguiente, honestas). El problema es volumen sin rotación.

## Plan de acción

1. `mv .context/bitacora.md .context/bitacora-2026-07-08.md`.
2. Crear `bitacora.md` nuevo con las últimas ~15 entradas + un índice apuntando al archivado.
3. Considerar automatizar el chequeo de 50 entradas.

## Retorno esperado

El arranque de sesión deja de tragarse ~170K tokens de bitácora histórica.

---

## Fields

### Clasificación

0|i001tz:

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
