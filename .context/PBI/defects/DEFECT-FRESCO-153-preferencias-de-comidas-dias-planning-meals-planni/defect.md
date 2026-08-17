# DEFECT: Preferencias de comidas/días (planning_meals/planning_days) se guardan pero no afectan generación, calendario ni son editables en perfil

**Jira Key:** [FRESCO-153](https://basiliomontescastano.atlassian.net/browse/FRESCO-153)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: `app/onboarding/page.tsx` guarda `planning*meals`/`planning*days` en `user_profiles` al completar el onboarding (columnas añadidas en FRESCO-135/136, migraciones `20260809140000` y `20260809150000`).
- ***Verificado por grep en todo el repo***: ninguna otra parte del código lee estas dos columnas.
- Reportado en vivo: usuario `basi_montes+test@hotmail.com` eligió no planificar desayunos ni fines de semana en el onboarding — el menú generado y el calendario igual incluyen los 7 días y las 3 comidas, y no hay forma de corregirlo después (perfil no tiene esos campos).

## Por qué importa

Es una elección explícita del usuario en el paso 4 del onboarding que se guarda en BD pero no tiene ningún efecto real — ni en la generación, ni en la visualización, ni es editable. Desde la perspectiva del usuario, la opción simplemente no funciona.

## Alcance

1. `generate-meal-plan/index.ts`: filtrar los slots a generar según `planning*meals`/`planning*days` del perfil, en vez de generar siempre 7×3.
2. `app/(app)/profile/`: exponer `planning*meals`/`planning*days` como campos editables (mismo patrón que el resto de "actualizar preferencias").
3. Confirmar que `/calendar` y `/menu` reflejan correctamente el resultado una vez la generación respete estas columnas.

## Cómo reproducir

1. Completar onboarding desmarcando "Desayuno" y "Sáb"/"Dom" en el paso 4.
2. Generar el menú.
3. Revisar `/menu` y `/calendar`: aparecen desayunos y fin de semana igual.
4. Ir a `/profile` a intentar corregirlo: no existe ningún campo para planificación de comidas/días.

---

## Metadata

- **Created:** 8/9/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
