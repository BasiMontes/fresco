# IMPROVEMENT: Onboarding: copy de éxito al generar menú + CTA principal debe ser "Ver mi menú" cuando ya existe plan

**Jira Key:** [FRESCO-152](https://basiliomontescastano.atlassian.net/browse/FRESCO-152)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `app/onboarding/page.tsx`, paso 4 de 4 (`handleGenerate` y el botón `Generar mi menú`).
- Feedback directo del user sobre el flujo ya corregido en FRESCO-104: cuando ya existe un menú para la semana, hoy se muestra el aviso "Ya existe un menú para esta semana." + un link secundario "Ver mi menú actual" — pero el botón principal sigue diciendo "Generar mi menú" (con estilo de warning/naranja), lo que sigue invitando a una acción que no puede completarse.

## Cambio propuesto

1. Cuando la generación es la primera y tiene éxito, mostrar un copy de confirmación explícito tipo "Se ha generado tu menú correctamente" antes/durante la redirección a `/menu` (hoy no hay ningún mensaje de éxito, solo redirect silencioso).
2. Cuando ya existe un menú para la semana (caso 409): el botón principal debe pasar a decir ***"Ver mi menú"*** en vez de mantener "Generar mi menú" como acción primaria — con menor énfasis visual (según el user: "un copy sin darle mucha importancia", es decir texto/botón secundario, no el CTA naranja destacado que hoy ocupa ese lugar).

## Alcance

Cambio de copy + de qué botón es la acción primaria en `app/onboarding/page.tsx` paso 4. No requiere cambios de backend — el 409 y el link a `/menu` ya existen (FRESCO-104); esto es refinar la jerarquía visual y el mensaje.

## Referencia

Captura adjunta por el user muestra el estado actual: botón "Generar mi menú" en naranja como CTA principal, con el aviso de menú existente y el link "Ver mi menú actual" en texto plano debajo.

---

## Metadata

- **Created:** 8/9/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
