# DEFECT: Accesibilidad: el fix de áreas táctiles no llegó al footer de auth ni al checkbox de `/signup`

**Jira Key:** [FRESCO-288](https://basiliomontescastano.atlassian.net/browse/FRESCO-288)
**Priority:** Medium
**Status:** Listo
**Components:** None

---

## Description

## Contexto

Re-auditoría 27 ago 2026, hallazgo 10 (MEDIO), eje Diseño. FRESCO-267 arregló el footer de la landing y los toggles del FAQ; este layout se quedó fuera. Regresión de cobertura, no de código.

## Hallazgo

Medido a 390 px sobre producción:

- ***Footer del layout de auth**** (`/login`, `/signup`, "Términos · Privacidad · Contacto", `<button class="underline">`): ****44,7–50,8 × 14,3 px*** de alto. `line-height: 14,3px`, sin padding — a diferencia del footer de la landing, que sí recibió `padding-block: 6px` en FRESCO-267. Falla WCAG 2.5.8 (24×24). Además contraste `#847456` sobre `#faf3e3` = 4,12:1 (ver ticket 7).
- ***Checkbox de consentimiento de ****`/signup` (`<input type="checkbox" class="size-4 …">`): renderiza a ****17,6 × 17,6 px*** sin hit-area expandida (el `<label>` envolvente no aumenta el target del control). Falla WCAG 2.5.8. Es gate obligatorio para crear cuenta.

## Plan de acción

1. Aplicar `padding-block` a los enlaces del footer del layout de auth (mismo patrón que la landing).
2. Envolver el checkbox de `/signup` en un target táctil de ≥24×24 px (padding en el label + `cursor-pointer`, o `min-h`/`min-w` en un wrapper).

## Retorno esperado

Cierra el hallazgo BAJO del baseline de verdad, en todos los layouts.

---

## Related Issues

- relates to: [FRESCO-267](https://basiliomontescastano.atlassian.net/browse/FRESCO-267) - Accesibilidad: áreas táctiles móviles bajo 24×24px (FAQ + footer)

---

## Metadata

- **Created:** 8/27/2026
- **Updated:** 8/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-2

---

_Synced from Jira by sync-jira-issues_
