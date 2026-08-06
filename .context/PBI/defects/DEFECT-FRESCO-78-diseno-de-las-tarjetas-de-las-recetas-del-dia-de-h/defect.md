# DEFECT: Diseño de las tarjetas de las recetas del día de hoy

**Jira Key:** [FRESCO-78](https://basiliomontescastano.atlassian.net/browse/FRESCO-78)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

No existe una variante de tarjeta dedicada para "recetas de hoy" — la sección reutiliza el `RecipeCard` genérico, el mismo componente que usan la biblioteca de recetas y "Últimas recetas añadidas". El único rótulo visible por tarjeta es la franja horaria (desayuno/comida/cena) en texto pequeño (`text-h6 uppercase text-tertiary`); el encabezado de la sección está oculto para lectores de pantalla (`sr-only`), sin equivalente visible.

- `app/(app)/menu/page.tsx:163-181`
- `components/recipe/recipe-card.tsx:55-107`

## Bloqueo — falta definición visual

El alcance no es determinable solo leyendo el código: falta decidir qué tratamiento distinto se busca (tamaño mayor, imagen más grande, variante "destacada" de card, etc.).

Por Regla Crítica #14 (UI Fidelity Contract) — este story/bug tiene componente de UI y no hay entrada en `.context/design/master-design-plan.md` §8 para esta pantalla. Antes de implementar: (a) generar mockup vía `/design-system` (fase de mapeo de pantallas), o (b) ratificar un build spec-only en §5 con aprobación explícita del user.

---

## Metadata

- **Created:** 8/4/2026
- **Updated:** 8/6/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
