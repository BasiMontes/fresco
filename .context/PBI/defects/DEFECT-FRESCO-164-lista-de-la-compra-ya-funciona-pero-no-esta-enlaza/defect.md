# DEFECT: Lista de la compra ya funciona pero no está enlazada en la navegación

**Jira Key:** [FRESCO-164](https://basiliomontescastano.atlassian.net/browse/FRESCO-164)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `components/layout/sidebar.tsx` (`NAV*ITEMS`, líneas 20-25) y `components/layout/bottom-tab-bar.tsx` (`NAV*ITEMS`, líneas 16-21).
- Hallazgo del user: "me falta la pantalla de la lista de la compra".
- Investigado en profundidad antes de tocar código: la funcionalidad ***ya está completa y funcionando en producción**** — `app/(app)/shopping-list/page.tsx` (STORY-FRESCO-13), Edge Function real `generate-shopping-list` (activa, versión 14 en Supabase), tabla `shopping*lists` con datos reales (agrupación por pasillo, `coste*estimado_min`/`max`). `ShoppingListGenerator` y `ShoppingListView` son componentes completos, con manejo de errores (422/409) y toggle optimista de items comprados. El gap real: ****ningún nav item la enlaza*** — ni `sidebar.tsx` ni `bottom-tab-bar.tsx` tienen una entrada para `/shopping-list`, así que la pantalla es inalcanzable desde la UI aunque funcione perfecto.

## Cambio propuesto

- Agregar un 5to nav item "Lista" (o "Compra") apuntando a `/shopping-list`, en `sidebar.tsx` y `bottom-tab-bar.tsx`, mismo patrón que los 4 existentes. Icono `ShoppingCart` (lucide-react, ya usado en `shopping-list-generator.tsx` — mismo icono en todo el flujo).

## Alcance

- Solo los 2 archivos de navegación. No toca `app/(app)/shopping-list/page.tsx` ni los componentes `ShoppingListGenerator`/`ShoppingListView` — ya funcionan, no se reescribe backend ni UI del contenido en sí. No agrega comparador de precios por supermercado ni integración con despensa (features de una versión antigua/distinta de la app, con arquitectura de precios diferente — `coste*estimado*min`/`max` ya es el diseño real de este backend).

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
