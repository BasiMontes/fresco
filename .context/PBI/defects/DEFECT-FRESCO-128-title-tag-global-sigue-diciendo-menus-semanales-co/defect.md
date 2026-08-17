# DEFECT: Title tag global sigue diciendo 'Menús semanales con IA'

**Jira Key:** [FRESCO-128](https://basiliomontescastano.atlassian.net/browse/FRESCO-128)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

Qué se observa

Dónde: app/layout.tsx:33 (metadata.title, aplica a toda la app — pestaña del navegador, SEO, compartidos sociales)

Pasos para reproducir:
1. Abrir cualquier página de la app y mirar el título de la pestaña del navegador, o el <title> del HTML.

Esperado: el título no debería afirmar algo que ya no es cierto sobre la arquitectura del producto.

Observado: "Fresco — Menús semanales con IA que aprende de lo que realmente cocinas" — framing de "IA" desactualizado desde la eliminación de Gemini (2026-08-01, ADR-0005). Mismo tema que el FAQ de ayuda-section.tsx y la contradicción en /qa, pero en el <title> global, con impacto adicional en SEO/compartidos ya que es lo que aparece en resultados de búsqueda y previews de enlaces.

Por qué importa

Baja severidad funcional pero es el título global de toda la app — visible en cada pestaña, cada resultado de búsqueda, cada preview al compartir un link.

Alcance

Reescribir el título sin la referencia a "IA" — enfocar en el beneficio real (aprende de tu historial real de comidas, sin necesidad de mencionar el mecanismo técnico).

Cómo reproducir

Ver Pasos para reproducir arriba.


---

## Metadata

- **Created:** 8/8/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** minor, qa-sweep-2026-08-08

---

_Synced from Jira by sync-jira-issues_
