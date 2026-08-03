# Comments for FRESCO-62

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-62)

---

### Basi Montes - 8/3/2026, 1:50:52 PM

## Scope

- Un control que elimina por completo el menú de la semana que Laura está viendo en ese momento
- Tras eliminar, la pantalla cae al mismo estado vacío que usa una semana sin menú generado

---

### Basi Montes - 8/3/2026, 1:50:53 PM

## Out Of Scope

- Deshacer o recuperar un menú ya eliminado
- Eliminar más de una semana a la vez — solo la semana que Laura está viendo

---

### Basi Montes - 8/3/2026, 1:50:54 PM

## Acceptance Criteria

```gherkin
Scenario: Laura elimina el menú de la semana que está viendo
Given Laura ve un menú generado para la semana actual
When toca el botón de eliminar
Then el menú completo de esa semana desaparece y ve el mismo estado vacío que si nunca hubiera generado uno

Scenario: Eliminar no afecta otras semanas
Given Laura eliminó el menú de la semana actual
When navega a otra semana con su propio menú generado
Then ese menú sigue intacto, sin ningún cambio

Scenario: No hay nada que eliminar
Given Laura ve el estado vacío de una semana sin menú generado
When mira los controles disponibles
Then no se le ofrece la opción de eliminar, porque no hay ningún menú que borrar
```

---

### Basi Montes - 8/3/2026, 1:50:55 PM

## Business Rules Specification

- Eliminar el menú de una semana es una acción permanente e inmediata en esta versión — no hay confirmación de deshacer.
- Solo afecta a la semana que Laura está viendo en ese momento, nunca a otras semanas.

---


_Synced from Jira by sync-jira-issues_
