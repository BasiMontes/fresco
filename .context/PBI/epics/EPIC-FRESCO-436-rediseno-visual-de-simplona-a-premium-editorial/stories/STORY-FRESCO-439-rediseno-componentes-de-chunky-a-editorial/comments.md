# Comments for FRESCO-439

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-439)

---

### Basi Montes - 9/5/2026, 5:40:44 PM

## Acceptance Criteria

### Escenario: cards con separación visible

- ***Dado*** cualquier card sobre el lienzo
- ***Entonces*** hay una separación clara (superficie distinta + hairline o sombra) — nunca beige sobre beige sin borde

### Escenario: botones con jerarquía real

- ***Dado*** una pantalla con acción primaria y secundaria
- ***Entonces*** la primaria es relleno de acento y la secundaria es outline hairline
- ***Y*** ningún botón activo se ve como deshabilitado

### Escenario: inputs que no parecen deshabilitados

- ***Dado*** un campo de formulario vacío
- ***Entonces*** su borde y su placeholder tienen contraste suficiente para leerse como activo
- ***Y*** al enfocarlo aparece un focus ring del sistema de diseño

### Escenario: tags sin ruido de color

- ***Dado*** un tag de dieta o alérgeno
- ***Entonces*** se representa con hairline + texto, sin relleno de color

---


_Synced from Jira by sync-jira-issues_
