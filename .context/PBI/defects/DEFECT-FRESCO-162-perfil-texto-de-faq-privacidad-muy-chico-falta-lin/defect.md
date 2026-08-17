# DEFECT: /perfil: texto de FAQ/Privacidad muy chico + falta link a Términos de Servicio

**Jira Key:** [FRESCO-162](https://basiliomontescastano.atlassian.net/browse/FRESCO-162)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `components/profile/ayuda-section.tsx` (FAQ, líneas ~137-145) y `components/legal/legal-modal.tsx` (Términos/Privacidad, línea ~149) — todo el cuerpo de texto usa `text-body-sm text-tertiary` (13px, color atenuado).
- Hallazgo directo del user: el texto de FAQ y Privacidad es muy chico. Además falta un link a Términos de Servicio.
- Investigado: el contenido de Términos de Servicio ***ya existe completo*** en `legal-modal.tsx` (`TERMS_SECTIONS`, `section="terminos"`) — solo falta exponerlo. `AyudaSection`'s `ROWS` solo tiene `configuracion`/`faq`/`privacidad`, sin fila para términos.

## Cambio propuesto

- Subir el texto de cuerpo (preguntas/respuestas de FAQ, secciones de Términos/Privacidad) de `text-body-sm` (13px) a `text-body-md` (15px), y de `text-tertiary` a `text-text` (es contenido principal a leer, no metadata secundaria).
- Agregar una 4ta fila "Términos de Servicio" en `AyudaSection.ROWS`, abriendo `LegalModal` con `section="terminos"` (mismo patrón que ya usa `privacidad`).

## Alcance

- Solo tipografía/color de cuerpo + la fila nueva. No reescribe el contenido legal de `TERMS*SECTIONS`/`PRIVACY*SECTIONS` ni el disclaimer de "Borrador — pendiente de revisión legal".

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
