# Comments for FRESCO-208

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-208)

---

### Basi Montes - 8/17/2026, 9:12:35 PM

QA en staging (fresco-pre.vercel.app) — no se puede dar por corregido, el código raíz del bug sigue sin cambios.

***Dónde******:*** `components/layout/sidebar.tsx` línea 43 — la sidebar sigue usando `className="sticky top-0 hidden h-screen w-64 ..."`. No hay ningún `overscroll-behavior` en `app/globals.css` ni en el layout que evite el "rebote" elástico del scroll (rubber-band overscroll de trackpad en macOS Safari/Chrome) revele el hueco por encima/debajo de la sidebar.

***Pasos para reproducir******:***

1. En `/recipes` (o cualquier ruta con sidebar y contenido más largo que la ventana), hacer scroll hasta el final de la página con gesto de trackpad físico (no rueda de ratón sintética).
2. Seguir haciendo scroll más allá del límite inferior (o superior, volviendo a subir) para provocar el rebote elástico.

***Esperado******:*** la sidebar (verde, `bg-primary`) debe cubrir siempre el viewport durante el rebote, sin ningún hueco visible.

***Observado******:*** el propio adjunto del ticket (captura `Captura de pantalla 2026-08-15 a las 14.42.51...png`) muestra una franja oscura/hueco por encima de la sidebar y el contenido durante el rebote — el mismo estado de `/recipes` (recetas "Alubias con verduras", "Tempeh al horno", etc.) que usé para inspeccionar el código.

***Nota de metodología******:*** no logré reproducir el rebote elástico con un `mousewheel` sintético vía CDP (Chromium no simula el "momentum phase" real de un trackpad físico en gestos sintéticos), así que la verificación se apoya en: (1) la captura de pantalla ya adjunta al ticket como evidencia directa del bug, y (2) la confirmación de que el causante (`sticky` + `h-screen` sin ningún `overscroll-behavior` de contención) sigue presente sin cambios en el código de staging, y (3) no hay ningún comentario de PR/deploy en este ticket que indique que se aplicó una corrección.

No se puede dar como corregido con la evidencia disponible.

---


_Synced from Jira by sync-jira-issues_
