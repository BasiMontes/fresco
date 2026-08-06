# Code Review — FRESCO-82 (adjudicación)

Reviewer: agente adversarial independiente (fresh context). Adjudicación: orchestrator, contra diff real `ae74551..640d07b`.

| # | finding | severity | verdict | reason | action |
|---|---|---|---|---|---|
| 1 | `components/layout/sidebar-account.tsx:78,87` — `data-testid="logout_button"`/`logout_error_message` duplicado con `components/profile/danger-zone.tsx:53,61`, ambos montados a la vez en `/profile` | CRITICAL | legitimate | Confirmado con grep: mismo testid literal en dos nodos DOM simultáneos en `/profile` — rompe `getByTestId` en modo strict | fix: renombrar testids del footer (`sidebar_logout_button` / `sidebar_logout_error_message`) |
| 2 | `app/(app)/layout.tsx:16-23` — sin sesión, `SidebarAccount` igual se monta ("Sin nombre" + botón logout activo) | MAJOR | legitimate (alcance acotado) | Confirmado leyendo el archivo: `user` puede ser `null`, `AppShell` se renderiza igual. Viola la regla de negocio propia de la historia ("solo se muestra con sesión activa"). El guard global de rutas `(app)/*` (proxy.ts) es un gap preexistente y más grande, fuera de esta historia — pero ocultar el componente cuando no hay usuario es un fix acotado a los archivos ya tocados aquí | fix: no renderizar `SidebarAccount` si `user` es `null`, sin tocar `proxy.ts` |
| 3 | `app/(app)/layout.tsx` + `app/(app)/profile/page.tsx` — fetch de usuario duplicado en `/profile`, sin `React.cache` | MEDIUM | legitimate | Contradice la justificación de performance del propio plan | fix: envolver en `React.cache()` |
| 4 | `sidebar.tsx` / `app-shell.tsx` / `sidebar-account.tsx` — tipo `{nombre, email}` repetido 3 veces | MEDIUM | legitimate | DRY real, cambio futuro de forma requeriría editar 3 sitios | fix: extraer tipo compartido |
| 5 | `sidebar-account.tsx:71-80` — sin `aria-busy`/feedback visual en `isLoggingOut` (danger-zone.tsx sí lo tiene) | NIT | legitimate | Paridad con el patrón que dice replicar | fix: `aria-busy` durante logout |
| 6 | `console.error` en vez de logger | NIT | false-positive (no-op) | Convención ya establecida en todo el repo (`danger-zone.tsx`, `/profile/page.tsx`), no hay `logger` util en `lib/`, no introducido por esta historia | dismissed — agregar logger util es scope creep de otra historia |

**Decisión:** CHANGES REQUESTED (findings 1-5) → loop a Stage 2 vía `fix-issues.md`. Finding 6 dismissed sin cambio.
