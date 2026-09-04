# DEFECT: Ticket de compra: colores incorrectos (marrón en vez de verde corporativo, botón verde en vez de naranja corporativo)

**Jira Key:** [FRESCO-432](https://basiliomontescastano.atlassian.net/browse/FRESCO-432)
**Priority:** Low
**Status:** Listo
**Components:** None
**Severity:** menor
**Error Type:** visual

---

## Description

## Resumen

El componente `ReceiptTicket` (ticket de "Compra realizada" en `/shopping-list`) usa colores que no son los de marca:

- El cuerpo de la "máquina impresora" usa `bg-neutral-800` (marrón) en vez del verde corporativo.
- El botón "Listo" usa el verde primario (`default` Button) en vez del naranja corporativo (secondary/action).

## Impacto

Rompe la identidad visual del componente — no se lee como Fresco. Introducido al construir el componente sin pasar por una revisión de marca explícita (no hubo ticket dedicado para el build inicial de este componente, se implementó ad-hoc en la misma sesión que este defecto).

## Origen

`components/shopping-list/receipt-ticket.tsx` — build inicial del ticket de compra (spec: `docs/superpowers/specs/2026-09-04-receipt-ticket-design.md`). El `neutral-800` se eligió solo por contraste técnico contra el papel crema (`bg-surface`), sin pasar la paleta de marca.

## Criterios de aceptación

- La "máquina" usa el verde corporativo (token de marca, no un neutral genérico).
- El botón "Listo" usa el naranja corporativo.
- Se mantiene contraste real entre el botón y el fondo de la máquina (no repetir el ~1:1 de contraste ya corregido una vez en este mismo componente).
- Revisado visualmente en el navegador antes de cerrar.

## Ficheros

`components/shopping-list/receipt-ticket.tsx`

---

## 🧫 Evidence

Reportado en vivo por el usuario vía screenshot del componente (dark neutral-800 + botón verde primario), sesión 2026-09-04. Commit que introdujo la máquina oscura: 69cf72a (receipt-ticket.tsx build inicial).

---

## Metadata

- **Created:** 9/4/2026
- **Updated:** 9/4/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
