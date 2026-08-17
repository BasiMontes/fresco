# DEFECT: Navbar mobile ocupa demasiada altura vertical

**Jira Key:** [FRESCO-154](https://basiliomontescastano.atlassian.net/browse/FRESCO-154)
**Priority:** Medium
**Status:** WIP
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `components/layout/bottom-tab-bar.tsx` — la barra de navegación inferior en mobile (`<nav>` con `fixed inset-x-0 bottom-0`, visible `md:hidden`).
- Hallazgo directo del user: la navbar ocupa demasiada altura vertical en pantalla, hay que bajarla.

## Cambio propuesto

- Reducir la altura de la barra: revisar `py-2` de cada item, tamaño del icono (`size-[22px]`) y el espacio entre icono/label/dot-indicador para lograr un perfil más bajo, sin perder legibilidad ni el área táctil mínima (accesibilidad).

## Alcance

- Solo `bottom-tab-bar.tsx` (mobile). No toca `sidebar.tsx` (desktop) ni los 4 destinos de navegación.

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
