# DEFECT: Iconos lucide con grosor de trazo 3 en toda la app — regla CSS global contradice DESIGN.md (2px)

**Jira Key:** [FRESCO-298](https://basiliomontescastano.atlassian.net/browse/FRESCO-298)
**Priority:** Low
**Status:** Finalizada
**Components:** None

---

## Description

## Resumen

Todos los iconos de `lucide-react` de la aplicación se renderizan con un grosor de trazo de ***3****, no de ****2***. Se ve especialmente en las tarjetas de indicadores de `/menu` (recetas disponibles, gasto semanal, ahorro, tiempo recuperado), pero afecta a toda la interfaz: barra lateral, barra inferior, landing, etc.

## Pasos para reproducir

1. Entrar en `/menu` con cualquier usuario en cualquier entorno (dev, pre, pro).
2. Observar los iconos de las cuatro tarjetas de indicadores bajo el banner del calendario.
3. Comparar el grosor del trazo con el resto del sistema de diseño.

## Resultado actual

Los iconos tienen un trazo de 3px. Se leen más pesados y toscos de lo que marca el sistema de diseño. Ocurre en los tres entornos porque es CSS compilado en el repositorio, idéntico para todos.

## Resultado esperado

Los iconos del set de navegación y de interfaz se renderizan a ***2px****, como dicta `DESIGN.md` (línea 293: **"a minimal 2px-stroke line set... the shipped nav/UI icon set stays at 2px"*). El trazo de 3px queda reservado únicamente a los checks pequeños (≤16px), que ya lo fijan por prop en su propio componente.

## Causa raíz (preliminar)

`app/globals.css` tiene una regla global:

```css
svg.lucide {
  stroke-width: 3;
}
```

Esta regla fuerza grosor 3 en ***todos**** los iconos lucide. El `stroke-width` de CSS gana sobre el atributo `strokeWidth` del SVG, así que incluso los componentes que ya piden `strokeWidth={2}` (`components/layout/sidebar.tsx`, `components/layout/bottom-tab-bar.tsx`, `components/landing/**`) se pintan a 3. Las tarjetas de `/menu` (`components/menu/savings-estimate-cards.tsx`, `components/menu/available-recipes-card.tsx`) ni siquiera pasan la prop, heredan el 3 directamente.

El comentario de la propia regla atribuye el cambio a FRESCO-85/86/87, pero `DESIGN.md` fue corregido posteriormente para aclarar que esos tickets unificaron el ***tamaño*** del glifo, no el grosor, y que el set enviado se queda en 2px. El código quedó desincronizado del documento.

## Impacto

Cosmético, transversal a toda la app. Sin riesgo funcional. Afecta a la consistencia de marca y a la fidelidad con el sistema de diseño.

---

## Metadata

- **Created:** 8/27/2026
- **Updated:** 8/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** design-fidelity

---

_Synced from Jira by sync-jira-issues_
