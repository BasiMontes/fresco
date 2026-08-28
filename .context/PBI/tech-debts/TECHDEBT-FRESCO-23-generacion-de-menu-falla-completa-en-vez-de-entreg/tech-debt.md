# Tarea: Generación de menú falla completa en vez de entregar parcial con advertencia (AC-4, FR-8.2)

**Jira Key:** [FRESCO-23](https://basiliomontescastano.atlassian.net/browse/FRESCO-23)
**Status:** Finalizada
**Type:** Tarea

---

## Description

***Source spec******:*** FR-8.2, AC Scenario 4 de FRESCO-9

Cuando ninguna receta del catálogo filtrado satisface una regla absoluta (alérgeno, ingrediente no deseado, historial, presupuesto) para una franja concreta, la especificación exige entregar el resto del menú con una advertencia visible explícita para esa franja — nunca fallar el menú completo en silencio, y nunca fallar sin explicación.

## Comportamiento actual

`supabase/functions/generate-meal-plan/validator.ts` trata cualquier franja sin receta válida como un error estructural (`errors.push(...)`), lo que marca `valid: false`. `index.ts` dispara un reintento completo (regenera las 21 franjas desde cero) y, si se agotan los reintentos, lanza `422` — nunca entrega un menú parcial con la advertencia puesta en esa franja específica.

## Comportamiento esperado

Un menú con 20 franjas válidas + 1 franja sin receta seleccionable debería entregarse igual, con esa franja marcada explícitamente en `advertencias` (ya existe el mecanismo — FR-2.10/FR-8.2), en vez de fallar la generación completa.

## Origen

FRESCO-9 (Seguridad Alimentaria) delegó explícitamente esta AC a FRESCO-7 (Generación de Menú) en su propio campo "Fuera de Alcance", razonando que `validator.ts`/`index.ts` eran territorio de esa historia. FRESCO-7 se cerró como Finalizada sin implementar nunca este comportamiento — el gap quedó sin dueño real. Encontrado al revisar el review.md histórico de FRESCO-9 durante un housekeeping de cierre de historias (sesión 2026-07-31).

## Alcance para resolverlo

- `validator.ts`: distinguir "franja sin receta válida" (caso a degradar con advertencia) de otros errores estructurales genuinos (JSON inválido, semana incorrecta) que sí deben seguir siendo hard-fail.
- `index.ts`: aceptar un menú con huecos marcados, no solo 21/21 completo.
- Probablemente requiere que el modelo pueda devolver un `recipe_id` nulo/vacío para esa franja de forma explícita, en vez de que el validador lo detecte post-hoc.

---

## Fields

### Clasificación

0|i0006v:

### customfield_10000

{repository={count=7, dataType=repository}, json={"cachedValue":{"errors":[],"summary":{"repository":{"overall":{"count":7,"lastUpdated":"2026-07-31T23:57:38.000+0200","dataType":"repository"},"byInstanceType":{"oAuth-com.github.integration.production":{"count":7,"name":"GitHub"},"GitHub":{"count":7,"name":"GitHub"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 7/31/2026
- **Updated:** 7/31/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** master-sprint-0, tech-debt

---

_Synced from Jira by sync-jira-issues_
