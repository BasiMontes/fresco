# DEFECT: Icono de flecha del scroll horizontal se ve pálido, no verde corporativo sólido

**Jira Key:** [FRESCO-86](https://basiliomontescastano.atlassian.net/browse/FRESCO-86)
**Priority:** Medium
**Status:** Listo
**Components:** None

---

## Description

## Qué se observa

El icono de flecha del scroll horizontal (`components/menu/horizontal-scroll-row.tsx:53,70`, `ChevronLeft`/`ChevronRight`) se percibe pálido/lavado en vez de leerse como verde corporativo sólido, según captura del reporter sobre una tarjeta de receta.

## Lo que dice el código hoy (para no asumir un valor equivocado)

El botón usa `variant="icon"` de `Button` (`components/ui/button.tsx:30`), que ya aplica `text-primary` — es decir, el color declarado SÍ es `{colors.primary}` = `#0F4E0E` ("verde corporativo"), el mismo token que usa el resto de iconos de la app. No hay ningún override de color en `horizontal-scroll-row.tsx`.

Candidatos reales a la causa (a confirmar en implementación, no asumir cuál es antes de investigar en vivo):

1. El icono mide `size-4` (16px) con el stroke por defecto de `lucide-react` (2px) dentro de un botón de 36px con `shadow-md` — a ese tamaño el trazo fino puede leerse "pálido" aunque el hex sea el correcto (relacionado con FRESCO — ver ticket hermano de tamaño de iconos).
2. Verificar en el navegador real (DevTools) el valor computado de `color` sobre el `<svg>` — descartar que algún estilo heredado (ej. opacity de un padre, o el `disabled:opacity-50` del botón aplicándose fuera de un estado disabled) esté diluyendo el verde.

## Por qué importa

El icono de navegación del carrusel de recetas es una de las pocas interacciones táctiles fuera de las tarjetas — si no se lee como "botón sólido y verde", pierde affordance de que es interactivo.

## Alcance

1. Confirmar en DevTools el color computado real del `ChevronLeft`/`ChevronRight` renderizado (no solo el código fuente) antes de tocar nada.
2. Si el hex ya es correcto y el problema es de peso visual (stroke/tamaño), resolver en conjunto con el ticket hermano de tamaño de iconos (mismo componente, `size-4` → tamaño del token de 22px) en vez de aplicar dos fixes independientes al mismo elemento.
3. Si aparece un override de color no visible en una lectura estática del código, corregirlo puntualmente ahí.

## Cómo reproducir

1. Abrir "Inicio" (`/menu`), sección "Últimas recetas añadidas" (o cualquier fila con scroll horizontal con más recetas de las que entran en pantalla).
2. Observar la flecha de "ver más recetas" a la derecha de la fila.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/6/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
