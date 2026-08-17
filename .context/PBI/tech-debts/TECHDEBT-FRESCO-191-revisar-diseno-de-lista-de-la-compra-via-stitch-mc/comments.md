# Comments for FRESCO-191

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-191)

---

### Basi Montes - 8/13/2026, 6:24:11 PM

Adaptado sin conectar el MCP de Stitch todavía -- descargué el screenshot + HTML adjuntos directo de la tarjeta vía REST API y trabajé desde ahí. PR #62 mergeado (squash) a staging, commit fe9ffbb.

Adoptado (datos reales ya existentes, solo no se mostraban): card de Resumen con artículos pendientes en vivo + rango de costo estimado (resumen.coste*estimado*min/max, ya calculado, nunca mostrado antes). Headers de pasillo con ícono (mapeado de los 10 nombres de pasillo reales vistos en datos persistidos, fallback genérico para cualquier otro). Filas de item en cards redondeadas.

Descartado a propósito (sin datos falsos): precio por item (la app solo tiene precio de la lista completa), carrusel de sugerencias y badges 'Nuevo' (no existe ese dato), nav inferior Pantry/History del mockup (es el nav global de AppShell, afecta todas las rutas).

Encontrado en el camino: bg-secondary/10 en el ícono de pasillo pisó el mismo bug de opacidad de FRESCO-169 -- corregido con accent-2-100 (tinte pre-calculado del mismo color). Intenté checkbox redondeado tipo mockup, confirmado en vivo que appearance:auto del navegador ignora border-radius en checkbox nativo sin estilizar -- no existe componente Checkbox custom en el design system todavía, así que quedó el checkbox cuadrado nativo normal, igual que el resto de la app.

Validado en vivo: toggle funciona, contador de pendientes se actualiza al instante, persiste tras reload.

---


_Synced from Jira by sync-jira-issues_
