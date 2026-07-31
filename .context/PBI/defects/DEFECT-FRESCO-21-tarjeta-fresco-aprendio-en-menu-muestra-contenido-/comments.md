# Comments for FRESCO-21

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-21)

---

### Basi Montes - 7/31/2026, 3:05:16 PM

## Actual Result

Toda visita a `/menu` con un plan generado muestra la misma tarjeta fija "Fresco aprendió — Descartaste el curry picante la semana pasada...", sin importar el tier del usuario ni su historial real. Confirmado con una invitada anónima recién creada, sin ningún historial posible.

---

### Basi Montes - 7/31/2026, 3:05:18 PM

## Expected Result

Por FR-5.5: la explicación solo debe aparecer para usuarias Pro con historial real, generada dinámicamente. Por FR-5.6: usuarias Free deben ver un mensaje de upsell explícito en su lugar.

---

### Basi Montes - 7/31/2026, 3:05:19 PM

## Root Cause

Tarjeta hardcodeada desde el scaffold inicial de `/project-bootstrap`, nunca conectada a datos reales cuando FRESCO-7 wireó el resto de `/menu`. La explicación real (FR-5.5) ya se genera correctamente en el Edge Function pero se mezcla sin discriminador en el array genérico `advertencias`, y no existe historia sembrada para US 5.2/5.3 bajo EPIC-FRESCO-5.

---


_Synced from Jira by sync-jira-issues_
