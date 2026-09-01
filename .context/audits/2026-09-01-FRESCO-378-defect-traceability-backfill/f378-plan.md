## Spec Implementation Plan (Dev) — FRESCO-378 (A4-H17)

**Ticket 100% Jira, cero código.** Backfill de trazabilidad sobre defectos abiertos/recientes.

**Scope (elegido por el owner):** Error no-Finalizada + creados ≥ 2026-08-19 → **36 defectos** (FRESCO-401 ya completo esta sesión → 35 a tratar). Lista congelada en `scratchpad/f378-map.tsv`.

**Evidence (owner: opciones 1 y 2 combinadas):** los ~7 abiertos (269, 265, 264, 250, 183, 124 + control-de-calidad) → intento de repro contra el código actual + evidencia real donde sea posible; los cerrados → comentario de backfill honesto ("sin artefacto original, pre-FRESCO-282; trazabilidad reconstruida").

### Tareas

**T1 — Backfill de los 35 defectos** (script `scripts/f378-backfill.ts`, dry-run primero)
Por cada defecto: (a) `Relates` link a su epic de origen (o dejar el `parent` si ya existe — 11 lo tienen); (b) `Severity 🚩` (`customfield_10194`, REST PUT) según impacto; (c) comentario Evidence.
Mapa epic de origen por dominio: auth/sesión → FRESCO-81 · onboarding → FRESCO-4 · calendario/planificación → FRESCO-10 · recuperar contraseña → FRESCO-50 · registro progresivo/confirmación email → FRESCO-18 · /qa → FRESCO-25 · legal/landing → FRESCO-49 · centro de avisos → FRESCO-223 · biblioteca de recetas → FRESCO-64 · defectos de diseño/componente/contraste/a11y de la re-auditoría → FRESCO-278 · headers/a11y de auditoría-3 → FRESCO-309.
Severidad: mayoría `menor`/`trivial` (UI/diseño/a11y); `moderada` para gaps de flujo (297, 250, 263, 265, 124); `mayor` para 264 (link de confirmación siempre a prod), 312 (headers de seguridad).

**T2 — FRESCO-328**: reclasificar Finalizada → `Rechazos` + comentario de rationale ("no es un done: es un deferral a plan Pro; la DB de prod sigue compartida — A4-H17 / §08 del informe").

**T3 — FRESCO-320**: comentario "gate añadido, deuda diferida — las AC de las historias abiertas seguían sin ser testeables (Gherkin con valores observables) al cierre. Backlog real, no done. A4-H17."

**T4 — probar el gate de FRESCO-313**: la creación de FRESCO-401 esta sesión ya lo demostró (acli rechazó el `create` con `Severity 🚩 es obligatorio, EVIDENCE es obligatorio` hasta añadir ambos). Se documenta como evidencia + comentario en FRESCO-313 confirmando que el gate está vivo.

### Verificación

- `scripts/f378-backfill.ts --dry-run` → revisar el mapa antes de escribir.
- Tras el run: re-query de los 36 → cada uno con severity ≠ null + ≥1 link (o parent).
- 328 en `Rechazos`, 320 con comentario, 313 con comentario.

### Workload Forecast

Estimado: ~120 adiciones (script + mapa TSV) = ~120 líneas. Cero código de producto.
400-line budget risk: Low
Chain strategy: single-pr (script + docs; el efecto real es en Jira)
Decision needed before apply: No

### Story Points: 5
