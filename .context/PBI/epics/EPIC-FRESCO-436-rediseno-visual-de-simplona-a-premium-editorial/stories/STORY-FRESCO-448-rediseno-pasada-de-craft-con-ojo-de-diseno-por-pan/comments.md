# Comments for FRESCO-448

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-448)

---

### Basi Montes - 9/5/2026, 5:41:14 PM

## Acceptance Criteria

### Escenario: cada estado diseñado

- ***Dado*** cualquier pantalla
- ***Entonces*** sus estados empty, loading (skeleton que calca el layout) y error están diseñados y escritos, no genéricos

### Escenario: micro-estados deliberados

- ***Dado*** cualquier control interactivo
- ***Entonces*** tiene hover, focus, active y disabled definidos y consistentes con el sistema

### Escenario: coherencia bajo presión

- ***Dado*** 320px de ancho, dark mode, un nombre de receta de 40+ caracteres, una semana vacía y 3 alérgenos filtrados
- ***Cuando*** se recorren todas las pantallas
- ***Entonces*** ninguna se ve rota, descuadrada ni con texto desbordado

### Escenario: revisión con impeccable

- ***Dado*** el skill `impeccable`
- ***Entonces*** cada pantalla principal ha pasado al menos una pasada de crítica y corrección documentada

---


_Synced from Jira by sync-jira-issues_
