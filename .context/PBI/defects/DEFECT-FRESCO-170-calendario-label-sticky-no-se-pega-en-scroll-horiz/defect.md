# DEFECT: Calendario: label sticky no se pega en scroll horizontal mobile

**Jira Key:** [FRESCO-170](https://basiliomontescastano.atlassian.net/browse/FRESCO-170)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `components/calendar/calendar-grid.tsx` líneas ~272-289 — columna de labels `sticky left-0 z-10` dentro de un CSS Grid con `gridAutoFlow: 'column'`.
- Hallazgo del QA sweep (agente Calendario, MAJOR): verificado hoy manualmente en desktop (funcionaba, ver bitácora FRESCO-159), pero el agente lo probó con scroll real (mousewheel) en mobile (393px) y el label "DESAYUNO"/"COMIDA"/"CENA" se va completamente fuera de pantalla junto con las columnas de día en vez de quedar fijo — pierde todo contexto de fila mientras se navega en el viewport principal de la app.

## Cambio propuesto

- Re-verificar manualmente en mobile real antes de tocar CSS (posible discrepancia entre scroll programático vs. mousewheel real, o bug genuino de `position: sticky` + `gridAutoFlow: column`). Si se confirma, investigar el containing-block del sticky (puede necesitar que el contenedor `overflow-x-auto` sea el que realmente scrollea, no un ancestro distinto).

## Alcance

- Solo `calendar-grid.tsx`'s columna de labels (mismo código de FRESCO-159, esta sesión).

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Unassigned

---

_Synced from Jira by sync-jira-issues_
