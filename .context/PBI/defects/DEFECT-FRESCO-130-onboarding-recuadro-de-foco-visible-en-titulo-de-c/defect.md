# DEFECT: Onboarding: recuadro de foco visible en título de cada paso (foco programático dispara focus-visible)

**Jira Key:** [FRESCO-130](https://basiliomontescastano.atlassian.net/browse/FRESCO-130)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Descripción

En el onboarding, el título de cada paso (`h1`) recibe foco programático al montar el step (para accesibilidad — lectores de pantalla). Esto dispara el estilo `focus-visible:outline` y dibuja un recuadro visible alrededor del título, visible para todos los usuarios en cada paso, no solo navegación por teclado.

## Dónde

`app/onboarding/page.tsx:118` (`stepHeadingRef.current?.focus()`) + `app/onboarding/page.tsx:227,290,312` (clase `focus-visible:outline` en cada `h1`)

## Pasos para reproducir

1. Entrar en `/onboarding`
2. Observar el título de cualquier paso ("¿Qué dieta y restricciones sigue tu hogar?", etc.)

## Comportamiento esperado

El foco programático para accesibilidad no debe generar un contorno visual permanente. Opciones: quitar el outline en foco programático (ej. usar `focus:outline-none` + gestionar el indicador visual solo vía teclado real), o rediseñar el indicador para que sea sutil y transitorio.

## Comportamiento actual

Recuadro oscuro visible alrededor del título en cada paso del onboarding, permanece hasta que el usuario interactúa con otro elemento.

## Impacto

Confusión visual en flujo crítico de onboarding — parece un elemento roto o un error de estilos.

---

## Metadata

- **Created:** 8/9/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Unassigned

---

_Synced from Jira by sync-jira-issues_
