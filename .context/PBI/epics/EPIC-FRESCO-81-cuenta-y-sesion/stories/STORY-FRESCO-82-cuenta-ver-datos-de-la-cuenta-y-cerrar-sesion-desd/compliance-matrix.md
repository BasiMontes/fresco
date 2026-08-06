# Spec Compliance Matrix — FRESCO-82

| AC scenario (Gherkin) | covered_by | evidence | status |
|---|---|---|---|
| Ver los datos de mi cuenta en el pie de la barra lateral | manual:playwright | Stage 2 — nombre/email/avatar visibles en `/menu` y `/profile`, sin scroll, 1280×720 y 1280×1000 | covered |
| Cerrar sesión desde la barra lateral | manual:playwright | Stage 2 — click en `sidebar_logout_button` → cookies limpiadas (`cookie-list` = 0) → redirect real a `/login` | covered |
| El componente no aparece sin sesión activa | manual:playwright | Stage 2 — snapshot de accesibilidad en `/login` sin rastro del sidebar. Reforzado en fix-and-iterate (finding #2) — sesión limpia navegando directo a `/menu`: `sidebar_logout_button`/`sidebarAccount`/"Sin nombre" ausentes del DOM | covered |
| Nombre/correo largos truncan sin desbordar | manual:playwright | Stage 2 — valores largos inyectados vía `page.evaluate`, `truncate`+`min-w-0` confirmado, ancho del sidebar (`w-64`) estable | covered |

No hay test automatizado (unit/E2E) para esta historia — toda la evidencia es manual vía Playwright, consistente con el resto del proyecto (sin suite de tests para sidebar/auth). Ningún row `uncovered`.
