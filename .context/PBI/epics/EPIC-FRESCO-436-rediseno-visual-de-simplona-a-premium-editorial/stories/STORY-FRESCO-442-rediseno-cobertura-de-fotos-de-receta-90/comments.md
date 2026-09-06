# Comments for FRESCO-442

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-442)

---

### Basi Montes - 9/5/2026, 5:40:54 PM

## Acceptance Criteria

### Escenario: cobertura de catálogo

- ***Dado*** el catálogo completo de recetas
- ***Cuando*** se cierra la tarjeta
- ***Entonces*** ≥90% tienen `foto_url` verificada (no mismatch, sin marca)

### Escenario: la cola larga está cubierta por diseño

- ***Dado*** el <10% sin foto
- ***Entonces*** su card usa el placeholder con intención de la tarjeta 5
- ***Y*** ninguna pantalla se ve incompleta por ello

### Escenario: pipeline verificado en uso

- ***Dado*** FRESCO-435 entregado
- ***Entonces*** las nuevas fotos pasan por su verificación automática antes de aplicarse

---


_Synced from Jira by sync-jira-issues_
