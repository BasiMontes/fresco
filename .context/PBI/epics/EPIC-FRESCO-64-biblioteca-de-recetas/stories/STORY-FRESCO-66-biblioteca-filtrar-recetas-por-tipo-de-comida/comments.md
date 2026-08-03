# Comments for FRESCO-66

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-66)

---

### Basi Montes - 8/3/2026, 2:46:35 PM

## Scope

- Pestañas Todo/Desayuno/Comida/Cena sobre el grid de la Biblioteca
- Combinable con el buscador (buscar dentro de la pestaña activa)

---

### Basi Montes - 8/3/2026, 2:46:36 PM

## Out Of Scope

- Pestañas adicionales más allá de Todo/Desayuno/Comida/Cena (por ejemplo, "snack")

---

### Basi Montes - 8/3/2026, 2:46:37 PM

## Acceptance Criteria

```gherkin
Scenario: Filtrar por tipo de comida
Given Laura está en la Biblioteca
When toca la pestaña "Desayuno"
Then ve solo recetas de desayuno del catálogo

Scenario: Volver a ver todo
Given Laura tiene una pestaña de tipo de comida activa
When toca "Todo"
Then vuelve a ver el catálogo completo

Scenario: Buscador y pestaña combinados
Given Laura tiene la pestaña "Comida" activa
When escribe algo en el buscador
Then los resultados respetan ambos filtros a la vez
```

---


_Synced from Jira by sync-jira-issues_
