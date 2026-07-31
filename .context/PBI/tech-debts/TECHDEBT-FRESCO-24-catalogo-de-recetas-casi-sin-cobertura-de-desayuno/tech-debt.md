# Tarea: Catálogo de recetas casi sin cobertura de desayuno/cena — modelo sustituye con comida

**Jira Key:** [FRESCO-24](https://basiliomontescastano.atlassian.net/browse/FRESCO-24)
**Status:** Listo
**Type:** Tarea

---

## Description

## Description

Catálogo real de recetas (`public.recipes`, ~35 filas sembradas por el proceso de batch-generation-plus-manual-review del founder) tiene prácticamente cero recetas etiquetadas específicamente `desayuno` o `cena` en `clasificacion.tipo_plato` — la mayoría son `comida`.

## Comportamiento actual

Confirmado en vivo (sesión 2026-07-31, generación real vía Gemini): el modelo compensa sustituyendo recetas `comida` en franjas de desayuno/cena, con advertencia explícita ("No hay recetas etiquetadas específicamente para desayuno o cena en el catálogo proporcionado, por lo que se adaptaron platos generales para cubrir esas franjas."). Funciona (FR-2.10/FR-8.2 ya cubre el caso), pero degrada la calidad percibida del menú semanal — dos de las tres franjas diarias siempre corren con sustitución.

## Comportamiento esperado

Catálogo con cobertura real de `desayuno` y `cena`, no solo `comida`, para que el modelo no tenga que sustituir sistemáticamente.

## Origen

`master-implementation-plan.md` ya documenta el target de ~230 recetas vía el proceso de batch-generation-plus-manual-review del founder — ese proceso sigue corriendo en paralelo, fuera del código de la app. Este ticket es solo la señal: el gap de cobertura por tipo de plato, no una feature de ingeniería nueva.

## Alcance para resolverlo

No es un ticket de código — es contenido. Al founder: sembrar recetas `desayuno`/`cena` reales en el próximo batch, pasando la misma revisión manual de seguridad alimentaria que el resto del catálogo (EPIC-8). Ningún cambio de esquema ni de Edge Function necesario — la degradación con advertencia ya funciona correctamente mientras tanto.

---

## Fields

### Clasificación

0|i00073:

### customfield_10000

{}

---

## Metadata

- **Created:** 7/31/2026
- **Updated:** 7/31/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** catalog-content, master-sprint-0, tech-debt

---

_Synced from Jira by sync-jira-issues_
