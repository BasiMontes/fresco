# Comments for FRESCO-430

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-430)

---

### Basi Montes - 9/3/2026, 11:15:08 PM

## Acceptance Criteria (Gherkin)

```gherkin
Escenario: el aviso legal identifica al titular
  Cuando el usuario abre los Términos o el Aviso Legal
  Entonces ve el nombre del titular, su NIF, su domicilio y un correo de contacto
  Y no aparece ningún texto de marcador de posición ni el banner de "Borrador"

Escenario: la política de privacidad declara los encargados y las transferencias
  Cuando el usuario abre la Política de Privacidad
  Entonces ve una lista de los encargados del tratamiento que incluye Stripe, PostHog, Sentry, Vercel y el proveedor de notificaciones push
  Y ve que hay transferencias de datos a Estados Unidos y con qué mecanismo se amparan

Escenario: la política describe bien el aprendizaje conductual
  Cuando el usuario lee cómo se usan sus datos
  Entonces la política dice que lo que marca como cocinado o descartado se registra en todos los planes
  Y que solo el plan Pro usa ese historial para generar los menús siguientes

Escenario: la política enumera todos los datos que se tratan
  Cuando el usuario lee qué datos recopila Fresco
  Entonces figuran también el presupuesto semanal, los límites de tiempo, los favoritos, las recetas propias, los identificadores de pago y los datos de analítica y de errores
```

## Scope

- Rellenar la identidad del prestador en `legal-modal.tsx` y quitar el banner de borrador.
- Reescribir la Política de Privacidad conforme a la Parte C del borrador de FRESCO-365: encargados, transferencias, bases jurídicas, catálogo completo de datos, corrección de la contradicción del aprendizaje.

## Out of Scope

- Reescritura de los Términos (responsabilidad, desistimiento) — requiere abogado.
- Banner y política de cookies (card aparte).
- RAT interno.

## Business Rules

- Ningún texto legal en producción contiene marcadores de posición ni el banner de "Borrador".
- La Política de Privacidad refleja la realidad técnica verificada (Supabase en Irlanda; Stripe/FCM en EE.UU.; Gemini retirado 2026-08-01).

---


_Synced from Jira by sync-jira-issues_
