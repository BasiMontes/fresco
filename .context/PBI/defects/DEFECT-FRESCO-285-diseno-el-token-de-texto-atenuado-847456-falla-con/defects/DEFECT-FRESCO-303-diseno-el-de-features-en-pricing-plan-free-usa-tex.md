# DEFECT: Diseño: el ✓ de features en pricing (plan Free) usa text-neutral-600 (#847456) — falla contraste AA

**Jira Key:** [FRESCO-303](https://basiliomontescastano.atlassian.net/browse/FRESCO-303)
**Related Story:** [FRESCO-285](https://basiliomontescastano.atlassian.net/browse/FRESCO-285) - Diseño: el token de texto atenuado (`#847456`) falla contraste AA en todo el sitio
**Priority:** Low
**Status:** Finalizada
**Components:** None

---

## Description

## Contexto

Detectado durante FRESCO-285 (fix de contraste del token `#a39372`). No formaba parte de la re-auditoría original — hallazgo lateral.

## Hallazgo

`components/landing/pricing.tsx`, componente `PlanFeature` (variante NO destacada, plan Free):

```
bg-neutral-200 text-neutral-600
```

El glifo `✓` renderiza con `--color-neutral-600` (`#847456`) sobre `--color-neutral-200` (`#f0e8d8`) → ***~******3,6******:******1***. Falla WCAG AA (4,5:1 texto normal; incluso 3:1 de non-text contrast queda al límite).

La variante destacada (plan Pro, `highlighted`) usa `bg-accent-100 text-primary` y no falla.

Token distinto al de FRESCO-285: aquí es `neutral-600` (`#847456`), no la variante `#a39372`. FRESCO-299 dejó `neutral-600` sin tocar a propósito ("The neutral-600 ramp step stays #847456").

## Severidad

Baja. El `✓` es un adorno que refuerza la etiqueta de feature (el texto ya dice qué incluye el plan); no hay contraparte "✗ excluido". Aun así es contraste fallido visible.

## Solución propuesta

Cambiar la clase de la variante no destacada de `text-neutral-600` a `text-tertiary` (`#6f5f43`, ~4,6:1 sobre `#f0e8d8`) — mismo patrón que FRESCO-285. Una línea en `components/landing/pricing.tsx`.

## QA fields (fallback — la pantalla de Defect no expone los custom fields)

- ***Severity******:*** Baja / Low
- ***Error Type******:*** Visual / UI — accesibilidad
- ***Root Cause******:*** token `neutral-600` heredado de DESIGN.md sin verificación de contraste sobre `neutral-200`

---

## Related Issues

- relates to: [FRESCO-285](https://basiliomontescastano.atlassian.net/browse/FRESCO-285) - Diseño: el token de texto atenuado (`#847456`) falla contraste AA en todo el sitio

---

## Metadata

- **Created:** 8/28/2026
- **Updated:** 8/28/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-2

---

_Synced from Jira by sync-jira-issues_
