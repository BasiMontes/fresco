# Comments for FRESCO-65

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-65)

---

### Basi Montes - 8/3/2026, 2:46:30 PM

## Scope

- Grid de recetas de todo el catálogo (ya filtrado por alergias/dieta del perfil de Laura), no solo las que ya cocinó
- Buscador que filtra ese grid por nombre de receta o por ingrediente

---

### Basi Montes - 8/3/2026, 2:46:31 PM

## Out Of Scope

- Búsqueda por categoría/cocina/dieta (eso queda para la historia de filtros)
- Cualquier receta fuera del perfil de seguridad alimentaria de Laura

---

### Basi Montes - 8/3/2026, 2:46:32 PM

## Acceptance Criteria

```gherkin
Scenario: Buscar por nombre
Given Laura está en la Biblioteca de recetas
When escribe el nombre de una receta en el buscador
Then ve solo las recetas del catálogo que coinciden con ese nombre

Scenario: Buscar por ingrediente
Given Laura está en la Biblioteca de recetas
When escribe un ingrediente en el buscador
Then ve las recetas del catálogo que contienen ese ingrediente

Scenario: Buscador sin resultados
Given Laura busca algo que ninguna receta contiene
When mira los resultados
Then ve un estado vacío claro, no una pantalla en blanco
```

---

### Basi Montes - 8/3/2026, 2:46:33 PM

## Business Rules Specification

- El buscador siempre opera dentro de las recetas ya filtradas por el perfil de seguridad alimentaria de Laura (alérgenos/dieta) — nunca muestra una receta fuera de ese conjunto.

---


_Synced from Jira by sync-jira-issues_
