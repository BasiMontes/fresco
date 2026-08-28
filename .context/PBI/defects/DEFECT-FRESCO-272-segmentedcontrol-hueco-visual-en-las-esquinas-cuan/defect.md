# DEFECT: SegmentedControl: hueco visual en las esquinas cuando la opción seleccionada está en un extremo

**Jira Key:** [FRESCO-272](https://basiliomontescastano.atlassian.net/browse/FRESCO-272)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

Qué: en el filtro de tipo de comida (Filtros > Comida: Todo/Desayuno/Comida/Cena) y en cualquier otro uso de SegmentedControl, cuando la opción seleccionada es la primera o la última, queda un hueco en forma de media luna entre el borde redondeado del pill relleno y la esquina del contenedor exterior.

Causa raíz: components/ui/segmented-control.tsx usa rounded-md (16px, token DESIGN.md) tanto en el contenedor exterior como en los botones internos. El contenedor (con h-9 + p-1 de padding) tiene una altura real mayor que 32px, así que su radio de 16px se renderiza literal (no llega a ser cápsula completa). El botón interno, al ser más bajo (altura disponible ~27px tras el padding), hace que el navegador recorte el radio de 16px automáticamente hasta convertirlo en una cápsula perfecta (CSS clampea la suma de radios al alto de la caja). Resultado: el borde interior queda MÁS redondeado que el exterior, y en los extremos esa diferencia de curvatura dibuja el hueco.

Solución: dar al botón un radio explícito de 16px - 4.4px (padding p-1 real del proyecto, base 4.4px) = 11.6px, en vez de heredar rounded-md sin cálculo. Así el radio interior anida exactamente dentro del exterior sin hueco, manteniendo la intención de diseño documentada (rounded.md, no full).

---

## Metadata

- **Created:** 8/26/2026
- **Updated:** 8/26/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** ui-bug

---

_Synced from Jira by sync-jira-issues_
