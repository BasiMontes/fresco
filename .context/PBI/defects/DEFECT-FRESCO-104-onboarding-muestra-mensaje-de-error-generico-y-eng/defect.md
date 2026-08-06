# DEFECT: Onboarding muestra mensaje de error genérico y engañoso cuando ya existe un menú para la semana (409)

**Jira Key:** [FRESCO-104](https://basiliomontescastano.atlassian.net/browse/FRESCO-104)
**Priority:** Medium
**Status:** Listo
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: `app/onboarding/page.tsx` (`handleGenerate`, `generate*error*message`)
- El backend responde `409` correctamente cuando ya existe un plan para la semana ("Ya existe un plan para la semana...").
- `handleGenerate` sólo distingue el caso `422` — el `409` cae al mensaje genérico: **"No pudimos guardar tu perfil o generar tu menú. Intenta de nuevo."**
- Ese mensaje es engañoso (reintentar nunca va a funcionar) y no ofrece ninguna salida.
- La versión equivalente en `components/calendar/generate-week-button.tsx` ***sí**** maneja el `409` con un mensaje específico y correcto: **"Ya existe un menú para esta semana. Elimínalo antes de generar uno nuevo."* — lo que confirma que es un vacío/inconsistencia entre ambos flujos, no una limitación técnica.

## Por qué importa

El mensaje genérico invita a reintentar una acción que estructuralmente no puede funcionar (el 409 no se resuelve reintentando), y no le da a la usuaria ninguna salida hacia donde sí puede ver o gestionar su menú existente.

## Alcance

Manejar el caso `409` en `app/onboarding/page.tsx` (`handleGenerate`) igual que ya lo hace `components/calendar/generate-week-button.tsx`: mensaje específico + salida clara (ir a `/menu` o `/calendar`).

## Cómo reproducir

1. Generar un menú como invitada (o cuenta registrada).
2. Volver a `/onboarding` y completar el flujo de nuevo para la misma semana, sin borrar el menú anterior.
3. Enviar el formulario.
4. Observar el mensaje genérico "No pudimos guardar tu perfil o generar tu menú. Intenta de nuevo." en vez de un aviso específico de menú duplicado.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/6/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
