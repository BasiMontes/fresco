# Comments for FRESCO-67

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-67)

---

### Basi Montes - 8/3/2026, 2:46:38 PM

## Scope

- Filtro por tipo de cocina (las mismas etiquetas ya visibles en cada card: española, italiana, mediterránea, etc.)
- Filtro por restricción de dieta (vegetariano, vegano, sin gluten, etc.)
- Filtro por un alérgeno puntual que Laura quiera evitar en esa búsqueda, aunque no lo tenga declarado en su perfil

---

### Basi Montes - 8/3/2026, 2:46:39 PM

## Out Of Scope

- Guardar combinaciones de filtros como favoritas
- Cambiar el perfil permanente de Laura desde estos filtros

---

### Basi Montes - 8/3/2026, 2:46:41 PM

## Acceptance Criteria

```gherkin
Scenario: Filtrar por cocina
Given Laura está en la Biblioteca
When selecciona un filtro de cocina, por ejemplo "Italiana"
Then ve solo recetas de esa cocina

Scenario: Filtrar por dieta
Given Laura está en la Biblioteca
When selecciona un filtro de dieta, por ejemplo "Vegano"
Then ve solo recetas que cumplen esa restricción

Scenario: Filtrar por un alérgeno puntual
Given Laura quiere evitar un ingrediente puntual que no tiene declarado en su perfil
When activa ese filtro de alérgeno en la Biblioteca
Then no ve ninguna receta que lo contenga, sin que cambie su perfil permanente
```

---

### Basi Montes - 8/3/2026, 2:46:42 PM

## Business Rules Specification

- Estos filtros son de la sesión de exploración de Laura — nunca modifican su perfil permanente ni sus exclusiones ya declaradas en onboarding.
- Estos filtros solo pueden restringir más el conjunto de recetas, nunca mostrar una receta ya excluida por el perfil permanente.

---


_Synced from Jira by sync-jira-issues_
