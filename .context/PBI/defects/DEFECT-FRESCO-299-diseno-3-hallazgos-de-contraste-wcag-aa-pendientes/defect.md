# DEFECT: Diseño: 3 hallazgos de contraste WCAG AA pendientes tras FRESCO-283 (text-warning ×2 + token text-tertiary #847456)

**Jira Key:** [FRESCO-299](https://basiliomontescastano.atlassian.net/browse/FRESCO-299)
**Priority:** Medium
**Status:** Listo
**Components:** None

---

## Description

## Contexto

Hallazgos de contraste WCAG AA de la misma clase que FRESCO-283, dejados fuera de su scope. Re-auditoría 27 ago 2026, eje Diseño. FRESCO-283 arregló el CTA primario ámbar; estos tres quedaron pendientes.

## Hallazgos

### 1. `text-warning` en el medidor de fuerza de contraseña

`components/ui/password-input.tsx` — la etiqueta "Media" del nivel de fuerza usa `text-warning` (`#DF8C26`) sobre el fondo del formulario (crema `#FAF3E3`) → ***~******2,4******:******1***. Texto pequeño (`text-caption`), necesita 4,5:1. Visible en `/signup` y `/onboarding` al escribir una contraseña de fuerza media. La barra `bg-warning` en sí es decorativa (`role="presentation"`) y no necesita contraste, pero la etiqueta de texto sí.

### 2. `text-warning` en el aviso de borrador legal

`components/legal/legal-modal.tsx` línea ~152 — el aviso "Borrador — pendiente de revisión legal antes de producción" usa `text-warning` sobre `bg-warning/10` (crema apenas teñida) → ***~******2,3******:******1***. Texto pequeño (`text-caption`). Visible en los modales de Términos y Privacidad.

### 3. Token de texto atenuado `--color-tertiary` (`#847456`) falla AA en todo el sitio

`app/globals.css` — `--color-tertiary: #847456` (= `--color-neutral-600`). Como `text-tertiary` mide ***~******4,1******:******1 sobre crema**** y ****~******3,6******:******1 sobre surface**** (`#F1E3C6`). Texto normal necesita 4,5:1. ****173 usos en 64 archivos*** — precios "/mes", descripciones, kickers, líneas meta de las recipe-cards, placeholders. Pasa el umbral de texto grande (3,0:1) pero no el de texto normal, y la mayoría de estos usos son texto pequeño/normal.

***Este tercer hallazgo necesita decisión de enfoque antes de codificar*** (igual que FRESCO-283): oscurecer el token `--color-tertiary` globalmente (arregla los 173 de golpe, pero recalibra toda la jerarquía de grises cálidos) vs. subir caso por caso a `neutral-700` (`#66593F`) solo donde el texto es pequeño. Los números exactos se re-miden en vivo con Playwright durante el fix.

## Solución propuesta

- Hallazgos 1 y 2: cambiar `text-warning` por un tono ámbar más oscuro para texto sobre crema — reutilizar `text-accent-2-700` (`#8A5513`, ~5,6:1), el mismo token que FRESCO-283 usó para el ámbar-como-texto. Cambio de 2 líneas.
- Hallazgo 3: pendiente de decisión (ver arriba).

## Retorno esperado

Cierra la deuda de contraste de la re-auditoría en el eje Diseño. Los hallazgos 1 y 2 son triviales; el 3 es el que mueve la aguja de accesibilidad del producto (afecta casi toda la copia secundaria).

---

## Related Issues

- relates to: [FRESCO-283](https://basiliomontescastano.atlassian.net/browse/FRESCO-283) - Diseño: el CTA primario ámbar falla contraste WCAG AA (2,40:1)

---

## Metadata

- **Created:** 8/27/2026
- **Updated:** 8/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-2

---

_Synced from Jira by sync-jira-issues_
