# Code Review — FRESCO-88 (adjudicación)

Reviewer: orchestrator, inline (subagente adversarial se cortó por límite de sesión a mitad del review — hecho a mano contra el diff real `57a274d..0fbea57`).

## Cumplimiento de AC

| AC scenario | Status | Notas |
|---|---|---|
| Abrir detalle desde el menú de hoy en Inicio | ✅ Cumplido | `<Link>` real, validado en vivo (Stage 2) |
| Abrir detalle desde "Últimas recetas añadidas" | ✅ Cumplido | `<Link>` real, validado en vivo |
| Abrir detalle desde una tarjeta del Calendario | ⚠️ Cumplido solo con mouse/touch | `onClick` en `<div>` plano, sin teclado — ver hallazgo #1 |
| Acciones del Calendario no navegan por accidente | ✅ Cumplido | `stopPropagation` en drag-handle + 2 botones de marcar, validado en vivo con drag real |

## Hallazgos

| # | finding | severity | verdict | reason | action |
|---|---|---|---|---|---|
| 1 | `components/calendar/calendar-grid.tsx` — el `onClick` de navegación vive en un `<div>` sin `tabIndex`, `role` ni `onKeyDown`. Las otras 2 superficies (Inicio) usan `<Link>` real, nativamente accesible por teclado (Tab + Enter); esta no | MAJOR | legitimate | Confirmado leyendo el diff: no hay ningún atributo de accesibilidad agregado junto al `onClick`. Un usuario de teclado no puede llegar al detalle de una receta desde el Calendario, aunque sí desde Inicio — inconsistencia real entre las 3 superficies que esta misma historia unifica | fix: agregar `role="link"`, `tabIndex={0}` (solo cuando `recipe && !disabled`) y `onKeyDown` (Enter) al div raíz de `SlotCell` |
| 2 | `<Link href={\`/recipes/${id}\`}>` se repite igual, byte a byte, en 4 sitios ahora (`recipe-library.tsx` ×2, `favorites/page.tsx`, y los 2 nuevos de esta historia) | NIT | legitimate, no bloqueante | DRY real pero menor — extraer un wrapper compartido es una mejora futura razonable, no una corrección urgente; los 4 sitios ya eran independientes antes de esta historia, no es una regresión que esta historia introduce | no se aplica ahora — anotado para una futura limpieza, no amerita ticket propio |

**Decisión:** CHANGES REQUESTED (hallazgo #1) → fix inline (subagente de review no disponible por límite de sesión, corregido directo por el orchestrator). Hallazgo #2 aceptado sin acción.
