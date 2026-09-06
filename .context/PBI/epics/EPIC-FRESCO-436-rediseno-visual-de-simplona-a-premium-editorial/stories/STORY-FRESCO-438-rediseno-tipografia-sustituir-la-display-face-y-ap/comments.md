# Comments for FRESCO-438

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-438)

---

### Basi Montes - 9/5/2026, 5:40:41 PM

## Acceptance Criteria

### Escenario: la slab novelty desaparece

- ***Dado*** el bundle de fuentes
- ***Cuando*** se cierra la tarjeta
- ***Entonces*** la display face anterior no se carga en ninguna ruta
- ***Y*** la nueva solo se aplica a H1 y H2

### Escenario: titulares calmados

- ***Dado*** cualquier titular grande (≥32px)
- ***Entonces*** su peso es 400
- ***Y*** el tracking es negativo y el line-height ≤1.05

### Escenario: títulos de card contenidos

- ***Dado*** una card de receta con nombre largo (>60 caracteres)
- ***Entonces*** el título se corta a 2 líneas con ellipsis
- ***Y*** no empuja la foto ni descuadra la card

### Escenario: cuerpo legible

- ***Dado*** texto de párrafo o label
- ***Entonces*** usa la grotesca, no la display

---

### Basi Montes - 9/5/2026, 6:24:45 PM

## PR abierta

PR #283 (base `dev`, stacked sobre #282): https://github.com/BasiMontes/fresco/pull/283

Fraunces via `next/font`, regla `h1,h2` / `h3..h6` partida en globals.css, escala tipografica retocada en tailwind, `line-clamp-2` en titulos de receta. Verificado: types + lint + 571 tests + build OK; live -> h1 computed = Fraunces, titulo de card = Figtree 600 clamp 2.

---


_Synced from Jira by sync-jira-issues_
