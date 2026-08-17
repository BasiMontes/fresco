# DEFECT: Botón "Guardar receta" no se deshabilita con nombre vacío

**Jira Key:** [FRESCO-118](https://basiliomontescastano.atlassian.net/browse/FRESCO-118)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: `components/recipes/create-recipe-form.tsx`, `data-testid="guardar*receta*button"`.
- ***Pasos para reproducir***: abrir "Crear propia"; escribir solo espacios en "Nombre" (o dejarlo vacío); inspeccionar el botón "Guardar receta".
- ***Esperado***: según el propio comentario del componente ("mirrors `components/profile/nombre-form.tsx` exactly ... disabled submit while invalid or saving"), el botón debería estar deshabilitado mientras el nombre sea inválido — tal como efectivamente hace `nombre-form.tsx` (`disabled={!isValid || isSaving}`).
- ***Observado***: el botón solo tiene `disabled={isSaving}` — se mantiene clickeable (`disabled: false` confirmado vía `eval`) aunque el nombre esté vacío o sea solo espacios. Al hacer click no pasa nada grave (el `handleSubmit` corta con `if (!isValid) return`, y se muestra el mensaje de error inline), pero el comportamiento no coincide con el patrón que el propio código dice replicar.

## Por qué importa

El usuario no recibe la señal visual de "no puedo enviar todavía" (botón deshabilitado) que sí da el patrón equivalente (`nombre-form.tsx`); no rompe el flujo (el submit corta igual por validación), pero contradice el propio comentario del componente.

## Alcance

Agregar el mismo guard `disabled={!isValid || isSaving}` que ya usa `nombre-form.tsx`, tal como el propio comentario del componente dice replicar.

## Cómo reproducir

1. Abrir "Crear propia" en `/recipes`.
2. Escribir solo espacios en "Nombre" (o dejarlo vacío).
3. Inspeccionar el botón "Guardar receta" — permanece habilitado (`disabled: false`).

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
