# DEFECT: Campo "Adultos" del onboarding acepta valores sin límite superior real (999)

**Jira Key:** [FRESCO-110](https://basiliomontescastano.atlassian.net/browse/FRESCO-110)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: `app/onboarding/page.tsx` (paso 3, `adultos_input`), `lib/validation/onboarding.ts` (`validateHousehold`)
- ***Pasos para reproducir***: en el paso 3 del onboarding, escribir "999" en Adultos.
- ***Esperado***: el atributo `max={10}` sugiere visualmente un tope de 10; se esperaría que la validación lo respete.
- ***Observado***: `validateHousehold()` sólo valida `adultos > 0` y `ninos >= 0`, sin tope superior. Con adultos=999 el botón "Generar mi menú" queda habilitado.

## Por qué importa

Hay una inconsistencia entre lo que el input sugiere visualmente (tope de 10) y la validación real, que no lo aplica. Puede permitir tamaños de hogar no realistas en el perfil del usuario.

## Alcance

Hacer que `validateHousehold()` valide contra el mismo tope de 10 que sugiere el atributo `max` del input (o remover el atributo `max` si no se pretende limitar).

## Cómo reproducir

1. En `/onboarding`, ir al paso 3 (tamaño de hogar).
2. Escribir "999" en el campo Adultos.
3. Verificar que el botón "Generar mi menú" queda habilitado.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
