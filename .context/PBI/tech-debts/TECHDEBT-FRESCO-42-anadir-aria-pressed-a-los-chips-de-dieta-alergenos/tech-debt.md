# Tarea: Añadir aria-pressed a los chips de dieta/alérgenos/cocina del onboarding

**Jira Key:** [FRESCO-42](https://basiliomontescastano.atlassian.net/browse/FRESCO-42)
**Status:** Finalizada
**Type:** Tarea

---

## Description

***Origen:*** auditoría de accesibilidad de sesión.

***Qué:*** `app/onboarding/page.tsx` líneas 200-264 (dieta*option, alergeno*option, ingrediente*odiado*option, cocina_option) renderizan botones nativos envolviendo un `<Tag variant={seleccionado ? 'selected' : 'outline'}>` pero nunca setean `aria-pressed` en el botón — el estado 'seleccionado' se comunica solo por color.

***Severidad:*** real (WCAG 4.1.2/1.4.1). Esfuerzo bajo.

---

## Fields

### Clasificación

0|i000b3:

### customfield_10000

{}

---

## Metadata

- **Created:** 8/2/2026
- **Updated:** 8/2/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
