# DEFECT: Landing: header ilegible (logo/link) sobre secciones oscuras al scrollear

**Jira Key:** [FRESCO-169](https://basiliomontescastano.atlassian.net/browse/FRESCO-169)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `components/landing/site-nav.tsx` — header `sticky top-0 z-20 bg-background/95 backdrop-blur`.
- Hallazgo del QA sweep (agente Auth+Landing, MAJOR): al scrollear, el logo "Fresco" y el link "Ya tengo cuenta" quedan casi invisibles (verde oscuro sobre fondo oscuro) al cruzar secciones de fondo oscuro de la landing (sección "¿Cuántas veces has acabado comiendo lo que sea?" y precios). Los demás links del nav sí mantienen contraste. Reproducible en mobile y desktop.

## Cambio propuesto

- Investigar por qué el logo/link pierden contraste específicamente sobre esas secciones (el header en sí usa `bg-background/95` que debería mantenerse claro siempre — a confirmar si hay algún estilo condicional o si es un problema de z-index/apilamiento con las secciones oscuras). Ajustar para que el logo y "Ya tengo cuenta" mantengan contraste WCAG AA en cualquier posición de scroll.

## Alcance

- Solo `components/landing/site-nav.tsx`. No toca el resto del nav (ya funciona bien).

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
