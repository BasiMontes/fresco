# DEFECT: Dropdown custom (Sexo/Objetivo/Nivel) no se cierra al elegir opción en WebKit/Safari

**Jira Key:** [FRESCO-151](https://basiliomontescastano.atlassian.net/browse/FRESCO-151)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: `components/ui/dropdown.tsx` — componente `Dropdown` custom (reemplaza el `<select>` nativo, FRESCO-132), usado en onboarding para Sexo, Objetivo y Nivel de experiencia.
- Al elegir una opción, `onChange` se dispara correctamente (el valor queda seleccionado y el botón trigger lo refleja), pero `setOpen(false)` no colapsa la lista — el listbox se queda abierto y superpuesto sobre el resto del formulario.
- ***Verificado cruzando motores de navegador***: en Chromium (desktop) el dropdown cierra bien tras seleccionar. En WebKit (motor de Safari/iOS) — reproducido con `playwright --browser=webkit --device="iPhone 15"` — el valor se selecciona pero el listbox NO se cierra. Coincide exactamente con el reporte del user en iPhone real (captura adjunta).

## Por qué importa

En iOS (motor WebKit, el único permitido en iPhone) el formulario de onboarding queda con el listbox tapando el resto de campos tras cada selección — hay que tocar fuera manualmente para poder seguir. Afecta a los 3 dropdowns del paso 1 (Sexo, Objetivo, Nivel de experiencia).

## Alcance

Revisar el flujo de eventos de `selectOption` / `handleClickOutside` en `components/ui/dropdown.tsx` para que `setOpen(false)` se aplique de forma fiable en WebKit — probable interacción entre el listener de `mousedown` (outside-click) y el re-render disparado por `onChange` antes de que se aplique el `setOpen(false)`.

## Cómo reproducir

1. Abrir `/onboarding` en Safari (iOS) o en `playwright --browser=webkit --device="iPhone 15"`.
2. Tocar el dropdown "Sexo".
3. Elegir cualquier opción (ej. "Otro").
4. Observar que el valor queda seleccionado pero el listbox de opciones sigue visible/abierto.

---

## Metadata

- **Created:** 8/9/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
