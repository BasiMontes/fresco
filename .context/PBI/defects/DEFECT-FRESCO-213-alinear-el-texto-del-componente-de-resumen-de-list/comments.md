# Comments for FRESCO-213

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-213)

---

### Basi Montes - 8/17/2026, 9:15:12 PM

QA en staging (fresco-pre.vercel.app): en /shopping-list (Lista), el componente "Resumen" en la parte superior sigue sin alinear. Medido con getBoundingClientRect(): la línea "38 artículos pendientes" (columna izquierda) empieza en top=111.95px, mientras que la línea "62,53-84,60€" (columna derecha) empieza en top=105.06px — un desfase vertical de ~7px entre ambas líneas de detalle, claramente visible (la cifra de precio queda más alta que el contador de artículos).

Causa: el contenedor usa flex items-start justify-between con dos columnas donde la primera línea de cada columna tiene alturas distintas ("Resumen" es h2.text-h5, ~17px; "Total estimado" es p.text-caption, ~14px). Al no alinearse por fila, la segunda línea de cada columna queda desfasada.

Repro: 1) Login en staging. 2) Ir a Lista (/shopping-list). 3) Observar el bloque "Resumen" arriba de la lista de artículos — "38 artículos pendientes" y "62,53-84,60€" no están a la misma altura.

Esperado: ambas líneas de detalle alineadas horizontalmente. Observado: siguen desalineadas verticalmente ~7px. Se devuelve para aplicar el fix de alineación (por ejemplo, grid con filas iguales o align-items en cada fila en vez de en el contenedor).


---


_Synced from Jira by sync-jira-issues_
