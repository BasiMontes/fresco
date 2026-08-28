# DEFECT: Diseño: detalles UI menores a 390 px (`/qa` botón Copiar, `<title>` genérico, error a 4,29:1)

**Jira Key:** [FRESCO-293](https://basiliomontescastano.atlassian.net/browse/FRESCO-293)
**Priority:** Low
**Status:** Listo
**Components:** None

---

## Description

## Contexto

Re-auditoría 27 ago 2026, hallazgo 18 + notas (BAJO), eje Diseño. Medido sobre producción.

## Hallazgo

1. `/qa`***, botones "Copiar"***: `<button>` opaco (84 × 33 px, `background: #f1e3c6`), `position: absolute` pegado a la derecha, solapa la primera línea del snippet. Solape medido: 14–452 px según la longitud del contenido. Recuperable por scroll, pero oculta contenido en reposo.
2. `<title>`*** genérico*** en `/onboarding` y `/update-password`: ambas sirven "Fresco — Menús semanales que aprenden…" en vez de un título específico. Las otras 5 páginas públicas sí tienen título propio. Choca con el espíritu de WCAG 2.4.2.
3. `/update-password`***, mensaje de error**** "Este enlace ya no es válido…": `#b8422e` sobre `#f1e3c6`, 13 px → ****4,29******:******1*** (falla 4,5 por poco).

## Plan de acción

1. Mover el botón "Copiar" fuera del área de la primera línea (encima del bloque, o dentro de un header del snippet), o hacerlo semi-transparente hasta hover.
2. `generateMetadata` con título propio en `/onboarding` y `/update-password`.
3. Oscurecer el rojo de error a ≥4,5:1.

## Retorno esperado

Detalles pequeños en la página que lee un evaluador externo desde el móvil.

---

## Metadata

- **Created:** 8/27/2026
- **Updated:** 8/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-2

---

_Synced from Jira by sync-jira-issues_
