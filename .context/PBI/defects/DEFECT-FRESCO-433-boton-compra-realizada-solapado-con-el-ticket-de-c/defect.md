# DEFECT: Botón "Compra realizada" solapado con el ticket de compra en desktop

**Jira Key:** [FRESCO-433](https://basiliomontescastano.atlassian.net/browse/FRESCO-433)
**Priority:** Medium
**Status:** Listo
**Components:** None
**Severity:** moderada
**Error Type:** visual

---

## Description

## Resumen

El botón flotante "Compra realizada" (`fixed`, centrado abajo) queda visualmente solapado por el modal del ticket de compra al abrirse, en desktop — se ve el botón verde asomando por debajo del ticket (ver evidencia).

## Impacto

Layout confuso mientras el modal está abierto en desktop. Necesita solución responsive: el fix en desktop (mover el botón) no debe romper el layout en mobile.

## Origen

`components/shopping-list/shopping-list-view.tsx` (botón `fixed inset-x-0 bottom-[...]`, centrado) + `components/shopping-list/receipt-ticket.tsx` (modal centrado, mismo eje vertical). Construido ad-hoc en la misma sesión, sin pasar por revisión de layout en distintos viewports antes de cerrar.

## Criterios de aceptación

- En desktop: el botón "Compra realizada" se reposiciona (p. ej. hacia la derecha) para no quedar detrás/debajo del modal del ticket mientras está abierto.
- En mobile: solución responsive equivalente — el botón no debe quedar inaccesible ni solapado bajo el ticket en pantallas pequeñas.
- Verificado en al menos un viewport de desktop y uno de mobile antes de cerrar.

## Ficheros

`components/shopping-list/shopping-list-view.tsx`, `components/shopping-list/receipt-ticket.tsx`

---

## 🧫 Evidence

Reportado en vivo por el usuario vía screenshot: botón "Compra realizada" (verde) asomando por debajo del modal del ticket de compra en desktop, sesión 2026-09-04.

---

## Metadata

- **Created:** 9/4/2026
- **Updated:** 9/4/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
