# Comments for FRESCO-444

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-444)

---

### Basi Montes - 9/5/2026, 5:41:01 PM

## Acceptance Criteria

### Escenario: sin gutter muerto en Calendario

- ***Dado*** la vista de Calendario semanal
- ***Entonces*** no hay una columna vacía de >120px
- ***Y*** los labels de comida siguen siendo legibles por fila

### Escenario: pantallas centradas ancladas

- ***Dado*** login, 404 o un empty state
- ***Entonces*** el contenido está anclado (no flotando en el centro vertical con >200px de hueco arriba)

### Escenario: ritmo de sección consistente

- ***Dado*** cualquier página con varias secciones
- ***Entonces*** el espaciado entre ellas usa la escala del token, no valores ad-hoc

### Escenario: stat tiles a hairline

- ***Dado*** los tiles de estadística del Menú
- ***Entonces*** usan hairline en vez de caja rellena y el dato es el elemento dominante

---


_Synced from Jira by sync-jira-issues_
