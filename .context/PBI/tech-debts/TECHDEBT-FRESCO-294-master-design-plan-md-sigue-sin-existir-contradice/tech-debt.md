# Tarea: `master-design-plan.md` sigue sin existir — contradice la Regla 14 de CLAUDE.md

**Jira Key:** [FRESCO-294](https://basiliomontescastano.atlassian.net/browse/FRESCO-294)
**Status:** Listo
**Type:** Tarea

---

## Description

## Contexto

Re-auditoría 27 ago 2026, hallazgo 15 (BAJO), eje Diseño. El baseline ya lo marcó (dentro de "boilerplate congelado"); SIN TOCAR.

## Hallazgo

`.context/design/master-design-plan.md` no existe (`.context/design/` y `.context/designs/` tampoco). La ***Regla 14 de CLAUDE.md*** (UI FIDELITY CONTRACT) dice: "story has UI → look it up in `.context/design/master-design-plan.md` §8 … Story missing from §8 → STOP, offer …". 9 ficheros de skills lo referencian.

En la práctica se resuelve LIVE-UI-FIRST + contra el mockup de Jira — funciona, pero cada historia de UI técnicamente debería disparar el STOP de la Regla 14. `DESIGN.md` (root) SÍ existe y está mantenido; la deriva es solo el mapa de pantallas.

## Solución propuesta

Una de dos:

1. Correr la fase opt-in de screen-mapping de `/design-system` para generar `master-design-plan.md` (US→pantalla + tokens congelados + registro de divergencias).
2. Suavizar la Regla 14 a "si existe el mapa, úsalo; si no, LIVE-UI-FIRST + mockup de Jira" — y quitar el STOP obligatorio.

## Retorno esperado

La Regla 14 deja de estar en contradicción permanente con la realidad del proyecto.

---

## Fields

### Clasificación

0|i001un:

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
