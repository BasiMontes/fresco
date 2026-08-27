# DEFECT: Diseño: el CTA primario ámbar falla contraste WCAG AA (2,40:1)

**Jira Key:** [FRESCO-283](https://basiliomontescastano.atlassian.net/browse/FRESCO-283)
**Related Story:** [FRESCO-299](https://basiliomontescastano.atlassian.net/browse/FRESCO-299) - Diseño: 3 hallazgos de contraste WCAG AA pendientes tras FRESCO-283 (text-warning ×2 + token text-tertiary #847456)
**Priority:** High
**Status:** Merged
**Components:** None

---

## Description

## Contexto

Re-auditoría 27 ago 2026, hallazgo 05 (ALTO), eje Diseño. Medido con Playwright + `getComputedStyle` sobre `fresco-pro.vercel.app`. El baseline no midió contraste.

## Hallazgo

`background: #df8c26` + `color: #faf3e3` → ***ratio 2,40******:******1***. Texto normal necesita 4,5:1. Falla por amplio margen.

Afecta:

| Página | Elemento |
| --- | --- |
| `/` | CTA de precios "Empezar 7 días gratis →" (plan PRO — el botón de conversión de mayor intención de la landing) |
| `/` | Badge "Popular" de la tarjeta PRO |
| `/` | Acento "súper." del `<h1>` + eyebrow "MENÚ SEMANAL CON IA" (2,40:1; texto grande necesita 3,0) |
| `/onboarding` | Botón primario "Crear cuenta" |
| `/qa` | Botón "Ver credenciales reales" |

La ***variante verde**** del primario (`#0f4e0e` + `#faf3e3`) pasa a ****8,97******:******1***. El ámbar es un segundo estilo primario inconsistente, usado para CTAs de trial/upgrade, y es el que falla.

## Solución propuesta

Subir el ámbar a ~`#9a5b12` (≈4,7:1), o texto oscuro sobre el ámbar actual (`#201e1d` da 6,3:1). Un valor de token.

## Retorno esperado

Un cambio hexadecimal desbloquea todos los CTA de conversión de trial de golpe. Es un fallo de accesibilidad real y del tipo exacto que se pide en las clases de QA.

---

## Related Issues

- relates to: [FRESCO-299](https://basiliomontescastano.atlassian.net/browse/FRESCO-299) - Diseño: 3 hallazgos de contraste WCAG AA pendientes tras FRESCO-283 (text-warning ×2 + token text-tertiary #847456)

---

## Metadata

- **Created:** 8/27/2026
- **Updated:** 8/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-2

---

_Synced from Jira by sync-jira-issues_
