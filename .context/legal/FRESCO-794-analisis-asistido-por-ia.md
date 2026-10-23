# Fresco — Análisis jurídico asistido por IA de las diez preguntas (FRESCO-794)

> **Esto NO es un dictamen de abogado.** Lo redacta Claude, un asistente de IA: no está colegiado, no responde profesionalmente de su contenido y no ampara a Fresco ante la AEPD, un consumidor o un juzgado. Es una revisión interina, la mejor disponible sin coste mientras los ingresos no permitan una revisión de pago (`ADR-0066`). Cita normas de memoria: **cada artículo debe contrastarse con su texto vigente en el BOE** antes de actuar, igual que ya se admite en `lib/legal/entity.ts` para la LSSI art. 10.1.e. Estado a 2026-10-23; preguntas en `FRESCO-794-consulta-al-abogado.md`.
>
> **Confianza** de cada respuesta: *alta* (norma clara y estable), *media* (criterio razonable pero discutible o sujeto a doctrina cambiante), *baja* (hay que verlo con un letrado).

## Resumen

| # | Tema | Respuesta corta | Confianza |
|---|---|---|---|
| 1 | Textos provisionales y tope de responsabilidad | Quitar el tope para consumidores; mantener solo las exclusiones legales | media |
| 2 | Precargar el consentimiento de salud | Aceptable si no es una casilla premarcada nueva: mostrar fecha y vía para retirarlo | media |
| 3 | Cuentas anteriores al registro | El reconsentimiento al entrar es la vía correcta; sin aceptación, no tratar datos de salud | media |
| 4 | Alérgenos en el perfil | Suficiente tal como está | alta |
| 5 | Desistimiento por suscripción | Sí, una aceptación por contrato; revisar qué artículo se cita | baja |
| 6 | Identificación del prestador | NIF y domicilio completos antes de cobrar | media |
| 7 | Soporte duradero | El correo sirve; el problema es que llegue | media |
| 8 | Sentry | La división navegador con consentimiento y servidor sin él es defendible | media |
| 9 | Lista de espera | Plazos defendibles | media |
| 10 | Transferencias | Mantener las cláusulas contractuales tipo como respaldo del DPF | media |

## Respuestas

1. **Textos provisionales y límite de responsabilidad.** No puedo validar 666 líneas ni las 52 decisiones de la Parte G con garantías; sí señalar el punto de mayor riesgo. Para un consumidor, una cláusula que limite la responsabilidad del empresario por los daños puede ser abusiva y nula (TRLGDCU arts. 82, 83 y 86). El tope de "lo pagado en 12 meses" del borrador es el candidato más claro. *Propuesta:* eliminarlo para consumidores y dejar solo lo que la ley ya permite (sin dolo ni negligencia grave, y sin daños a la salud ni a la integridad, que el borrador ya excluye). Conviene una revisión humana de este punto cuando haya ingresos.
2. **Precargar el consentimiento de salud.** El consentimiento debe ser explícito, informado y demostrable (RGPD arts. 4.11, 7 y 9.2.a), y una casilla premarcada no vale como consentimiento nuevo (STJUE *Planet49*). Pero aquí no se obtiene consentimiento: ya existe uno, dado de forma activa y registrado con su versión. Mostrarlo como ya otorgado es informar, no consentir. *Propuesta:* si la versión de los textos no ha cambiado, mostrar "Diste tu consentimiento el <fecha>" con un modo claro de retirarlo, y no registrar una fila nueva. Evitar presentarlo como una casilla marcada por el sistema.
3. **Cuentas anteriores al registro.** Ya existe el diálogo de reconsentimiento (FRESCO-1007). Los datos de salud guardados con la fórmula antigua ("otorgado al introducirlos en tu perfil") no cumplían el requisito explícito del art. 9.2.a, y el responsable debe poder demostrar el consentimiento (art. 7.1). *Propuesta:* mantener el diálogo y, hasta que se acepte, no usar alergias ni dieta para filtrar. Con pocas cuentas hoy, el riesgo práctico es bajo.
4. **Alérgenos en el perfil.** Guardar exige tener `health_data` registrado (FRESCO-917). Es el comportamiento correcto.
5. **Desistimiento por suscripción.** El derecho de desistimiento se predica de cada contrato (TRLGDCU arts. 102 y ss.), así que quien se suscribe de nuevo contrata de nuevo: una aceptación por compra es la lectura prudente (FRESCO-1021). *Ojo:* el borrador cita el art. 103.m, que se refiere al contenido digital sin soporte material. Una suscripción de servicio continuado se encaja mejor en los arts. 103.a y 108 (pago proporcional si se pide la ejecución inmediata y luego se desiste). Hay que verificar qué artículo corresponde y que el texto de la casilla lo recoja. Esta es la respuesta con menos confianza.
6. **Identificación del prestador.** Cobrar de forma recurrente es actividad económica: el alta como autónomo es necesaria (aparte de lo jurídico, por Hacienda). La LSSI art. 10.1 pide nombre, domicilio, correo y NIF; el TRLGDCU art. 97 pide identidad y dirección completa antes de contratar. Un domicilio solo con localidad y sin NIF no basta **para cobrar**. *Propuesta:* no activar Stripe live hasta el alta y publicar NIF y dirección (puede ser una dirección profesional o un domicilio de empresa, si no se quiere publicar la particular). Hoy, sin cobros, la omisión es un riesgo menor y asumido por el fundador.
7. **Soporte duradero (art. 98.7).** Un correo es soporte duradero. Lo que exige la ley es que llegue al consumidor; que salga de un dominio propio no es un requisito jurídico. El bloqueo es técnico: `onboarding@resend.dev` solo entrega a la cuenta del propietario de Resend. Mientras no haya dominio, la confirmación por Gmail SMTP o mostrarla y guardarla en la app son vías válidas (la propuesta gratuita de FRESCO-1005).
8. **Sentry.** La LSSI art. 22.2 exige consentimiento para el acceso a información del equipo salvo que sea estrictamente necesario; la telemetría de errores del navegador no lo es. Cargarla solo tras aceptar cookies (ADR-0065) es lo prudente. En el servidor es tratamiento por interés legítimo (RGPD art. 6.1.f) siempre que se informe, y la política ya lo dice. Es defendible.
9. **Lista de espera.** Base en el consentimiento (art. 6.1.a) con doble confirmación; la LSSI art. 21 exige consentimiento previo para comunicaciones comerciales. Borrar a los 7 días lo no confirmado y conservar como máximo 12 meses lo confirmado es proporcionado.
10. **Transferencias.** El Marco de Privacidad de Datos UE-EEUU (decisión de adecuación de 2023) cubre a los proveedores certificados, pero ha sido objeto de recursos. Mantener las cláusulas contractuales tipo declaradas como respaldo, y comprobar cada trimestre que cada proveedor sigue certificado. No añadiría más.

## Cambios de código y texto que salen de esto

- Eliminar el tope de responsabilidad para consumidores y subir `LEGAL_TEXTS_VERSION` (respuesta 1).
- Revisar la cita del desistimiento y el texto de la casilla de `withdrawal_waiver` (respuesta 5, FRESCO-1021).
- Precarga de FRESCO-856 como "ya consentido el <fecha>" y no como casilla premarcada (respuesta 2).
- Ninguno de estos se aplica sin que el fundador acepte `ADR-0066`.
