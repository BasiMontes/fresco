# Tarea: ADR-0014: afilar la señal de revisión #2 con un umbral + añadir la race de CI como señal #4

**Jira Key:** [FRESCO-295](https://basiliomontescastano.atlassian.net/browse/FRESCO-295)
**Status:** Listo
**Type:** Tarea

---

## Description

## Contexto

Re-auditoría 27 ago 2026, sección "Arquitectura". ADR-0014 (playwright-bdd vs KATA, FRESCO-270) es un ADR real y bien hecho —condición de expiración, 3 señales de revisión, alternativas rechazadas con motivo—. Dos afilados.

## Hallazgo

1. ***La señal de revisión #2 no tiene umbral.*** Dice "cuando el número de escenarios haga que la CI de un solo worker sea un cuello de botella". Sin un número ("> ~8 min de reloj" o "> 60 escenarios `@automatizado`") el trigger no es falsable. La suite ya va por 31 automatizados / 139 catalogados.
2. ***Falta una cuarta señal***, escondida a plena vista (ver ticket 11): los jobs de CI en paralelo ya chocan con el problema de estado compartido de `@aprendizaje` que `workers:1` supuestamente retiró. Factorías de datos matan las dos cosas a la vez — es lo que inclinaría la balanza hacia migrar, y ya está pasando.

Menor: el ADR cita al auditor del baseline 3 veces; sería más fuerte apropiándose de la decisión sin apelar a la autoridad de un tercero.

## Plan de acción

1. Editar ADR-0014: número concreto en la señal #2.
2. Añadir señal de revisión #4: "la race de estado compartido entre jobs de CI (ticket de re-auditoría 11) obliga a factorías de datos de todas formas".
3. Opcional: reescribir el párrafo de contexto para que la decisión se sostenga sola.

## Retorno esperado

El ADR queda con triggers falsables. Cuando toque revisar la decisión, habrá una señal objetiva, no una sensación.

---

## Fields

### Clasificación

0|i001uv:

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
