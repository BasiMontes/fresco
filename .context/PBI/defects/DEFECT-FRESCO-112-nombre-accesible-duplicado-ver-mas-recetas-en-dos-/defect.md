# DEFECT: Nombre accesible duplicado "Ver más recetas" en dos controles distintos de Inicio

**Jira Key:** [FRESCO-112](https://basiliomontescastano.atlassian.net/browse/FRESCO-112)
**Priority:** Medium
**Status:** WIP
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: `components/menu/horizontal-scroll-row.tsx` (flecha derecha, `aria-label="Ver más recetas"`) vs. el botón de "cargar más" al final de la sección "Últimas recetas añadidas"
- ***Pasos para reproducir***: inspeccionar los controles de la sección "Últimas recetas añadidas" en `/menu`.
- ***Esperado***: nombres accesibles distintos para acciones distintas (uno hace scroll del carrusel, el otro carga más recetas).
- ***Observado***: ambos exponen el mismo nombre accesible "Ver más recetas" — ambiguo para usuarios de lector de pantalla o control por voz.

## Por qué importa

Usuarios de lector de pantalla o control por voz no pueden distinguir ambos controles por su nombre accesible, aunque hacen cosas distintas.

## Alcance

Diferenciar los `aria-label` de ambos controles (ej. "Desplazar recetas" para la flecha del carrusel vs. "Cargar más recetas" para el botón de carga).

## Cómo reproducir

1. Ir a `/menu`.
2. Inspeccionar los controles de la sección "Últimas recetas añadidas" (flecha derecha del carrusel y botón de cargar más al final).

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/7/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
