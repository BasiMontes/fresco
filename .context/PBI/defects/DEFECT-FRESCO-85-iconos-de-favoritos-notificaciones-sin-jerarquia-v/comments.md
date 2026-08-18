# Comments for FRESCO-85

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-85)

---

### Basi Montes - 8/6/2026, 3:58:23 PM

## Resuelto

Causa real: `tailwind.config.ts` sobreescribe la escala `spacing` con la fórmula 4.4px×n de DESIGN.md pero le faltaba la key `5` — `size-5` caía al default de Tailwind (20px) en vez de los 22px reales del token `components.icon.size`.

Fix: `size-[22px]` explícito en `app/(app)/menu/page.tsx` (Heart/Bell), `components/recipe/recipe-card.tsx` (Heart). No se tocó la escala global `spacing` (blast radius no auditado en otros usos de `-5` en la app).

Validado en vivo con Playwright, `types:check`/`lint:check` verdes.


---

### Basi Montes - 8/16/2026, 6:04:46 PM

Los sigo viendo pequeños en proporción, te he adjuntado una imagen



---


_Synced from Jira by sync-jira-issues_
