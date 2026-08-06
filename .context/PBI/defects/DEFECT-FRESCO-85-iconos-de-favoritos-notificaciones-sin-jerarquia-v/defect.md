# DEFECT: Iconos de favoritos/notificaciones sin jerarquía visual (tamaño inconsistente)

**Jira Key:** [FRESCO-85](https://basiliomontescastano.atlassian.net/browse/FRESCO-85)
**Priority:** Medium
**Status:** Control de calidad
**Components:** None

---

## Description

## Qué se observa

Los iconos de favoritos (corazón) y notificaciones (campana) en la cabecera de "Inicio" (`app/(app)/menu/page.tsx:123,126`) se ven pequeños en relación al botón circular que los contiene y a la jerarquía del resto de la pantalla (título `h2` grande justo al lado). El mismo icono de corazón se repite en `RecipeCard` (`components/recipe/recipe-card.tsx:106`) a un tamaño distinto y todavía más chico.

Inconsistencia concreta medida en código:

- `app/(app)/menu/page.tsx:123,126` — `Heart`/`Bell` a `size-5` (20px)
- `components/recipe/recipe-card.tsx:106` — `Heart` a `size-4` (16px)
- `components/menu/horizontal-scroll-row.tsx:53,70` — `ChevronLeft`/`ChevronRight` a `size-4` (16px)

Los tres viven dentro del mismo botón circular de 36×36 (`components.button-icon`, `Button variant="icon"`), pero DESIGN.md define un único tamaño de icono para todo el set (`components.icon.size: 22px`) — ningún caso actual lo usa. El resultado es doble: el icono se percibe chico dentro de su círculo, y varía de tamaño entre pantallas para el mismo símbolo (el corazón mide distinto en Inicio que en una tarjeta de receta).

## Por qué importa

Rompe la consistencia de un set de iconos que DESIGN.md describe como "single stroke weight and single color across the entire set — no per-icon color exceptions" (y, por extensión, tamaño). Un usuario que ve el mismo icono de favorito en dos tamaños distintos en la misma sesión lo lee como descuido, no como jerarquía deliberada.

## Alcance

1. Unificar los 3 usos (`menu/page.tsx`, `recipe-card.tsx`, `horizontal-scroll-row.tsx`) al token real de DESIGN.md: `size-[22px]` (o el step de la escala Tailwind del proyecto más cercano a 22px, revisar si existe `size-5.5`/similar antes de hardcodear un valor arbitrario).
2. Confirmar que el botón circular de 36px sigue teniendo aire suficiente alrededor del icono a 22px (36 - 22 = 14px de margen combinado, ~7px por lado — validar visualmente, no asumir que entra bien).
3. Auditar si hay más usos del set de iconos de `lucide-react` en botones `variant="icon"` con tamaños distintos a 22px fuera de estos 3 (búsqueda rápida, no exhaustiva todavía).

## Cómo reproducir

1. Abrir "Inicio" (`/menu`) — comparar visualmente el tamaño de los iconos de corazón/campana de la cabecera contra su círculo contenedor.
2. Abrir cualquier listado de recetas (ej. "Últimas recetas añadidas") — comparar el tamaño del icono de corazón de cada tarjeta contra el de la cabecera de Inicio.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/6/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
