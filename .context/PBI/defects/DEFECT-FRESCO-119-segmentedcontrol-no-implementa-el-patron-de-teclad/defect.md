# DEFECT: SegmentedControl no implementa el patrón de teclado de radiogroup

**Jira Key:** [FRESCO-119](https://basiliomontescastano.atlassian.net/browse/FRESCO-119)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: `components/ui/segmented-control.tsx`, usado en `/recipes` como "Filtrar por tipo de comida" (`radiogroup` con 4 opciones: Todo/Desayuno/Comida/Cena).
- ***Pasos para reproducir***: en `/recipes`, tabular con teclado hasta llegar al grupo de tipo de comida.
- ***Esperado***: según el patrón ARIA APG para `radiogroup`, solo la opción seleccionada debería recibir foco por Tab; las flechas izquierda/derecha deberían mover la selección entre opciones.
- ***Observado***: cada botón (`role="radio"`) es un `<button>` nativo sin gestión de `tabIndex` ni manejador de teclas de flecha — Tab se detiene en las 4 opciones una por una, y no hay soporte de flechas. Funciona igual con Tab + Enter/Espacio (no bloquea el flujo), pero se desvía del contrato de teclado esperado para un `radiogroup`.

## Por qué importa

Usuarios de teclado/lector de pantalla acostumbrados al patrón ARIA APG de `radiogroup` (roving tabindex + flechas) pueden confundirse con el comportamiento actual. No bloquea el flujo (Tab + Enter/Espacio funciona), es un gap de conformidad con el patrón esperado.

## Alcance

Implementar roving tabindex (solo la opción seleccionada en el flujo de Tab) y manejo de flechas izquierda/derecha para mover la selección, según el patrón ARIA APG de `radiogroup`.

## Cómo reproducir

1. Ir a `/recipes`.
2. Tabular con teclado hasta llegar al grupo "Filtrar por tipo de comida" (4 opciones: Todo/Desayuno/Comida/Cena).
3. Observar que Tab se detiene en cada una de las 4 opciones y que las flechas izquierda/derecha no mueven la selección.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
