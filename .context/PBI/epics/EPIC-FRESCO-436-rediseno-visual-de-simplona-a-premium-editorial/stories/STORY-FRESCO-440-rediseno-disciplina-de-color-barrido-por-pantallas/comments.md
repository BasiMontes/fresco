# Comments for FRESCO-440

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-440)

---

### Basi Montes - 9/5/2026, 5:40:47 PM

## Acceptance Criteria

### Escenario: un solo naranja por pantalla

- ***Dado*** cualquier pantalla de la app
- ***Cuando*** se audita
- ***Entonces*** el naranja aparece como mucho en un elemento: la CTA primaria

### Escenario: sin naranja decorativo

- ***Dado*** la app completa
- ***Entonces*** no hay doodles, flourishes ni subrayados naranjas
- ***Y*** los iconos no-CTA no están tintados de acento

### Escenario: verde consistente para estructura

- ***Dado*** navegación, headers y estados activos
- ***Entonces*** usan verde, nunca naranja

---

### Basi Montes - 9/6/2026, 11:23:42 AM

## Spec Implementation Plan (Dev) — FRESCO-440

### Objetivo

Aplicar la regla "un acento = CTA" de DESIGN.md v2 (§"Color discipline") a todas las pantallas de app: Menú, Calendario, Biblioteca, Lista, Perfil, auth, onboarding. Landing queda fuera (FRESCO-445).

Bloqueador FRESCO-437 (contrato DESIGN.md v2) — dev-done en `dev` (commit 37bbb92). Componentes `Tag` / `Button` ya conformados en FRESCO-439.

### Naturaleza

Barrido de clases Tailwind, sin lógica. Riesgo bajo; la revisión visual es lo crítico. ~7 ficheros.

### Cambios — violaciones claras

| Fichero | Elemento | Antes | Después |
| --- | --- | --- | --- |
| `components/shopping-list/shopping-list-view.tsx:350` | dot de estado "N pendientes" | `bg-secondary` | `bg-primary` |
| `…:381-382` | chip de icono de tarjeta-sugerencia | `bg-accent-2-100` + icono `text-secondary` | sin tinte + icono `text-tertiary` |
| `…:423-424` | chip de icono de cabecera de pasillo | `bg-accent-2-100` + icono `text-secondary` | sin tinte (`border border-border`) + icono `text-tertiary` |
| `…:484` | badge "Nuevo" de artículo | `bg-secondary text-text` | hairline: `border border-border text-tertiary` |
| `components/recipes/create-recipe-form.tsx:172` | submit "Guardar receta/cambios" | `variant="action"` | `variant="default"` |
| `components/profile/nombre-form.tsx:194` | submit "Guardar" nombre | `variant="action"` | `variant="default"` |
| `components/profile/preferences-form.tsx:331` | submit "Actualizar Preferencias" | `variant="action"` | `variant="default"` |

DESIGN.md §"Buttons in the wild": el submit real de un formulario es verde `button` primario; `button-action` es solo para el momento CTA generativo ("Generar mi menú").

### Cambios — decisiones (bordeline CTAs → verde, confirmado con PO)

| Fichero | Elemento | Antes | Después | Razón |
| --- | --- | --- | --- | --- |
| `components/onboarding/identity-step.tsx:236` | "Crear cuenta" (pantalla de elección) | `variant="action"` | `variant="default"` | solo navega al form; el submit real ya es verde |
| `components/profile/manage-subscription-button.tsx:49` | "Gestionar mi suscripción" | `variant="action"` | `variant="default"` | redirect a portal Stripe, baja intención. "Empezar prueba gratis" (Free) queda como la única CTA naranja de Perfil |
| `components/shopping-list/receipt-ticket.tsx:175` | "Listo" (diálogo compra realizada) | `variant="action"` | `variant="default"` | dismiss, no acción de alta intención. Actualizar el comentario in-code que justificaba `action` |

### Cambios — corrección de contraste (FRESCO-283, obligatoria)

| Fichero | Elemento | Antes | Después |
| --- | --- | --- | --- |
| `components/ui/alert-banner.tsx:45` | icono `TriangleAlert` | `text-warning` (~2,4:1 sobre `bg-surface`) | `text-accent-2-700` (~5,6:1) |

`border-l-4 border-warning` (hairline ámbar) se mantiene — superficie de aviso de seguridad alimentaria, portadora de significado. Solo usado en `app/(app)/menu/page.tsx` + `app/(app)/calendar/page.tsx` (no landing).

### Se mantiene (documentar en el PR)

- CTAs `button-action` sancionadas: "Generar mi menú" (menu/calendar/onboarding empty-states), "Generar lista de la compra", "Empezar prueba gratis" (upgrade Pro).
- `tag-allergen` (tinte ámbar) — excepción explícita del contrato.
- pill "hoy" del calendario (`calendar-grid.tsx:452`) — spot sancionado.
- `card-insight` (accent-100/800 — verde, no naranja).
- medidor de fuerza de contraseña (`password-input.tsx`) — semántica semáforo (débil/media/fuerte), portadora de significado como allergen, no variedad decorativa. La etiqueta ya usa el token FRESCO-283.
- botones `variant="secondary"` (outline, borde — no naranja).

### AC → evidencia

| Escenario AC | covered_by | evidencia |
| --- | --- | --- |
| Un solo naranja por pantalla | manual | validación live-UI por pantalla (screenshots en el PR) |
| Sin naranja decorativo | manual | grep post-cambio + barrido visual |
| Verde consistente para estructura | manual | validación live-UI |

Sin AC Gherkin en `regression.feature` → sin automatización nueva (Gotcha 16 N/A). Barrido visual es la verificación.

### Verificación

- `bun run lint:check`, `bun run build` / types, `bun run test` (cap=3 paralelo).
- Live-UI: dev server, login con `.env`, recorrer las 7 áreas — confirmar 0 naranja decorativo, CTAs intactas.
- `bun run test:e2e` no debería verse afectado (sin cambios de data-testid ni de copy).

### Estimación

***3 puntos.*** Barrido mecánico multi-fichero + pasada de validación visual en 7 áreas. Sin riesgo arquitectónico.

## Review Workload Forecast

Estimated: ~35 additions + ~30 deletions = ~65 total lines
400-line budget risk: Low
Chain strategy: stacked-to-main (single PR a `dev`)
Decision needed before apply: No

---


_Synced from Jira by sync-jira-issues_
