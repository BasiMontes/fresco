# Comments for FRESCO-86

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-86)

---

### Basi Montes - 8/6/2026, 3:58:24 PM

## Resuelto

El color en código ya era `text-primary` (`#0F4E0E`, verde corporativo) — confirmado con `getComputedStyle` en vivo (`rgb(15, 78, 14)` exacto). El "pálido" era el trazo de 2px de `lucide-react` a 16px (`size-4`), no un color equivocado.

Fix: `size-[22px]` en `components/menu/horizontal-scroll-row.tsx` (ChevronLeft/ChevronRight) — mismo fix que FRESCO-85, gap del token de spacing "5".

Validado en vivo: chevron confirmado sólido y con el hex correcto.


---


_Synced from Jira by sync-jira-issues_
