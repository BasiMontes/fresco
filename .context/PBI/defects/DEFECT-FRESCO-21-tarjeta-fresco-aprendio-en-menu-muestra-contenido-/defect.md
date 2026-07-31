# DEFECT: Tarjeta "Fresco aprendió" en /menu muestra contenido fabricado para toda usuaria (FR-5.5/5.6 sin implementar)

**Jira Key:** [FRESCO-21](https://basiliomontescastano.atlassian.net/browse/FRESCO-21)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

***Source spec******:*** FR-5.5, FR-5.6

La tarjeta "Fresco aprendió" en `/menu` era JSX estático hardcodeado ("Descartaste el curry picante la semana pasada..."), renderizado sin ninguna condición para cualquier usuaria — Free, Pro, o invitada anónima con cero historial. No leía ningún dato real.

## Comportamiento observado

Toda visita a `/menu` con un plan generado mostraba la misma frase fija, sin importar el tier del usuario ni si alguna vez marcó algo como cocinado/descartado. Confirmado en vivo dos veces esta sesión (FRESCO-17, FRESCO-19), incluyendo con una invitada recién creada sin ningún historial posible.

## Comportamiento esperado

Por `FR-5.5`: la explicación visible solo debe aparecer para usuarias ***Pro*** con historial real, usando texto generado por Gemini (ya implementado correctamente en `supabase/functions/generate-meal-plan/prompt.ts`, línea ~115 — el problema nunca estuvo ahí). Por `FR-5.6`: usuarias Free deben ver un mensaje de upsell explícito, no la tarjeta de aprendizaje ni silencio.

## Causa raíz

1. El texto real generado por Gemini para FR-5.5 se guarda en el array genérico `advertencias` (compartido con las advertencias de seguridad alimentaria de FR-2.10/FR-8.2) — sin ningún campo que distinga "explicación de aprendizaje" de "advertencia de seguridad". Solo se renderiza vía `AlertBanner`.
2. La tarjeta `card-insight` dedicada (DESIGN.md, pensada exactamente para esto) se quedó como mockup de la primera versión de `/project-bootstrap` y nunca se conectó a datos reales cuando `FRESCO-7` wireó el resto de la página.
3. `EPIC-FRESCO-5` (FRESCO-14, todavía "Listo") solo tiene sembrada su historia fundacional `FRESCO-15` (US 5.1 — el toggle cocinado/descartado). Las historias para US 5.2/5.3 (generación con historial + esta explicación) nunca se sembraron — por eso nadie construyó la versión real.

## Fix aplicado ahora (mínimo)

Se eliminó la tarjeta hardcodeada de `app/(app)/menu/page.tsx` — ya no fabrica un evento de aprendizaje falso para nadie. Verificado en vivo: `/menu` renderiza limpio sin ella, sin errores de consola.

## Pendiente (fuera de este fix — requiere historia propia)

- Separar la explicación de aprendizaje (FR-5.5) de las advertencias de seguridad (FR-2.10/FR-8.2) en la respuesta del Edge Function — hoy comparten el mismo array `advertencias` sin discriminador.
- Gatear la tarjeta de explicación por `isPro` + historial real.
- Implementar el mensaje de upsell Free-tier (FR-5.6).
- Seedear la historia US 5.2/5.3 bajo `EPIC-FRESCO-5` (FRESCO-14) vía `/product-management` antes de construir esto.

---

## Related Issues

- relates to: [FRESCO-14](https://basiliomontescastano.atlassian.net/browse/FRESCO-14) - Aprendizaje Cocinado/Descartado

---

## Metadata

- **Created:** 7/31/2026
- **Updated:** 7/31/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** bug, master-sprint-2

---

_Synced from Jira by sync-jira-issues_
