# Fresco — Brief para revisión por abogado colegiado (FRESCO-434)

> **Preparado con antelación.** Fresco todavía no cobra a usuarios reales — este brief queda listo para el momento en que se active la revisión letrada, antes de encender Stripe en producción con clientes de verdad.

## 1. Qué se necesita del abogado

Revisión completa de **Términos y Condiciones + Política de Privacidad + Política de Cookies + Aviso Legal** de Fresco, con validez legal real (la revisión previa fue hecha por un asistente de IA en contexto académico, no tiene valor jurídico — ver §4).

## 2. Punto de partida — no empezar de cero

Ya existe un borrador de trabajo completo: **`.context/legal/FRESCO-365-borrador-textos-legales.md`** (666 líneas, español peninsular, artículos citados inline). Contiene:

- **Parte A** — Aviso Legal (LSSI art. 10)
- **Parte B** — Términos y Condiciones (17 secciones, incluye desistimiento, renovación automática, limitación de responsabilidad)
- **Parte C** — Política de Privacidad (RGPD arts. 13/14, tabla de 13 tratamientos, tabla de transferencias internacionales)
- **Parte D** — Política de Cookies
- **Parte E** — Registro de Actividades de Tratamiento (RAT, art. 30 RGPD) — plantilla
- **Parte F** — Checklist de ingeniería (16 cambios de código, ver §5)
- **Parte G** — **52 decisiones consolidadas** que el abogado y el fundador deben cerrar juntos (forma jurídica, domicilio, plazos de conservación, límite de responsabilidad, etc.)

El abogado debería trabajar directamente sobre ese documento y su Parte G, no sobre el código.

## 3. Alcance específico de este ticket (FRESCO-434)

- Revisión completa de `components/legal/legal-modal.tsx` (el componente que hoy sirve los textos legales en la app) por el abogado.
- Confirmar alta como autónomo (RETA/Hacienda) antes de facturar — hoy pendiente.
- Decidir si hace falta una política de cookies dedicada más allá de lo ya implementado (ver §4 — el banner de cookies ya existe; falta que el abogado confirme si el texto/alcance actual es suficiente).
- Decidir si hace falta domicilio completo (calle, no solo localidad) en el Aviso Legal, o si el domicilio profesional/apartado postal es aceptable (decisión explícita del fundador hoy: solo localidad, Utrera/Sevilla).

## 4. Qué ya se implementó desde el borrador (no hace falta que el abogado lo pida de nuevo)

| Ítem | Estado | Dónde |
|---|---|---|
| Entidad legal real (nombre, NIF, autónomo) sustituye el placeholder | ✅ Hecho | `components/legal/legal-modal.tsx` — `LEGAL_ENTITY` |
| Banner "Borrador — pendiente de revisión legal" | ✅ Eliminado | `legal-modal.tsx` |
| Desistimiento (14 días, art. 102-103 TRLGDCU) | ✅ Añadido | Términos, cláusula 7 |
| Aviso de renovación automática/cancelación | ✅ Añadido | Términos |
| Límite de responsabilidad con salvedad legal (dolo, negligencia grave, daños personales) | ✅ Añadido | Términos |
| Plazo de conservación post-borrado de cuenta (30 días) | ✅ Fijado | Términos |
| Cláusula de modificación de Términos (preaviso 15 días) | ✅ Añadida | Términos |
| Banner de cookies conforme + gate de PostHog (no inicializa sin consentimiento) | ✅ Implementado (FRESCO-428) | `components/legal/cookie-consent-banner.tsx`, `cookie-consent-context.tsx`, `cookie-settings-dialog.tsx` |
| Email de confirmación del contrato en soporte duradero (art. 98.7 TRLGDCU) tras contratar Pro | ✅ Implementado (FRESCO-429) | `lib/email/templates/subscription-confirmation.ts` |

## 5. Qué sigue sin implementar (checklist de ingeniería, Parte F del borrador)

Estos cambios de código se ejecutan **después** de que el abogado apruebe los textos — no antes:

- Rutas legales propias (`/aviso-legal`, `/terminos`, `/privacidad`, `/politica-de-cookies`) accesibles sin sesión, en vez de solo el modal.
- Casilla de confirmación de edad (14+), no premarcada, en alta y onboarding de invitado.
- Casilla de aceptación de Términos y Privacidad en la segunda vía de alta (onboarding) — hoy el invitado puede generar un menú sin aceptarlos.
- Consentimiento explícito de datos de salud (alergias) en el paso de dieta del onboarding (art. 9.2.a RGPD).
- Resumen precontractual + casillas de desistimiento antes de redirigir a Stripe Checkout.
- Registro de la versión de textos aceptada por cada usuario (términos, privacidad, edad, salud), con fecha.

## 6. Hallazgos de mayor riesgo aún pendientes de decisión letrada (Parte G del borrador)

Los más críticos, por orden de riesgo real:

1. **Límite de responsabilidad — cuantía** (decisión #27): el tope actual de "lo pagado en 12 meses" puede ser abusivo y nulo frente a consumidor (arts. 82/86 TRLGDCU). El borrador ya excluye daños a la salud, pero falta cerrar la cuantía con el abogado.
2. **Transferencias internacionales no declaradas** en la Política de Privacidad actual (Stripe y FCM push en EE.UU.) — la política vigente en producción no las menciona correctamente.
3. **Forma jurídica y domicilio** (decisiones #1, #4): ya resuelto de facto (autónomo, Utrera/Sevilla, solo localidad) — el abogado debe confirmar que alcanza sin domicilio completo.
4. **Verificación de edad 14+**: hoy no implementada en absoluto (ver §5) pese a que el Aviso Legal ya declara la restricción.
5. **Correo de contacto en Gmail** (`hola.frescoapp@gmail.com`) en vez de dominio propio — recomendado por el borrador, no bloqueante.

## 7. Bloqueadores conocidos, no de este ticket

- **Dominio de correo propio**: varios ítems (email transaccional de soporte duradero, correo de contacto oficial) recomiendan salir de Gmail. Ver memoria del proyecto — Resend SMTP bloqueado hasta tener dominio propio.

---

_Brief preparado para acompañar el envío del borrador `.context/legal/FRESCO-365-borrador-textos-legales.md` a un abogado colegiado. No sustituye ni resume legalmente el documento — es un mapa de navegación sobre él._
