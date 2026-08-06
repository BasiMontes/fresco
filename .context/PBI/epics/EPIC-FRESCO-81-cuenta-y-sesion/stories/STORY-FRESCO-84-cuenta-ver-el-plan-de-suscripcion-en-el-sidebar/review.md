# Code Review — FRESCO-84 (adjudicación)

Reviewer: agente adversarial independiente (fresh context). Adjudicación: orchestrator, contra diff real `519eb4a..849d4e7`.

| # | finding | severity | verdict | reason | action |
|---|---|---|---|---|---|
| 1 | `app/(app)/layout.tsx:32` — `getUserPlan()` duplica la query ya hecha en `/profile/page.tsx` y `/calendar/page.tsx` | MEDIUM | legitimate (alcance acotado) | Real, pero la arquitectura de fondo (memoizar `createClient()` para deduplicar entre layout y page) ya fue evaluada y descartada en FRESCO-82 por riesgo de fuga de cliente entre requests en Route Handlers — no se re-litiga acá. Se aplica el mismo tratamiento simétrico que ya tiene `getUserNombre` | fix: envolver `getUserPlan` en `React.cache()` (mismo patrón y misma limitación documentada que `getUserNombre`), sin tocar `/profile/page.tsx` ni `/calendar/page.tsx` |
| 2 | `sidebar-account.tsx:32` + `profile/page.tsx` — `PLAN_LABELS` y la lógica de variante (`free`→`neutral`, resto→`accent`) duplicados byte a byte en 2 archivos | MEDIUM | legitimate | 2 consumidores reales con lógica de negocio idéntica (no solo texto) — cambio futuro de criterio visual requeriría tocar 2 archivos en sincronía sin garantía de tipos | fix: extraer `PLAN_LABELS` + `getPlanTagVariant()` a módulo compartido, importar desde ambos |
| 3 | AC1-3 — texto implementado ("Plan Free"/"Plan Pro"/"Plan Family") diverge del Gherkin literal ("Free"/"Pro"/"Family") y del Business Rules Specification ("Free plan"/"Pro plan") | MEDIUM | ratified (no es defecto) | Doctrina LIVE-UI-FIRST (CLAUDE.md Regla 14): el texto ya está en vivo en `/profile` en producción; consistencia entre pantallas gana sobre la redacción informal del AC. Ninguna de las 3 fuentes (Gherkin/Business Rules/código) coincidía entre sí tampoco — no había una única "verdad" que romper | ratificado tal cual está — sin cambio de código. Documentado acá como divergencia ratificada |
| 4 | `console.error` en los `.catch()` de `layout.tsx` | NIT | false-positive (no-op) | Convención ya establecida en todo el repo, no introducida por esta historia | dismissed |

**Decisión:** APPROVED WITH FIXES (findings 1-2) → loop a Stage 2 vía `fix-issues.md`. Finding 3 ratificado sin cambio. Finding 4 descartado.
