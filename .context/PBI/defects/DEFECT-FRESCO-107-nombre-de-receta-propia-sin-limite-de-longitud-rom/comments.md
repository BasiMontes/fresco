# Comments for FRESCO-107

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-107)

---

### Basi Montes - 8/7/2026, 11:12:39 AM

## Spec Implementation Plan (Dev)

create-recipe-form.tsx: maxLength={100} en el input de nombre (más largo que la receta de catálogo más larga en DB, 74 chars). personal-recipe-card.tsx: line-clamp-2 en el h3 como defensa en capa de presentación, independiente del límite de input. Verificado en vivo: card no rompe grid con nombre de 100 chars.

---


_Synced from Jira by sync-jira-issues_
