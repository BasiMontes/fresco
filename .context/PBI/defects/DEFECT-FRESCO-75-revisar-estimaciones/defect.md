# DEFECT: Revisar estimaciones

**Jira Key:** [FRESCO-75](https://basiliomontescastano.atlassian.net/browse/FRESCO-75)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Confirmado con el reporter: se refiere al widget de ahorro en /menu

`components/menu/savings-estimate-cards.tsx:13-17` — 3 cifras hardcodeadas:

- `~45€` gasto semanal estimado
- `~15€` ahorro estimado
- `~3h` tiempo recuperado

El propio código ya trae un comentario admitiendo que son **"illustrative placeholders"** sin dato de negocio real detrás, y la UI muestra un banner visible: **"Cifras de referencia general, pendientes de validar con datos reales de mercado."**

Ya estaba señalado como pendiente real de negocio en la bitácora de dev (2026-08-03, cierre de FRESCO-58/60).

## Se espera

Validar/reemplazar estas 3 cifras con datos reales de mercado, o decidir explícitamente mantenerlas como estimación general y ajustar el copy/banner en consecuencia.

## Nota

Esto es una decisión de negocio (qué cifras usar, de qué fuente), no solo de desarrollo — necesita input de producto/mercado antes de tocar código.

---

## Metadata

- **Created:** 8/4/2026
- **Updated:** 8/5/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
