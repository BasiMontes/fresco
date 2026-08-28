# DEFECT: Dropdown: hover de opciones sin distinguir de estado seleccionado (verde)

**Jira Key:** [FRESCO-276](https://basiliomontescastano.atlassian.net/browse/FRESCO-276)
**Priority:** Medium
**Status:** Merged
**Components:** None

---

## Description

Usuario pregunto por que el hover de las opciones del Dropdown (ej. onboarding paso 1, Sexo) no era verde. Verificado: hover usaba hover:bg-neutral-200 (gris), deliberado desde FRESCO-262 (accent-100 estaba reservado para card-insight, no como tinte generico de hover). Usuario pidio explicitamente un tono verde para el hover: accent-300. Cambio: components/ui/dropdown.tsx, hover:bg-neutral-200 -> hover:bg-accent-300 en las opciones no seleccionadas (selected sigue en bg-primary).

---

## Related Issues

- relates to: [FRESCO-4](https://basiliomontescastano.atlassian.net/browse/FRESCO-4) - Onboarding
- relates to: [FRESCO-262](https://basiliomontescastano.atlassian.net/browse/FRESCO-262) - Dropdown: hover/selected usa accent-100, color reservado para card-insight (viola DESIGN.md)

---

## Metadata

- **Created:** 8/26/2026
- **Updated:** 8/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** ui-bug

---

_Synced from Jira by sync-jira-issues_
