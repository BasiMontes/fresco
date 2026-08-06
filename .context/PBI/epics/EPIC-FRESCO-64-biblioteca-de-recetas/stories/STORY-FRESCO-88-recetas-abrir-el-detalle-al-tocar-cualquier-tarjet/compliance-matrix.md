# Spec Compliance Matrix — FRESCO-88

| AC scenario (Gherkin) | covered_by | evidence | status |
|---|---|---|---|
| Abrir detalle desde el menú de hoy en Inicio | manual:playwright | Stage 2 — click en tarjeta navega a `/recipes/[id]` correcto, desktop y mobile | covered |
| Abrir detalle desde "Últimas recetas añadidas" | manual:playwright | Stage 2 — click en tarjeta navega a `/recipes/[id]` correcto | covered |
| Abrir detalle desde una tarjeta del Calendario | manual:playwright | Stage 2 (click/tap) + Stage 3 fix-and-iterate (teclado: `Enter` con foco en la celda navega, confirmado con `page.press('Enter')`) | covered |
| Las acciones del Calendario no navegan por accidente | manual:playwright | Stage 2 — drag real simulado (mousedown/mousemove/mouseup) hizo el swap sin navegar; marcar cocinada/descartada ejecutó sin navegar. Stage 3 — `Enter` con foco en el drag-handle NO navega (guard `target === currentTarget`) | covered |

Ningún row `uncovered`.
