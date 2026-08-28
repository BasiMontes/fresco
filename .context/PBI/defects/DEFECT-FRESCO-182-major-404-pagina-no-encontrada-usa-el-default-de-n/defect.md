# DEFECT: [MAJOR] 404: página no encontrada usa el default de Next.js, sin marca ni copy en español, sin salida

**Jira Key:** [FRESCO-182](https://basiliomontescastano.atlassian.net/browse/FRESCO-182)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

***Severidad******:****** MAJOR***

***Dónde***: no existe `app/not-found.tsx` en el proyecto (confirmado, no hay archivo `not-found.tsx` en ningún nivel)

## Pasos para reproducir

1. Navegar a cualquier ruta inexistente, ej. `/this-route-does-not-exist`

## Esperado

Página 404 propia con branding, copy en español, y un link claro de vuelta a la app.

## Observado

Se muestra el 404 default de Next.js en inglés ("404 | This page could not be found."), sin logo/marca de Fresco, sin copy en español (el resto de la app es 100% español), sin ningún link/nav para volver.

## Impacto

Cualquier URL mal escrita, bookmark viejo, o link roto deja al usuario fuera del producto sin salida.

---

## Metadata

- **Created:** 8/11/2026
- **Updated:** 8/17/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
