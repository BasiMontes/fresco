# DEFECT: Accesibilidad: áreas táctiles móviles bajo 24×24px (FAQ + footer)

**Jira Key:** [FRESCO-267](https://basiliomontescastano.atlassian.net/browse/FRESCO-267)
**Priority:** Low
**Status:** Finalizada
**Components:** None

---

## Description

## Contexto

Auditoría externa (Dojo, Ely, 14 ago 2026), medida a 390px de ancho: el botón de cada pregunta del FAQ mide ~355×20px y los enlaces del footer ~45×14px. Ambos incumplen el mínimo de área táctil de ***WCAG 2.5.8 (Target Size, nivel AA)******:****** 24×24px***.

Verificado en código el 26 ago 2026:

- `components/landing/faq.tsx` — el `<button>` de cada pregunta no tiene padding vertical; el icono `size-5` (20px) es lo único que fija la altura real.
- `components/landing/site-footer.tsx` — los enlaces (`text-caption text-accent-300`) tampoco llevan padding.

Nota sobre un falso positivo de la propia auditoría: el botón de menú móvil (`components/landing/site-nav.tsx`) listado junto a estos dos ***ya cumple*** — usa `size="sm"` (`px-3 py-1`) sobre un icono de 20px, lo que da ~31px de alto. No requiere cambio.

## Solución propuesta

Añadir padding vertical a los dos elementos que fallan, hasta que el área táctil real alcance al menos 24×24px (ideal: 44×44px, nivel AAA), sin agrandar el texto ni el icono visible — el padding invisible amplía solo la zona de toque.

## Plan de acción

1. `components/landing/faq.tsx`: añadir `py-2` (o equivalente) al `<button>` de cada pregunta.
2. `components/landing/site-footer.tsx`: añadir padding vertical (`py-1.5` o similar) a cada enlace del pie.
3. Reverificar con `getComputedStyle` a 390px que ambos superan 24×24px.
4. No tocar el botón de menú de `site-nav.tsx` — ya cumple.

## Evidencia (fallback por límite de 255 caracteres en los campos de bug — ver comentario)

Los campos `Actual Result`, `Expected Result`, `Error Type`, `Severity` y `Test Environment` no están en la pantalla de creación de "Error" en este proyecto de Jira; el detalle va en un comentario tras crear el ticket, siguiendo el patrón ya usado en el repo (`.agents/jira-required.yaml` → `fallback: target: comment`).

---

## Related Issues

- relates to: [FRESCO-288](https://basiliomontescastano.atlassian.net/browse/FRESCO-288) - Accesibilidad: el fix de áreas táctiles no llegó al footer de auth ni al checkbox de `/signup`

---

## Metadata

- **Created:** 8/26/2026
- **Updated:** 8/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-dojo

---

_Synced from Jira by sync-jira-issues_
