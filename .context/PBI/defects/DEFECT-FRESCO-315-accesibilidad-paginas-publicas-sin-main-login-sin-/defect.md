# DEFECT: Accesibilidad: páginas públicas sin <main>, /login sin <label>, targets <44px, robots 404, H2 roto

**Jira Key:** [FRESCO-315](https://basiliomontescastano.atlassian.net/browse/FRESCO-315)
**Priority:** Medium
**Status:** WIP
**Components:** None

---

## Description

HALLAZGO BAJO F. Medido en vivo con Playwright a 390 y 1280 px sobre landing, /login y /qa.

- Sin <main> en ninguna de las tres páginas (landing: HEADER/NAV/FOOTER; /qa: HEADER/FOOTER; /login: ninguno). Un lector de pantalla no puede saltar al contenido (WCAG 2.4.1). Un <main> por layout lo resuelve.
- Inputs de /login sin <label for>: nombre accesible solo por aria-label que duplica el placeholder y desaparece al escribir (WCAG 3.3.2).
- 12 controles por debajo de 44 px en móvil: Privacidad 51x26, Términos 45x26, Contacto 47x26, "Ya tengo cuenta" 130x26, hamburguesa 40x31, 7 acordeones de FAQ 355x38. Pasan el mínimo WCAG 2.5.8 (24 px) pero no el objetivo cómodo. Mismo movimiento que FRESCO-288.
- /robots.txt da 404 en una landing con title y meta description cuidados. Un app/robots.ts de 8 líneas.
- H2 "El próximo domingosin agobio": dos nodos de texto sin espacio (un <br> o <span>). Mal en lector de pantalla y en búsqueda de texto.

Limpio: 0 errores de consola, 0 imágenes sin alt, lang="es", un solo H1, sin overflow horizontal, TTFB ~155 ms.


---

## Related Issues

- relates to: [FRESCO-288](https://basiliomontescastano.atlassian.net/browse/FRESCO-288) - Accesibilidad: el fix de áreas táctiles no llegó al footer de auth ni al checkbox de `/signup`

---

## Metadata

- **Created:** 8/29/2026
- **Updated:** 8/30/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-3

---

_Synced from Jira by sync-jira-issues_
