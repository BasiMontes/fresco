# Tarea: ADR: por qué seguimos en playwright-bdd (no migrar a KATA)

**Jira Key:** [FRESCO-270](https://basiliomontescastano.atlassian.net/browse/FRESCO-270)
**Status:** WIP
**Type:** Tarea

---

## Description

## Contexto

La auditoría externa (Dojo, Ely, 14 ago 2026) comparó la arquitectura de tests actual — `playwright-bdd` + Gherkin en español, `workers: 1` justificado por estado compartido — contra KATA, la arquitectura por capas del repo de QA (ATC como unidad mínima atómica, factorías de datos para paralelismo real, trazabilidad `@atc('FRESCO-XXX')`).

La propia recomendación de la auditoría fue clara: ***no migrar ahora***. El diseño actual con BDD es correcto mientras el repo de desarrollo sea la única casa de los tests. Verificado el 26 ago 2026: ninguno de los 13 ADRs reales del repo documenta esta decisión.

## Solución propuesta

Escribir el ADR con la decisión explícita "seguimos en playwright-bdd" y las señales concretas que sí justificarían una migración futura, para que la decisión tenga dueño dentro de tres meses en vez de depender de la memoria.

## Plan de acción

1. Crear `.context/ADR/ADR-00XX-testing-architecture-playwright-bdd.md` a partir de `ADR-NNNN-template.md`.
2. Documentar:
3. Marcar `Status: Accepted`.

---

## Fields

### Clasificación

0|i001pb:

### customfield_10000

{}

---

## Metadata

- **Created:** 8/26/2026
- **Updated:** 8/26/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-dojo

---

_Synced from Jira by sync-jira-issues_
