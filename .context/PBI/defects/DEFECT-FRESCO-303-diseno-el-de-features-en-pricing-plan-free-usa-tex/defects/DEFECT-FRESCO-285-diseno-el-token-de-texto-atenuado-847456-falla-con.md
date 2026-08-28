# DEFECT: Diseño: el token de texto atenuado (`#847456`) falla contraste AA en todo el sitio

**Jira Key:** [FRESCO-285](https://basiliomontescastano.atlassian.net/browse/FRESCO-285)
**Related Story:** [FRESCO-303](https://basiliomontescastano.atlassian.net/browse/FRESCO-303) - Diseño: el ✓ de features en pricing (plan Free) usa text-neutral-600 (#847456) — falla contraste AA
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Contexto

Re-auditoría 27 ago 2026, hallazgo 07 (MEDIO), eje Diseño. Medido sobre producción.

## Hallazgo

`color: #847456`:

- sobre superficie secundaria `#f1e3c6` → ***3,59******:******1*** (falla claro)
- sobre fondo de página `#faf3e3` → ***4,12******:******1*** (falla 4,5)

Variante más clara `#a39372` → ***2,47–2,72******:******1*** (fallo grave).

Aparece en: subtítulos de tarjeta de `/login`, `/signup`, `/forgot-password`, `/onboarding` (13 px); intro y celdas de tabla de `/qa`; copy del hero de la landing ("Cada semana la misma historia", "Fresco te da el menú…"); captions de stats.

## Solución propuesta

Oscurecer el token a ~`#6b5f47` (≥4,5:1 sobre ambas superficies). Retirar o corregir la variante `#a39372`.

## Retorno esperado

Un o dos valores de token. Cierra el fallo de contraste más extendido del sitio.

---

## Related Issues

- relates to: [FRESCO-299](https://basiliomontescastano.atlassian.net/browse/FRESCO-299) - Diseño: 3 hallazgos de contraste WCAG AA pendientes tras FRESCO-283 (text-warning ×2 + token text-tertiary #847456)
- relates to: [FRESCO-303](https://basiliomontescastano.atlassian.net/browse/FRESCO-303) - Diseño: el ✓ de features en pricing (plan Free) usa text-neutral-600 (#847456) — falla contraste AA

---

## Metadata

- **Created:** 8/27/2026
- **Updated:** 8/28/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-2

---

_Synced from Jira by sync-jira-issues_
