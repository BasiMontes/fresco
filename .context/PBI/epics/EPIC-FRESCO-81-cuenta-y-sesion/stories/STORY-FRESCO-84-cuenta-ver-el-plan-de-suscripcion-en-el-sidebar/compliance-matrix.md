# Spec Compliance Matrix — FRESCO-84

| AC scenario (Gherkin) | covered_by | evidence | status |
|---|---|---|---|
| Ver mi plan Free en el pie de la barra lateral | manual:playwright | Stage 2 — user de test con `plan='free'` real en DB, etiqueta "Plan Free" (`variant="neutral"`) visible | covered |
| Ver mi plan Pro en el pie de la barra lateral | manual:playwright | Stage 2 — `plan` cambiado a `'pro'` vía Supabase MCP, recarga, etiqueta "Plan Pro" (`variant="accent"`) confirmada, valor revertido después | covered |
| Ver mi plan Family en el pie de la barra lateral | manual:playwright | Stage 2 — `plan` cambiado a `'family'` vía Supabase MCP, recarga, etiqueta "Plan Family" (`variant="accent"`) confirmada, valor revertido después | covered |
| La etiqueta no aparece sin sesión activa | manual:playwright | Stage 2 — cookies limpiadas, `/menu` sin sesión: todo el bloque `SidebarAccount` (incluida la etiqueta) ausente, mismo guard de FRESCO-82 | covered |

Texto de la etiqueta ("Plan Free"/"Plan Pro"/"Plan Family") diverge del texto literal del Gherkin ("Free"/"Pro"/"Family") — divergencia ratificada en Stage 3 (`review.md` #3, doctrina LIVE-UI-FIRST, consistencia con `/profile` ya en producción). Ningún row `uncovered`.
