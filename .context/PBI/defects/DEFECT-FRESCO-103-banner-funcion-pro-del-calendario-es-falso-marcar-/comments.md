# Comments for FRESCO-103

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-103)

---

### Basi Montes - 8/7/2026, 11:30:49 AM

## Spec Implementation Plan (Dev)

Decisión de negocio (opción elegida por el user, con recomendación): corregir el aviso, no bloquear el marcado en Free.

Razones: el marcado ya persiste para todos los usuarios en producción, incluidos Free reales — bloquearlo ahora sería una regresión para quien ya lo usa. "El aprendizaje del menú futuro" (mencionado en el propio código como el verdadero valor Pro) no está implementado todavía — gatear el marcado ahora no le da nada a Pro a cambio, solo le quita algo a Free.

Fix: calendar-grid.tsx, copy del `learning*free*tier_notice` cambiado de "Marcar un plato... es una función de nivel Pro" a "Marcar un plato... se guarda igual en el plan Free. Lo exclusivo de Pro es que tu próximo menú aprenda de esos marcados."

---


_Synced from Jira by sync-jira-issues_
