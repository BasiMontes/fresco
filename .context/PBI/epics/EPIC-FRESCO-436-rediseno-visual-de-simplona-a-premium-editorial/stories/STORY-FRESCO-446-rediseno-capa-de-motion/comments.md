# Comments for FRESCO-446

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-446)

---

### Basi Montes - 9/5/2026, 5:41:07 PM

## Acceptance Criteria

### Escenario: tokens de motion en uso

- ***Dado*** cualquier transición o animación
- ***Entonces*** usa una duración y un easing del token, no valores hardcodeados

### Escenario: reveals en landing

- ***Dado*** que el usuario hace scroll en la landing
- ***Entonces*** las secciones entran con un reveal suave

### Escenario: feedback en la app

- ***Dado*** hover sobre una card o botón interactivo
- ***Entonces*** hay una respuesta de motion coherente

### Escenario: respeta reduced-motion

- ***Dado*** `prefers-reduced-motion: reduce`
- ***Entonces*** las animaciones no esenciales se desactivan

---


_Synced from Jira by sync-jira-issues_
