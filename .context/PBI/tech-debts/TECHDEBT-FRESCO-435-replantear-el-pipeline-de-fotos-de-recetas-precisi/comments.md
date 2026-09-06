# Comments for FRESCO-435

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-435)

---

### Basi Montes - 9/5/2026, 5:27:38 PM

## Acceptance Criteria

### Escenario: verificación automática sin QA manual

- ***Dado*** un lote de recetas sin foto
- ***Cuando*** se ejecuta el pipeline
- ***Entonces*** cada imagen candidata se acepta o rechaza automáticamente (verificación semántica: la imagen representa el plato) sin revisión visual humana por tanda

### Escenario: precisión de lo aplicado

- ***Dado*** el pipeline con verificación activa
- ***Cuando*** termina una corrida
- ***Entonces*** menos del 10% de las fotos aplicadas son mismatch en una auditoría de control
- ***Y*** ninguna foto aplicada muestra logos, packaging o texto de marca

### Escenario: decisión de cobertura documentada

- ***Dado*** el spike de fuentes (Spoonacular / API de recetas / generación IA)
- ***Cuando*** se cierra la tarjeta
- ***Entonces*** hay una decisión escrita sobre qué fuente(s) usar para llegar a >=90% de cobertura del catálogo, con coste y licencia evaluados

### Escenario: catálogo cubierto

- ***Dado*** el pipeline definitivo
- ***Cuando*** se corre sobre el catálogo completo
- ***Entonces*** al menos el 90% de las recetas tienen foto verificada
- ***Y*** el resto queda explícitamente marcado para el estado placeholder del rediseño

---


_Synced from Jira by sync-jira-issues_
