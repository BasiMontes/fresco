# DEFECT: Consistencia de tamaño de iconos: 5 botones más siguen en 17.6px, no 22px

**Jira Key:** [FRESCO-87](https://basiliomontescastano.atlassian.net/browse/FRESCO-87)
**Priority:** Medium
**Status:** Listo
**Components:** None

---

## Description

## Qué se observa

Continuación de FRESCO-85/86: además de los 3 sitios ya corregidos ahí (favoritos/notificaciones de Inicio, corazón de `RecipeCard`, flechas del scroll horizontal), quedan otros 5 botones circulares (`Button variant="icon"`) en la app con el mismo icono a `size-4` (17.6px) en vez de los 22px reales del token `components.icon.size` de DESIGN.md:

- `components/layout/sidebar-account.tsx:102` — `LogOut` (botón de cerrar sesión del sidebar, FRESCO-82)
- `components/calendar/calendar-grid.tsx:414` — `GripVertical` (asa de arrastre del calendario)
- `components/calendar/delete-week-button.tsx:54` — `Trash2` (borrar semana)
- `app/(app)/notifications/page.tsx:20` — `ArrowLeft` (volver)
- `app/(app)/favorites/page.tsx:33` — `ArrowLeft` (volver)

## Por qué importa

Mismo motivo documentado en FRESCO-85: DESIGN.md define un único tamaño para todo el set de iconos ("single stroke weight and single color across the entire set") y hoy la app tiene 2 tamaños reales en uso (17.6px y 22px, tras el fix de FRESCO-85/86) según el componente. Sin este ticket, la inconsistencia simplemente se movió de 3 sitios a 5.

## Causa raíz (ya diagnosticada, no repetir la investigación)

`tailwind.config.ts` sobreescribe la escala `spacing` de Tailwind con la fórmula 4.4px×n de DESIGN.md pero nunca definió la key `5` (17.6/26.4/35.2 para 4/6/8, sin el 22 de la key 5) — cualquier `size-5` cae al default de Tailwind (20px) en vez del token real. FRESCO-85/86 corrigieron 3 sitios con `size-[22px]` explícito, sin tocar la escala global (blast radius no auditado sobre cualquier otro `-5` de la app).

## Alcance

1. Aplicar `size-[22px]` a los 5 sitios listados arriba, mismo patrón que FRESCO-85/86.
2. Opcional (decisión de equipo, no bloqueante): evaluar agregar la key `5: '22px'` a `tailwind.config.ts spacing` de una vez, auditando primero cualquier otro uso de `-5` (padding/margin/gap/width/height) en la app para no romper nada fuera de iconos — alternativa más sistémica a seguir parchando `size-[22px]` sitio por sitio cada vez que aparece uno nuevo.

## Cómo reproducir

1. Sidebar footer (cualquier pantalla con sesión) — botón de cerrar sesión.
2. `/calendar` — asa de arrastre de una comida, botón de borrar semana.
3. `/notifications` y `/favorites` — flecha de volver.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/6/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
