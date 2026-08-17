# DEFECT: [MINOR] Catálogo: ingredientes sin tilde/ñ en parte de las recetas (brócoli, champiñones, limón, etc.)

**Jira Key:** [FRESCO-196](https://basiliomontescastano.atlassian.net/browse/FRESCO-196)
**Priority:** Medium
**Status:** Listo
**Components:** None

---

## Description

## Qué

Faltas de ortografía en `recipes.ingredientes*principales` (y `ingredientes*que*puede*desagradar`): 18 términos guardados sin tilde/ñ en parte del catálogo, con tilde correcta en otra parte — mismo ingrediente real, dos grafías distintas según qué tanda de generación lo escribió.

## Alcance real (verificado por SQL antes de tocar nada)

| Sin tilde (mal) | Con tilde (correcto) |
| --- | --- |
| aji amarillo | ají amarillo |
| atun | atún |
| azafran | azafrán |
| brocoli | brócoli |
| calabacin | calabacín |
| champinones | champiñones |
| esparragos | espárragos |
| higado | hígado |
| jamon serrano | jamón serrano |
| judias verdes | judías verdes |
| limon | limón |
| maiz blanco | maíz blanco |
| pimenton dulce | pimentón dulce |
| pimenton picante | pimentón picante |
| platano | plátano |
| salmon | salmón |
| secreto iberico | secreto ibérico |
| sesamo | sésamo |

## Por qué no rompe nada más

La clasificación de pasillo y el precio (`aisle-pricing.ts`) matchean por `normalizeNombre()` (quita tildes/ñ antes de comparar) — los diccionarios internos (`INGREDIENT*AISLE`, `PRICE*OVERRIDE`, `BASE_QUANTITIES`) ya están en forma sin tilde a propósito, como claves de lookup normalizadas, no como texto visible al usuario. Corregir el dato crudo de `recipes` no afecta el matching, solo lo que se muestra.

## Fix

Migración de datos (no de schema) sobre las filas reales de `recipes`, reemplazando cada término mal escrito por su forma correcta dentro de los arrays JSONB — arregla lista de la compra, detalle de receta, y cualquier otro lugar que muestre `ingredientes*principales`/`ingredientes*que*puede*desagradar`, de una sola vez.

---

## Metadata

- **Created:** 8/14/2026
- **Updated:** 8/14/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
