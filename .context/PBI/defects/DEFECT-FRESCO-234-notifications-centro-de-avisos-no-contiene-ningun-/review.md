# Review — FRESCO-234

## Adjudicación de findings (code-review high, adversarial)

| # | Finding | Veredicto | Razón |
|---|---|---|---|
| 1 | Gate `plan === 'pro' && Boolean(paymentFailedAt)` duplicado en 3 sitios (`getHasUnseenNotifications`, `/notifications`, `/profile`) | **Legítimo — corregido** | Riesgo real de drift entre badge/notice/card si la regla cambia. Extraído a `isPaymentFailedAlertActive()` en `lib/api/user-profile.ts`, reusado en los 3 sitios. |
| 2 | `PaymentFailedNotice` importa `ManageSubscriptionButton` directo de `components/profile/` en vez de promoverlo a `shared/` | **Falso positivo — sin cambio** | El propio reviewer señaló que ya hay precedente idéntico en el repo (`FavoriteRecipeCard` importado cross-feature sin vivir en `shared/`). Consistente con el patrón existente, no una violación nueva. |
| 3 | Comentario "The four reads below" en `/menu` quedó desactualizado (ahora son 7) | **Legítimo — corregido** | Comentario trivial pero engañoso para el próximo lector. Reescrito sin el número. |

## Spec Compliance Matrix

| Escenario (alcance acordado) | covered_by | evidencia | status |
|---|---|---|---|
| Aviso de pago fallido visible en `/notifications` para cuenta Pro con pago fallido | `manual:pending` | No se pudo reproducir un `payment_failed_at` real en vivo dentro de esta sesión — ver Live-UI gap abajo | `manual` (parcial, ver nota) |
| Badge visible en `/menu` cuando hay avisos pendientes | `manual:pending` | Misma limitación que arriba (mismo dato subyacente) | `manual` (parcial, ver nota) |
| Badge ausente en `/menu` cuando no hay nada pendiente | `manual:verified` | Verificado en vivo contra dev server local con cuenta `PRO_TEST` (estado real en DB: `aviso_bienvenida_visto=true`, `aviso_rutas_descartado=true`, `payment_failed_at=null`) — badge ausente, coincide | `covered` |
| `/notifications` sin notice de pago fallido cuando no aplica | `manual:verified` | Verificado en vivo, mismo pase — página renderiza sin errores de consola, sin sección de aviso | `covered` |

## Live-UI gap — caso "hay aviso" no reproducido en vivo

El caso positivo (badge + notice visibles con `payment_failed_at` seteado) **no se pudo verificar en vivo** dentro de esta sesión:

1. `user_profiles.plan`/`payment_failed_at` están protegidos por un trigger DB (`prevent_client_subscription_writes`, ADR-0007) que solo permite escritura vía `auth.role() = 'service_role'` — es decir, únicamente el webhook real de Stripe. No se intentó bypassear.
2. La cuenta `PRO_TEST_USER` tiene `plan='pro'` seteado manualmente (sin `stripe_customer_id`), así que no hay una suscripción Stripe real detrás para forzar un decline.
3. Se ubicó una cuenta con suscripción Stripe real y activa (`qa-pre-verify-1785535816@fresco.qa`, de la verificación de EPIC-FRESCO-227), pero forzar un decline real ahí requería manipular el customer/subscription vía Stripe API — el clasificador de seguridad de Claude Code bloqueó la llamada de lectura a la suscripción antes de llegar a escribir nada. Se decidió junto al usuario cortar ahí antes de insistir con workarounds.

**Ningún dato se modificó** — ni en Supabase (el UPDATE fue rechazado por el trigger) ni en Stripe (solo hubo lecturas, y la última fue bloqueada antes de ejecutarse).

**Por qué se acepta igual**: `PaymentFailedNotice` y el nuevo `getHasUnseenNotifications` consumen exactamente el mismo dato (`getPaymentFailedAt`) y ahora la misma función de gate (`isPaymentFailedAlertActive`) que `/profile`'s card — que sí fue verificada en vivo con un decline real de Stripe durante la sesión de cierre de EPIC-FRESCO-227 (tarjeta de test `4000000000000341`). El riesgo residual es bajo: mismo dato, misma lógica de gate, mismo patrón de componente que `RecommendedRecipesNotice` (ya en producción). Queda como seguimiento natural verificarlo en vivo la próxima vez que `payment_failed_at` esté genuinamente seteado en cualquier cuenta de QA (p. ej. durante una futura verificación de dunning).
