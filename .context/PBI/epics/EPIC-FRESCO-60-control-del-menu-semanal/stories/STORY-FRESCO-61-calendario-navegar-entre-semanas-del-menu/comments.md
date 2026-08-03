# Comments for FRESCO-61

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-61)

---

### Basi Montes - 8/3/2026, 1:50:47 PM

## Scope

- Controles de navegación (anterior/siguiente) en /calendar para moverse a la semana adyacente
- La semana visitada muestra su propio menú, o el estado vacío si nunca se generó uno para ella

---

### Basi Montes - 8/3/2026, 1:50:48 PM

## Out Of Scope

- Saltar a una semana arbitraria (buscador o selector de fecha) — solo navegación secuencial anterior/siguiente en esta versión
- Editar (arrastrar/reordenar) una semana distinta a la actual — eso sigue siendo alcance ya cubierto de FRESCO-11, sin cambios acá

---

### Basi Montes - 8/3/2026, 1:50:49 PM

## Acceptance Criteria

```gherkin
Scenario: Ver la semana siguiente
Given Laura está en /calendar viendo la semana actual
When toca el control de semana siguiente
Then ve el menú de la semana siguiente si existe, o el estado vacío si todavía no se generó ninguno

Scenario: Ver la semana anterior
Given Laura está en /calendar viendo la semana actual
When toca el control de semana anterior
Then ve el menú de la semana anterior si existe, o el estado vacío si nunca se generó uno para esa semana

Scenario: Volver a la semana actual conserva el resto de funciones
Given Laura navegó a otra semana
When vuelve a la semana actual
Then el calendario se comporta exactamente igual que antes de navegar (arrastrar recetas, marcar cocinado/descartado, etc.)
```

---

### Basi Montes - 8/3/2026, 1:50:51 PM

## Business Rules Specification

- La navegación es estrictamente semana anterior/siguiente (sin salto a una semana arbitraria en esta versión).
- Cada semana visitada es independiente entre sí; no hay un límite documentado de cuántas semanas hacia adelante o atrás se puede navegar.

---


_Synced from Jira by sync-jira-issues_
