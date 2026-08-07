# Comments for FRESCO-108

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-108)

---

### Basi Montes - 8/7/2026, 11:12:25 AM

## Spec Implementation Plan (Dev)

Nuevo components/recipe/favorite-toggle-button.tsx (mismo patrón optimista que FavoriteRecipeCard), montado en CatalogRecipeDetail (recipe-detail.tsx) sobre la imagen. page.tsx del detalle ahora también lee getFavoriteRecipeIds() para el initialIsFavorite. Solo aplica a recetas de catálogo, no propias. Verificado en vivo: toggle funciona y persiste tras reload.

---


_Synced from Jira by sync-jira-issues_
