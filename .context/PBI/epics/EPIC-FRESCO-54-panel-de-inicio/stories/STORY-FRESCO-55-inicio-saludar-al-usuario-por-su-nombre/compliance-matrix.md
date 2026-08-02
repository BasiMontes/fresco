# Spec Compliance Matrix — FRESCO-55

| AC scenario (Gherkin) | covered_by | evidence | status |
|---|---|---|---|
| Nombre cargado → Laura ve el saludo con su nombre real | manual:live-ui-validation | Stage 2 live-UI pass (Playwright, guest/anonymous session): set nombre="Laura" in `/profile`, `/menu` rendered "¡Hola, Laura!" | covered |
| Nombre no cargado todavía → saludo genérico, sin blanco ni error | manual:live-ui-validation + test:lib/api/user-profile.test.ts | Live pass: fresh guest session showed "¡Hola!" (never blank/error) on `/menu`; unit tests cover `getUserNombre` returning `null` on missing/empty row | covered |
| Botones de favoritos/notificaciones son solo visuales | manual:live-ui-validation | Live pass: clicked both icon buttons, no navigation, no console error/warning introduced; `app/(app)/menu/page.tsx` confirms no `onClick` wired on either button | covered |

No `uncovered` rows — merge gate passes.

**Review findings adjudicated** (independent `review-readability` pass, `4ed9c72..35b2469`): 2 WARNING + 1 SUGGESTION, all 3 legitimate, all 3 fixed in commits `6030a62`, `7409aeb`, `2195f75`. No false positives.
