# Comments for FRESCO-443

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-443)

---

### Basi Montes - 9/5/2026, 5:40:58 PM

## Acceptance Criteria

### Escenario: contraste AA en formularios

- ***Dado*** cualquier input, placeholder, label o toggle
- ***Entonces*** cumple contraste AA (≥4.5:1 texto, ≥3:1 UI)

### Escenario: foco visible

- ***Dado*** navegación por teclado
- ***Entonces*** cada control interactivo muestra un focus ring del sistema de diseño

### Escenario: dropdown con estados

- ***Dado*** un dropdown abierto
- ***Cuando*** se hace hover o hay una opción seleccionada
- ***Entonces*** el fondo se pinta (cierra FRESCO-257 y FRESCO-262)

### Escenario: tag pill estable

- ***Dado*** una tag pill
- ***Cuando*** se selecciona
- ***Entonces*** no cambia de tamaño (cierra FRESCO-258)

---


_Synced from Jira by sync-jira-issues_
