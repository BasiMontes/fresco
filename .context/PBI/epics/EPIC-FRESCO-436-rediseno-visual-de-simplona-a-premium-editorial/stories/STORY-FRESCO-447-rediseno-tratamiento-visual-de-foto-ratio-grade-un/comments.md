# Comments for FRESCO-447

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-447)

---

### Basi Montes - 9/5/2026, 5:41:11 PM

## Acceptance Criteria

### Escenario: ratio único

- ***Dado*** una foto de receta en cualquier superficie
- ***Entonces*** se recorta al mismo aspect ratio en todas ellas

### Escenario: grade unificador

- ***Dado*** dos fotos de receta de fuentes distintas una al lado de la otra
- ***Entonces*** comparten un tono coherente (mismo filtro aplicado)
- ***Y*** el filtro es una utilidad reutilizable, no CSS por pantalla

### Escenario: sin deformación

- ***Dado*** una foto con dimensiones originales distintas al contenedor
- ***Entonces*** se usa `cover` sin estirar ni deformar

---


_Synced from Jira by sync-jira-issues_
