# Comments for FRESCO-114

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-114)

---

### Basi Montes - 8/7/2026, 11:12:01 AM

## Spec Implementation Plan (Dev)

Guard síncrono (useRef) además de disabled={isSubmitting} en los 4 formularios (login, signup, forgot-password, update-password) — disabled solo actúa tras re-render de React, no alcanza a bloquear 2 clicks en el mismo tick. Verificado en vivo: triple click sincrónico produce 1 solo POST.

---


_Synced from Jira by sync-jira-issues_
