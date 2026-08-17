# DEFECT: /perfil: backup descargable debe ser CSV, no JSON

**Jira Key:** [FRESCO-163](https://basiliomontescastano.atlassian.net/browse/FRESCO-163)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `app/api/profile/export/route.ts` — hoy devuelve un único JSON con 4 fuentes anidadas (`user*profile`, `meal*plans` con `meal*plan*recipes` anidado, `shopping*lists`, `recetas*propias`).
- Hallazgo directo del user: el backup descargable tiene que ser un CSV, no JSON.

## Cambio propuesto

- Generar un único archivo `.csv` (no ZIP — evita sumar una dependencia solo para esto) con una sección por tabla, separadas por línea en blanco y un header `# nombre*tabla`, cada sección con su propia fila de columnas (derivadas dinámicamente de las keys de cada fila, no hardcodeadas — evita que la lista de columnas quede desincronizada del schema real). `meal*plan*recipes` se aplana a su propia sección de nivel superior (con `meal*plan*id` como columna) en vez de quedar anidada dentro de `meal*plans`. Escapado CSV (RFC 4180: comillas dobles si el valor tiene coma/comilla/salto de línea) implementado a mano — no hay librería CSV en el proyecto y el volumen de datos no lo justifica.

## Alcance

- Solo `app/api/profile/export/route.ts`. No cambia qué datos se exportan (mismas 4 fuentes), solo el formato de salida y el nombre de archivo (`.csv` en vez de `.json`).

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
