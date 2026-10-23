# Fresco — Consulta concreta al abogado (FRESCO-794, FRESCO-434)

> Estado a 2026-10-23. Complementa `FRESCO-434-brief-abogado.md` (cuyo §4 y §5 quedaron desfasados: lo que allí figura como "sin implementar" ya está hecho) y el borrador `FRESCO-365-borrador-textos-legales.md`. Aquí solo van las **decisiones que el código no puede tomar**: cada una bloquea una tarjeta de Jira o la puerta de cobro (FRESCO-911). Fresco **no cobra a usuarios reales**: Stripe sigue en modo prueba.

## Qué ya está hecho en la aplicación (no hace falta pedirlo de nuevo)

Todo con textos **provisionales** (`LEGAL_TEXTS_VERSION = 'provisional-2026-10-19'`, en `lib/legal/consent.ts`). Cuando el abogado cambie una frase, es una edición de copy más una subida de versión.

| Pieza | Dónde |
|---|---|
| Registro de consentimientos, solo se añade, con versión y fecha (ADR-0040) | tabla `user_consents`, `POST /api/consents` |
| Casilla de 14 años o más y aceptación de Términos y Privacidad, no premarcadas, en alta y onboarding (invitado y cuenta) | `components/onboarding/`, `app/signup/` |
| Consentimiento explícito de datos de salud (art. 9.2.a RGPD), que nombra la creencia religiosa si se elige dieta halal | `lib/legal/consent.ts` (`health_data`) |
| Resumen precontractual y casilla de ejecución inmediata (art. 103.m TRLGDCU) antes de Stripe | `components/profile/upgrade-to-pro-button.tsx` (`withdrawal_waiver`) |
| Lista de espera con aviso en la política, doble confirmación y límite | `app/api/waitlist/` |
| Limpieza de invitados a los 3 días, con borrado en PostHog encolado y reintentado | migración `20261019170000` |
| Campo `sexo` retirado | migración `20261019160000` |
| Sentry del navegador solo tras aceptar cookies; declarado en la política y en la tabla de cookies | ADR-0065, `components/legal/legal-content-data.ts` |
| Precios de Stripe con IVA incluido (`tax_behavior=inclusive`) | `docs/workflows/stripe-settings-reading.md` |
| Correo de confirmación de la suscripción, con reintento si el envío falla | `lib/billing/confirmation-email.ts` |

## Preguntas que requieren criterio letrado

Cada pregunta indica la tarjeta que desbloquea y lo que se hará según la respuesta.

1. **Validación de los textos provisionales** (FRESCO-794, FRESCO-911). ¿Valida o corrige los Términos, la Política de Privacidad, la Política de Cookies y el Aviso Legal vigentes? Incluye las 52 decisiones de la Parte G del borrador, y en especial la cuantía del límite de responsabilidad (decisión #27).
2. **Consentimiento de salud ya dado** (FRESCO-856). Quien vuelve a entrar con alergias y dieta guardadas tiene que marcar de nuevo la casilla del artículo 9. ¿Vale un consentimiento ya registrado, de la versión vigente de los textos, para precargarla? Se haría solo cuando la versión no ha cambiado y sin registrar un consentimiento nuevo por precargar.
3. **Usuarios existentes sin registro de consentimiento** (FRESCO-794). Las cuentas anteriores al registro no tienen filas en `user_consents`. ¿Hay que pedirles los consentimientos de forma retroactiva, o basta con la aceptación en el momento del alta?
4. **Edición de alérgenos en el perfil** (FRESCO-794). Hoy se pueden cambiar alérgenos en `/profile` sin pasar por la casilla del artículo 9. ¿Debe exigirse allí también?
5. **Desistimiento en cada suscripción** (FRESCO-1021). El registro guarda una sola fila de `withdrawal_waiver` por usuario y versión, de modo que quien se suscribe de nuevo meses después pasa la comprobación con la aceptación antigua. ¿La petición de ejecución inmediata debe darse en cada contrato? Si sí, se registrará una fila por compra y el checkout exigirá una reciente.
6. **Identificación del prestador** (FRESCO-883, FRESCO-911). El texto actual da nombre y localidad (Utrera, Sevilla), sin NIF ni domicilio completo, por decisión del fundador mientras no haya alta de autónomo. El artículo 97 del TRLGDCU y el artículo 10 de la LSSI piden más datos. ¿Qué es lo mínimo exigible **antes de cobrar**, y se puede publicar el domicilio solo con localidad?
7. **Soporte duradero** (artículo 98.7). El correo de confirmación sale hoy de `onboarding@resend.dev` y el de Auth por Gmail SMTP, sin dominio propio. ¿Es suficiente como soporte duradero mientras no haya dominio, o es condición previa a cobrar? (FRESCO-988, FRESCO-1005.)
8. **Sentry y base legal** (ADR-0065). El SDK del navegador se carga solo con consentimiento de cookies; el de servidor registra fallos del servicio. ¿Es correcta esa división y la forma de declararla?
9. **Lista de espera** (FRESCO-1008). Se conserva 7 días sin confirmar y hasta 12 meses una vez confirmado, con base en el consentimiento (art. 6.1.a). ¿Son plazos defendibles?
10. **Transferencias internacionales.** Stripe, Sentry, Vercel, Resend, Google, Cloudflare y la mensajería push están declarados con Data Privacy Framework o cláusulas contractuales tipo. ¿Hay que añadir algo?

## Cómo se usará la respuesta

- Cada texto que cambie: edición de copy y subida de `LEGAL_TEXTS_VERSION`, sin tocar la lógica.
- Respuestas 3, 4 y 5: pequeñas tarjetas de código ya previstas, sin rediseño.
- Con el informe firmado adjunto en FRESCO-911 y la decisión sobre la identificación (6) se cierra la puerta legal de cobro. Las puertas de dominio, Vercel Pro, Supabase Pro y alta de autónomo siguen siendo aparte.
