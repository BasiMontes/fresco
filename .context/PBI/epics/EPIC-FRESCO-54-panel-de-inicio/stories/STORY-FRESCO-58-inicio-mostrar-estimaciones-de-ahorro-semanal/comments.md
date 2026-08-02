# Comments for FRESCO-58

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-58)

---

### Basi Montes - 8/2/2026, 9:30:23 PM

## Scope

- Tres cards en Inicio: gasto semanal estimado, ahorro estimado, tiempo recuperado estimado

---

### Basi Montes - 8/2/2026, 9:30:25 PM

## Out Of Scope

- Cálculo personalizado a partir del historial real de compras o de recetas cocinadas por el usuario (posible épica futura)

---

### Basi Montes - 8/2/2026, 9:30:26 PM

## Acceptance Criteria

```gherkin
Scenario: Ver las tres estimaciones
Given Laura abre Inicio
When mira las cards de estimación
Then ve una estimación de gasto semanal, una de ahorro y una de tiempo recuperado, cada una indicando que es un valor orientativo
```

---

### Basi Montes - 8/2/2026, 9:30:27 PM

## Business Rules Specification

- Las tres estimaciones son valores orientativos generales para todos los usuarios, no calculados a partir de la actividad real de cada usuario en esta versión.

---


_Synced from Jira by sync-jira-issues_
