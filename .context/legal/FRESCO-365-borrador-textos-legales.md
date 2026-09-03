# Fresco — Borrador completo de textos legales

> **FRESCO-365 (A4-B3) — Revisión legal real del borrador de términos y privacidad + entidad legal.**
>
> **AVISO IMPORTANTE:** Este documento es un **borrador para revisión de abogado**. **No constituye asesoramiento jurídico.** Ha sido redactado como un jurista tecnológico español redactaría una primera versión, a partir del análisis técnico del producto (mapa de datos, mapa de API, ADRs, modelo de negocio y código en producción), pero **debe ser revisado, corregido y validado por un abogado colegiado antes de publicarse o de cobrar a ningún usuario**.
>
> Cada punto que requiere una decisión real de negocio o jurídica se ha dejado como marcador explícito **`【DECISIÓN: …】`** y **nunca se ha inventado** un dato (nombre, NIF, domicilio, plazo de conservación, política de reembolso, etc.). Los puntos que solo requieren una comprobación fáctica se marcan como **`【VERIFICAR: …】`**.
>
> Todos los marcadores `【DECISIÓN】` están consolidados en la **Parte G**.
>
> **Idioma:** español peninsular neutro. **Fecha del borrador:** 2026-09-03. **Autor del borrador:** flujo asistido por IA sobre el repositorio `fresco-app` (rama `dev`). **Estado:** sin revisión letrada.
>
> **Normativa de referencia** (España / UE):
> - Reglamento (UE) 2016/679 — **RGPD**.
> - Ley Orgánica 3/2018, de Protección de Datos Personales y garantía de los derechos digitales — **LOPDGDD**.
> - Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico — **LSSI-CE**.
> - Real Decreto Legislativo 1/2007, texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios — **TRLGDCU**.
> - Directiva (UE) 2019/2161 — **Directiva Ómnibus** (transpuesta por RDL 7/2021 y Ley 4/2022).
> - Directiva (UE) 2019/770 sobre contratos de suministro de contenidos y servicios digitales (transpuesta en el TRLGDCU, arts. 115 bis y ss.).
> - Guía de la AEPD sobre uso de cookies (versión vigente) y Directrices 03/2022 del CEPD sobre patrones engañosos.

---

## Índice

- **Parte A — Aviso Legal** (LSSI art. 10)
- **Parte B — Términos y Condiciones de Uso**
- **Parte C — Política de Privacidad** (RGPD arts. 13 y 14)
- **Parte D — Política de Cookies**
- **Parte E — Registro de Actividades de Tratamiento (RAT, RGPD art. 30)** — plantilla
- **Parte F — Checklist de implementación para ingeniería**
- **Parte G — Lista consolidada de decisiones para el fundador / abogado**

---
---

# Parte A — Aviso Legal

> **Borrador para revisión de abogado. No constituye asesoramiento jurídico.** Esta sección implementa el deber de información general del **art. 10 LSSI-CE**. Todos los campos del art. 10 se dejan como marcador etiquetado porque a día de hoy **no existe ninguna entidad legal** detrás del servicio (`components/legal/legal-modal.tsx:22`, placeholder `LEGAL_ENTITY_PLACEHOLDER` vivo en producción).

## 1. Datos identificativos del titular del sitio y del servicio (art. 10.1 LSSI-CE)

En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE), se informa de los siguientes datos:

- **Titular / prestador del servicio:** 【DECISIÓN: nombre y apellidos del autónomo, o denominación social completa de la sociedad】
- **Forma jurídica:** 【DECISIÓN: autónomo (persona física / empresario individual) o sociedad mercantil (p. ej. S.L.). Esta decisión condiciona el resto de campos de esta sección y varias cláusulas de las Partes B y C】
- **NIF / CIF:** 【DECISIÓN: NIF del autónomo o CIF de la sociedad】
- **Domicilio / dirección a efectos de notificaciones:** 【DECISIÓN: domicilio fiscal completo (calle, número, código postal, municipio, provincia, país). Si es autónomo que opera desde el domicilio particular, valorar con el abogado el uso de un domicilio profesional o de un apartado postal / dirección de coworking para no publicar el domicilio particular】
- **Datos de inscripción registral:** 【DECISIÓN: si es sociedad, datos de inscripción en el Registro Mercantil (tomo, folio, hoja, inscripción). Si es autónomo, indicar expresamente "no procede inscripción en el Registro Mercantil" o los datos del registro que corresponda】
- **Correo electrónico de contacto:** 【DECISIÓN: dirección de correo. Actualmente el producto usa `hola.frescoapp@gmail.com`, que es una cuenta de Gmail gratuita y además es la dirección desde la que Supabase Auth envía los correos de autenticación. Se recomienda disponer de un correo en dominio propio (p. ej. `legal@` en un dominio contratado) antes de publicar el Aviso Legal】
- **Teléfono de contacto:** 【DECISIÓN: teléfono, o indicar que el canal de contacto es exclusivamente el correo electrónico. La LSSI exige "cualquier otro dato que permita establecer con él una comunicación directa y efectiva"; un correo electrónico atendido es suficiente, un teléfono no es obligatorio】
- **Nombre de dominio:** 【VERIFICAR: dominio(s) desde el que se presta el servicio. A día de hoy no existe el dominio `fresco.app`; el servicio se sirve desde subdominios de Vercel (`fresco-pro.vercel.app` en producción). Se recomienda contratar un dominio propio antes de la publicación】
- **Colegio profesional, título académico y normativa aplicable a una profesión regulada:** No procede — el servicio no constituye ejercicio de una profesión regulada (no es asesoramiento dietético-nutricional ni médico; véase la Parte B, cláusula 10).
- **Códigos de conducta a los que esté adherido el prestador:** 【DECISIÓN: indicar si el prestador se adhiere a algún código de conducta (p. ej. de Confianza Online / Autocontrol) o dejar "ninguno"】

## 2. Actividad y autorizaciones

Fresco es un servicio de la sociedad de la información consistente en una aplicación web que genera menús semanales personalizados y listas de la compra. La actividad **no está sujeta a autorización administrativa previa** ni a régimen de colegiación. 【VERIFICAR con el abogado que la actividad no requiere ninguna licencia o comunicación previa adicional dada la forma jurídica elegida y el domicilio de actividad】

## 3. Propiedad intelectual e industrial

Los derechos de propiedad intelectual e industrial sobre el sitio, la aplicación, su código, su diseño, su marca y el catálogo propio de recetas corresponden al titular indicado en el apartado 1, salvo el contenido generado por los usuarios (véase la Parte B, cláusula 5). 【DECISIÓN: indicar si la denominación "Fresco" está registrada como marca ante la OEPM/EUIPO o si el registro está en trámite o no se ha solicitado】

## 4. Legislación aplicable

Este Aviso Legal se rige por la legislación española.

## 5. Contacto

Para cualquier cuestión relacionada con este Aviso Legal: 【DECISIÓN: correo de contacto — véase apartado 1】.

---
---

# Parte B — Términos y Condiciones de Uso

> **Borrador para revisión de abogado. No constituye asesoramiento jurídico.** Esta parte reescribe las 9 secciones actuales del componente `TERMS_SECTIONS` y añade las secciones ausentes que una revisión letrada exigiría primero: información precontractual al consumidor (**art. 97 TRLGDCU**), plan y precio con renovación automática (**Directiva Ómnibus**), derecho de desistimiento y su pérdida para servicios digitales (**arts. 102 a 105 TRLGDCU**, en particular **art. 103, letra m**), limitación de responsabilidad redactada para ser válida frente a consumidor (**arts. 82, 86 y 148 TRLGDCU**) y fuero del domicilio del consumidor (**art. 90.2 TRLGDCU**).

## 1. Identificación del prestador y aceptación de los Términos

**1.1.** El servicio "Fresco" (en adelante, "**Fresco**" o "**el Servicio**") es prestado por 【DECISIÓN: titular — véase Parte A, apartado 1】, con NIF/CIF 【DECISIÓN】 y domicilio en 【DECISIÓN】 (en adelante, "**el Prestador**", "**nosotros**").

**1.2.** Estos Términos y Condiciones de Uso (en adelante, "**los Términos**") regulan el acceso y uso del Servicio. Son de aplicación tanto al uso mediante cuenta registrada como al uso en **modo invitado** (sesión anónima sin registro; véase la cláusula 4.4).

**1.3.** El uso del Servicio, incluida la generación de un primer menú en modo invitado, implica la aceptación plena y sin reservas de estos Términos, de la **Política de Privacidad** (Parte C) y de la **Política de Cookies** (Parte D) en su versión vigente en cada momento. Si no está de acuerdo con alguno de ellos, no debe utilizar el Servicio.

**1.4.** Estos Términos se complementan con el **Aviso Legal** (Parte A). En caso de contradicción entre documentos, prevalecerá, para las cuestiones de protección de datos, la Política de Privacidad.

**1.5.** 【DECISIÓN: fecha de entrada en vigor de esta versión de los Términos y sistema de versionado (p. ej. "Versión 2.0, en vigor desde DD/MM/AAAA")】.

## 2. Objeto y descripción del Servicio

**2.1.** Fresco es una aplicación web que, a partir de la información que el usuario declara sobre su dieta, sus alergias, los ingredientes que no desea consumir, sus cocinas preferidas, el tamaño de su hogar y otras preferencias de planificación:

- (a) genera un **menú semanal** de hasta 21 comidas (7 días × desayuno, comida y cena);
- (b) genera, a partir de ese menú y bajo petición, una **lista de la compra** organizada por pasillos de supermercado, con una estimación orientativa de coste; y
- (c) en el **Plan Pro / Family** (véase la cláusula 6), ajusta los menús de semanas posteriores en función de las recetas que el usuario ha marcado como "cocinada" o "descartada".

**2.2.** La selección de recetas para cada franja del menú y la clasificación de la lista de la compra se realizan mediante **algoritmos deterministas ejecutados en los servidores del Prestador**. El Servicio **no utiliza ningún modelo de lenguaje ni servicio de inteligencia artificial de terceros** en el flujo de generación (decisión registrada en el ADR-0005). En la cláusula 10 se describen las decisiones automatizadas a efectos del art. 22 RGPD.

**2.3.** La estimación de coste de la lista de la compra es **orientativa**, se calcula con precios de referencia internos y **no refleja precios reales de ningún establecimiento**. Fresco no es un comparador de precios ni tiene integración con supermercados.

**2.4.** El catálogo de recetas es generado y revisado por el Prestador. Fresco **no es un recetario, ni un gestor de despensa o inventario, ni una herramienta de control de caducidades**.

**2.5.** El Prestador podrá modificar, ampliar o suprimir funcionalidades del Servicio conforme a la cláusula 12.

## 3. Requisitos de acceso: mayoría de edad mínima y capacidad

**3.1.** El Servicio se dirige exclusivamente a personas físicas **mayores de 14 años**. Esta edad se corresponde con la edad mínima para prestar válidamente el consentimiento en materia de tratamiento de datos personales conforme al **art. 7 LOPDGDD**.

**3.2.** Para registrarse o usar el Servicio en modo invitado, el usuario deberá **confirmar expresamente, mediante una casilla no premarcada**, que tiene **14 años o más**. La casilla mostrará un texto equivalente a:

> ☐ *Confirmo que tengo 14 años o más.*

**3.3.** Los menores de 14 años **no pueden utilizar el Servicio**. Si el Prestador tuviera conocimiento de que un usuario es menor de 14 años, suspenderá la cuenta y suprimirá los datos asociados sin dilación indebida. 【DECISIÓN: definir el procedimiento de actuación ante un caso detectado y el canal por el que un padre, madre o tutor puede comunicarlo】.

**3.4.** 【DECISIÓN: valorar con el abogado si, además de la casilla de confirmación de edad, se quiere exigir alguna verificación adicional. La AEPD viene reforzando las exigencias de verificación de edad; para un servicio de bajo riesgo como este, la doctrina mayoritaria admite la autodeclaración mediante casilla, pero conviene dejar constancia de la decisión】.

**3.5.** El usuario que actúe en nombre de su hogar declara que cuenta con la información necesaria sobre alergias y restricciones de las personas para las que planifica comidas, y que es el único responsable de introducir dicha información correctamente.

## 4. Cuentas de usuario y modo invitado

**4.1.** El registro requiere una dirección de correo electrónico válida y una contraseña. La contraseña debe cumplir la política de seguridad vigente (longitud mínima de 10 caracteres y comprobación contra listas públicas de contraseñas filtradas).

**4.2.** El usuario es responsable de la custodia de sus credenciales y de toda actividad realizada desde su cuenta. Debe comunicar al Prestador, sin demora, cualquier uso no autorizado.

**4.3.** El usuario se compromete a facilitar información veraz y a mantenerla actualizada, en particular la relativa a alergias y restricciones dietéticas, de la que depende la seguridad alimentaria de los menús (véase la cláusula 10).

**4.4.** **Modo invitado.** El usuario puede generar un primer menú sin registrarse, mediante una sesión anónima. En ese caso:

- (a) la sesión anónima **es su única vía de acceso a los datos y menús generados**: si cierra sesión, borra los datos del navegador o deja de usar el Servicio, **perderá de forma irreversible** el menú y el perfil creados;
- (b) los datos asociados a una sesión de invitado que no se convierta en cuenta registrada se **eliminan automáticamente a los 3 días** (véase la Política de Privacidad, Parte C);
- (c) el usuario invitado puede convertir su sesión en una cuenta permanente conservando sus datos; si el correo elegido ya pertenece a otra cuenta, se aplica el procedimiento de reasignación descrito en la Política de Privacidad.

**4.5.** Cada usuario debe tener una única cuenta. El Prestador podrá suspender cuentas duplicadas o creadas de forma fraudulenta.

## 5. Contenido del usuario (recetas propias y favoritos)

**5.1.** El usuario puede crear y guardar **recetas propias** (nombre, ingredientes y pasos) en su biblioteca personal, así como marcar recetas del catálogo como favoritas.

**5.2.** **Titularidad.** Las recetas propias siguen siendo **propiedad del usuario**. El usuario conserva todos los derechos sobre ellas.

**5.3.** **Licencia.** Al crear una receta propia, el usuario concede al Prestador una **licencia limitada, no exclusiva, gratuita, revocable y circunscrita a la prestación del Servicio**, con la única finalidad de **almacenar dicha receta y mostrársela al propio usuario** dentro de su cuenta. El Prestador **no** utiliza las recetas propias para generar menús de otros usuarios, **no** las hace públicas, **no** las cede a terceros y **no** las explota comercialmente. La licencia se extingue cuando el usuario elimina la receta o su cuenta.

**5.4.** **Responsabilidad sobre el contenido.** El usuario garantiza que las recetas propias que introduce no infringen derechos de terceros ni contienen contenido ilícito. Las recetas propias **no se someten a revisión de seguridad alimentaria** por parte del Prestador y **no se incorporan al motor de generación de menús**; el usuario es el único responsable de su idoneidad y seguridad.

**5.5.** El Prestador podrá retirar contenido de usuario manifiestamente ilícito del que tenga conocimiento efectivo, conforme al **Reglamento (UE) 2022/2065 (Reglamento de Servicios Digitales)** en lo que resulte aplicable a un prestador de este tamaño y a la LSSI-CE. 【DECISIÓN: valorar con el abogado el alcance de las obligaciones DSA aplicables; para un servicio sin alojamiento de contenido público de terceros, las obligaciones son mínimas, pero conviene documentar la valoración】.

## 6. Planes, precio, prueba gratuita y renovación automática

**6.1. Planes disponibles.**

| Plan | Precio | Incluye |
|---|---|---|
| **Free** | 0 € | Un menú semanal y su lista de la compra. Cada semana se genera desde cero, sin memoria de semanas anteriores. |
| **Pro** | **4,99 €/mes** 【DECISIÓN: IVA】 | Todo lo del Plan Free y, además, la personalización por aprendizaje: el Servicio evita repetir recetas descartadas, prioriza las cocinadas y ajusta cantidades. |
| **Family** 【VERIFICAR: si el Plan Family está activo comercialmente o solo existe a nivel de datos】 | 【DECISIÓN: precio】 | 【DECISIÓN: contenido del Plan Family】 |

**6.2. Precio e impuestos.** El precio del Plan Pro es de **4,99 € al mes**. 【DECISIÓN: indicar expresamente si el precio es "IVA incluido" o "más IVA". Para consumidores, el art. 20.1 TRLGDCU y el art. 60.2.c exigen mostrar el **precio total con impuestos incluidos**; si el precio de 4,99 € es final para el consumidor, debe declararse así】. El Prestador no cobra gastos adicionales por el uso del Servicio.

**6.3. Prueba gratuita de 7 días sin tarjeta.** El Plan Pro incluye un periodo de prueba gratuito de **7 días naturales**, durante el cual **no se solicita ningún medio de pago**. Durante la prueba, el usuario disfruta de todas las funcionalidades del Plan Pro sin coste.

**6.4. Conversión de la prueba y primer cobro.** Al finalizar el periodo de prueba:

- (a) si el usuario **no ha facilitado un medio de pago**, la suscripción **no se activa** y la cuenta pasa automáticamente al **Plan Free**, sin cargo alguno;
- (b) si el usuario **ha facilitado un medio de pago** durante la prueba, la suscripción de Pago se activa automáticamente al término del día 7 y se realiza el **primer cobro de 4,99 €** 【DECISIÓN: IVA】.

**6.5. Renovación automática.** La suscripción al Plan Pro **se renueva automáticamente por periodos sucesivos de un (1) mes** al precio vigente, **hasta que el usuario la cancele**. Cada renovación genera un cargo mensual de 4,99 € 【DECISIÓN: IVA】 en el medio de pago facilitado.

**6.6. Aviso previo a la renovación.** 【DECISIÓN: decidir si se enviará un recordatorio por correo antes de cada renovación o antes de la primera renovación tras la prueba. No es estrictamente obligatorio para una suscripción mensual, pero es una buena práctica exigida por la tendencia regulatoria (Directiva Ómnibus, futura normativa de "cancelación fácil") y reduce el riesgo de reclamaciones y devoluciones. Recomendación del borrador: enviar al menos un aviso al convertir la prueba en suscripción de pago】.

**6.7. Cancelación.** El usuario puede cancelar la renovación **en cualquier momento y sin penalización** desde el **portal de gestión de la suscripción** accesible en su perfil (gestionado por el proveedor de pagos, Stripe). Efectos de la cancelación:

- (a) la cancelación **surte efecto al final del periodo mensual ya pagado**; el usuario conserva el acceso al Plan Pro hasta esa fecha;
- (b) a partir de esa fecha, la cuenta pasa al **Plan Free** y **no se realizan nuevos cobros**;
- (c) 【DECISIÓN: política de reembolso del periodo en curso. Por defecto, no hay reembolso del periodo mensual ya iniciado, salvo lo previsto para el derecho de desistimiento (cláusula 7) o salvo error de facturación. Confirmar con el abogado la compatibilidad de esta política con el art. 7 de la Directiva (UE) 2019/770 y con la doctrina de consumo sobre cláusulas abusivas】.

**6.8. Impago.** Si un cobro de renovación falla, el proveedor de pagos reintentará el cobro durante un periodo de gracia. Si el pago no se recupera, la cuenta pasará al **Plan Free**. El acceso a las funcionalidades Pro puede verse limitado durante el periodo de impago.

**6.9. Modificación del precio.** El Prestador podrá modificar el precio de los planes. Cualquier subida de precio se comunicará al usuario con una antelación mínima de **30 días** a través del correo electrónico asociado a la cuenta, y el usuario podrá cancelar la suscripción antes de que la nueva tarifa surta efecto; si no cancela, se entenderá que acepta el nuevo precio. 【DECISIÓN: confirmar el plazo de preaviso (30 días es lo habitual) y el canal】.

**6.10. Proveedor de pagos.** Los pagos se procesan a través de **Stripe** (Stripe Payments Europe, Ltd. y Stripe, Inc.). El Prestador **no almacena datos completos de tarjetas**. El tratamiento de los datos de facturación se describe en la Política de Privacidad (Parte C).

## 7. Derecho de desistimiento (servicios digitales)

> Esta cláusula implementa los **arts. 102 a 105 TRLGDCU** para un contrato de prestación de servicios digitales celebrado a distancia con un consumidor.

**7.1. Plazo.** El consumidor tiene derecho a **desistir del contrato de suscripción al Plan Pro en un plazo de 14 días naturales** sin necesidad de justificación. El plazo se computa desde el día de la celebración del contrato (activación de la suscripción de pago).

**7.2. Ejercicio.** Para ejercer el derecho de desistimiento, el consumidor debe comunicarlo antes de que expire el plazo mediante una declaración inequívoca dirigida a 【DECISIÓN: correo de contacto】, indicando su decisión de desistir. Puede utilizar el **modelo de formulario de desistimiento** que figura al final de esta cláusula, aunque su uso no es obligatorio. El consumidor también puede cancelar la suscripción desde el portal de gestión (cláusula 6.7), pero se recomienda comunicar además de forma expresa que se trata de un **desistimiento** para dejar constancia a efectos de reembolso.

**7.3. Efectos y reembolso.** Ejercido válidamente el desistimiento en plazo, el Prestador reembolsará todos los pagos recibidos por la suscripción, sin demora indebida y, en todo caso, en un plazo máximo de **14 días naturales** desde que tenga conocimiento de la decisión de desistir, utilizando el mismo medio de pago empleado por el consumidor. Ver la salvedad de la cláusula 7.4.

**7.4. Consentimiento a la ejecución inmediata y pérdida del derecho de desistimiento (art. 103, letra m, TRLGDCU).**

Dado que el Servicio de pago se presta y se disfruta de forma inmediata, en el momento de contratar el Plan Pro se solicitará al consumidor que **manifieste expresamente**, mediante casilla no premarcada, lo siguiente:

> ☐ *Solicito que la prestación del servicio comience de inmediato, antes de que finalice el plazo de 14 días de desistimiento, y reconozco que perderé mi derecho de desistimiento cuando el contrato haya sido completamente ejecutado por Fresco.*

【DECISIÓN: fijar con el abogado el alcance exacto de esta cláusula para una suscripción mensual. Opciones:
> **(a)** Interpretar que el servicio del mes en curso queda "completamente ejecutado" solo al final del mes, de modo que dentro de los 14 días el consumidor puede desistir y se le reembolsa la parte proporcional no disfrutada (importe menos la parte correspondiente a los días ya prestados, art. 105.3 TRLGDCU).
> **(b)** Tratar el servicio como de tracto sucesivo con reembolso proporcional en todo caso durante los 14 días.
> El borrador recomienda la opción (a) con reembolso proporcional, que es la más protectora y la de menor riesgo de nulidad; la redacción definitiva de 7.3 y 7.4 debe cerrarse en función de esta decisión】.

**7.5. Contenido y recetas propias.** El derecho de desistimiento **no afecta** a la titularidad de las recetas propias del usuario, que las conserva.

**7.6. Modelo de formulario de desistimiento** (art. 104 y Anexo B TRLGDCU):

> **A la atención de** 【DECISIÓN: titular / dirección postal / correo electrónico del Prestador】:
>
> Por la presente le comunico que desisto de mi contrato de suscripción al Plan Pro del servicio Fresco.
>
> - Contratado el día: __________
> - Nombre del consumidor: __________
> - Domicilio del consumidor: __________
> - Correo electrónico de la cuenta: __________
> - Fecha: __________
> - Firma del consumidor (solo si el formulario se presenta en papel): __________

## 8. Información precontractual al consumidor (art. 97 TRLGDCU)

Antes de que el consumidor quede vinculado por la suscripción de pago, y de forma clara y comprensible, se le facilitará (en la propia pantalla de contratación y confirmándose después en soporte duradero, cláusula 9):

- (a) las **características principales del Servicio** (cláusula 2);
- (b) la **identidad del Prestador**, su domicilio y su correo electrónico (Parte A);
- (c) el **precio total** con impuestos incluidos y, en su caso, todos los gastos adicionales (cláusula 6.2);
- (d) la **duración del contrato** y las **condiciones de resolución**, así como el carácter **de renovación automática mensual** (cláusulas 6.5 a 6.7);
- (e) la **existencia y condiciones del derecho de desistimiento**, y las circunstancias en que se pierde (cláusula 7);
- (f) la existencia de la garantía legal de conformidad de los contenidos y servicios digitales (arts. 115 bis y ss. TRLGDCU);
- (g) la **funcionalidad, compatibilidad e interoperabilidad** relevantes del Servicio: aplicación web accesible mediante navegador con conexión a internet; no requiere instalación; 【VERIFICAR: navegadores y versiones mínimas soportadas】;
- (h) la existencia de **decisiones automatizadas** en la generación de menús (cláusula 10 y Parte C, apartado sobre elaboración de perfiles);
- (i) los **medios de resolución extrajudicial de conflictos** a los que el Prestador está adherido, en su caso (cláusula 14).

## 9. Confirmación del contrato en soporte duradero (art. 98.7 TRLGDCU)

Tras la contratación del Plan Pro, el Prestador enviará al consumidor, **en un plazo razonable y a más tardar en el momento del primer cobro**, una **confirmación del contrato en soporte duradero** (correo electrónico) que incluirá toda la información precontractual de la cláusula 8, la confirmación del consentimiento previo a la ejecución inmediata y del conocimiento de la pérdida del derecho de desistimiento (cláusula 7.4), y una copia del modelo de formulario de desistimiento.

【DECISIÓN: el envío de este correo de confirmación está hoy **bloqueado** porque no existe un dominio de correo propio verificado con el proveedor de envío (véase la nota "Resend SMTP blocked" del proyecto). Es imprescindible resolver el envío de correo transaccional en dominio propio **antes de cobrar**, porque el art. 98.7 TRLGDCU es de cumplimiento obligatorio. Ver Parte F, punto 8】.

## 10. Naturaleza de los menús: no son consejo médico ni nutricional. Verificación de alérgenos por el usuario

**10.1.** Los menús, recetas y listas de la compra que genera Fresco son **sugerencias de planificación de comidas**. **No constituyen asesoramiento médico, dietético ni nutricional profesional**, ni sustituyen la consulta con un profesional sanitario o un dietista-nutricionista colegiado.

**10.2.** El usuario que padezca una patología, una alergia o intolerancia alimentaria grave, esté embarazada, siga un tratamiento médico o tenga necesidades nutricionales específicas **debe consultar a un profesional sanitario** antes de seguir cualquier menú.

**10.3.** **Filtrado de alérgenos.** Fresco excluye de forma estructural, en la fase de generación, las recetas de su catálogo cuyos alérgenos declarados coincidan con los que el usuario haya indicado en su perfil, así como las recetas que incumplan las restricciones dietéticas declaradas. Este filtrado:

- (a) depende **por completo de la exactitud y actualización de la información que el usuario introduce** en su perfil;
- (b) opera únicamente sobre el **catálogo propio de Fresco** y sobre los **alérgenos de declaración obligatoria** conforme al Reglamento (UE) 1169/2011; **no** cubre trazas, contaminación cruzada en el hogar, ni ingredientes concretos de las **recetas propias** del usuario;
- (c) **no exime al usuario de comprobar, antes de cocinar y de comprar, que cada receta y cada producto son seguros para todas las personas de su hogar**, leyendo el etiquetado de los productos que adquiera.

**10.4.** **Decisiones automatizadas (art. 22 RGPD).** La asignación de recetas a cada franja del menú se realiza mediante un algoritmo determinista que puntúa cada receta candidata según criterios como el ajuste al tiempo disponible, la variedad de categorías, la estacionalidad, la valoración media, una penalización por recetas muy descartadas y, en el Plan Pro, un ajuste según el historial personal de la persona usuaria y la exclusión de las recetas marcadas en las 2 últimas semanas. Estas decisiones **no producen efectos jurídicos** sobre el usuario **ni le afectan significativamente de modo similar**; su único efecto es proponer un menú editable que el usuario puede modificar libremente. La información del art. 13.2.f RGPD se detalla en la Política de Privacidad.

## 11. Uso aceptable

El usuario se compromete a no:

- (a) usar el Servicio con fines ilícitos o contrarios a estos Términos;
- (b) intentar acceder a cuentas, datos o áreas del Servicio no autorizadas;
- (c) realizar ingeniería inversa, descompilar o extraer el código o el catálogo de recetas, salvo en la medida permitida imperativamente por la ley;
- (d) introducir malware o interferir en el funcionamiento del Servicio, su infraestructura o sus mecanismos de seguridad y de limitación de peticiones;
- (e) realizar un uso automatizado, masivo o abusivo del Servicio (scraping, peticiones automatizadas fuera de la interfaz);
- (f) suplantar la identidad de terceros o introducir datos de terceros sin su conocimiento, más allá de la planificación de comidas para el propio hogar.

## 12. Modificación de los Términos y del Servicio

**12.1.** El Prestador podrá modificar estos Términos por razones técnicas, legales, de seguridad o por cambios en el Servicio. Las modificaciones **sustanciales** se comunicarán al usuario registrado a través del correo electrónico de la cuenta y/o mediante un aviso destacado en la aplicación, con una antelación mínima de **30 días** a su entrada en vigor, salvo que la modificación venga impuesta por una norma de aplicación inmediata.

**12.2.** Si el usuario no está de acuerdo con la modificación, puede resolver su relación con el Servicio y, en su caso, cancelar su suscripción antes de la entrada en vigor. El uso continuado del Servicio tras la entrada en vigor implica la aceptación de los nuevos Términos.

**12.3.** Para los contratos de suministro de contenidos o servicios digitales, cualquier modificación se ajustará al **art. 119 ter TRLGDCU** (condiciones para modificar el servicio más allá de lo necesario para mantener su conformidad, y derecho del consumidor a resolver).

**12.4.** El Prestador podrá discontinuar el Servicio en su totalidad con un preaviso razonable a los usuarios registrados, ofreciendo la posibilidad de exportar los datos y, en su caso, el reembolso proporcional de la suscripción no disfrutada. 【DECISIÓN: plazo de preaviso de cierre del servicio y política de reembolso en ese escenario】.

## 13. Suspensión y terminación

**13.1.** El usuario puede dejar de usar Fresco en cualquier momento y **eliminar su cuenta** desde su perfil. La eliminación de la cuenta borra sus datos según lo descrito en la Política de Privacidad y **es irreversible**.

**13.2.** El Prestador podrá **suspender o cancelar** una cuenta, de forma motivada y, siempre que sea posible, con aviso previo, en caso de: (a) incumplimiento grave o reiterado de estos Términos; (b) uso fraudulento o que comprometa la seguridad del Servicio o de terceros; (c) requerimiento de una autoridad competente.

**13.3.** La cancelación de la cuenta por el usuario **no genera por sí sola derecho a reembolso** de la suscripción en curso, sin perjuicio del derecho de desistimiento (cláusula 7) y de la normativa de consumo aplicable.

**13.4.** Las cláusulas que por su naturaleza deban sobrevivir a la terminación (propiedad intelectual, limitación de responsabilidad, ley aplicable y fuero) permanecerán en vigor.

## 14. Ley aplicable, fuero y resolución de conflictos

**14.1. Ley aplicable.** Estos Términos se rigen por la **legislación española**. Cuando el usuario sea un consumidor residente en otro Estado de la Unión Europea, se aplicarán además las disposiciones imperativas de protección de los consumidores de su país de residencia que le resulten más favorables.

**14.2. Fuero.**

- (a) Cuando el usuario tenga la condición de **consumidor**, será competente el juzgado o tribunal correspondiente a **su lugar de residencia** (art. 90.2 TRLGDCU); ninguna cláusula de estos Términos limita este derecho.
- (b) Cuando el usuario **no** sea consumidor, las partes se someten a los juzgados y tribunales de 【DECISIÓN: ciudad del domicilio del Prestador】, con renuncia a cualquier otro fuero.

**14.3. Reclamación previa y hojas de reclamaciones.** Antes de acudir a la vía judicial, el usuario puede dirigir cualquier reclamación a 【DECISIÓN: correo de contacto】; el Prestador acusará recibo y responderá en un plazo máximo de **un mes**. 【DECISIÓN: valorar la puesta a disposición de hojas de reclamaciones conforme a la normativa autonómica de consumo aplicable al domicilio del Prestador】.

**14.4. Resolución extrajudicial.**

- (a) 【DECISIÓN: indicar si el Prestador se somete a alguna **entidad de resolución alternativa de litigios de consumo acreditada** (p. ej. una Junta Arbitral de Consumo) o a un sistema sectorial. Si no se somete a ninguno, debe indicarse expresamente: "El Prestador no está adherido a ningún sistema de resolución extrajudicial de conflictos de consumo, sin perjuicio del derecho del consumidor a acudir a la Junta Arbitral de Consumo de su comunidad autónoma o a los organismos de consumo competentes."】
- (b) El consumidor puede dirigirse a las **autoridades de consumo** de su comunidad autónoma o municipio.
- (c) **Plataforma de resolución de litigios en línea de la UE (ODR):** la plataforma europea de resolución de litigios en línea **dejó de estar operativa el 20 de julio de 2025**, por lo que **no se incluye enlace a la misma**. Cualquier plantilla legal previa que enlace `ec.europa.eu/consumers/odr` debe corregirse.

## 15. Limitación de responsabilidad

> Redactada para ser válida frente a un consumidor: **no excluye ni limita** la responsabilidad por daños a la vida, la integridad física o la salud, ni por dolo o culpa grave, ni los derechos imperativos del consumidor. **Marcado para el abogado:** el tope de "lo pagado en los últimos 12 meses" del texto actual puede ser **abusivo y nulo** frente a consumidor (arts. 82 y 86 TRLGDCU); ver 15.4 y la Parte G.

**15.1. Garantía legal.** El Prestador responde de la **falta de conformidad** del Servicio conforme a los arts. 115 bis y siguientes del TRLGDCU. El Servicio se presta con la diligencia y la calidad razonablemente exigibles a un servicio de su naturaleza.

**15.2. Responsabilidad no excluible.** Nada en estos Términos excluye ni limita la responsabilidad del Prestador por:

- (a) **muerte o daños personales, a la integridad física o a la salud**, causados por su actuación u omisión;
- (b) **dolo o culpa grave**;
- (c) los supuestos en que la ley prohíba su exclusión o limitación, incluidos los derechos imperativos que la normativa de consumo reconoce al usuario.

**15.3. Exclusiones admisibles.** Dentro de los límites de la cláusula 15.2, el Prestador **no será responsable** de:

- (a) los daños derivados de **información inexacta, incompleta o desactualizada introducida por el usuario** en su perfil (en particular, alergias y restricciones dietéticas);
- (b) los daños derivados de que el usuario **no verifique el etiquetado de los productos** que compra ni la idoneidad de cada receta para su hogar, conforme a la cláusula 10;
- (c) el contenido de las **recetas propias** del usuario y de sus resultados;
- (d) las **interrupciones, indisponibilidades o pérdidas de datos** imputables a fallos de terceros proveedores de infraestructura, a fuerza mayor o al propio usuario, siempre que el Prestador haya adoptado medidas técnicas y organizativas razonables;
- (e) el uso del Servicio **al margen de estos Términos**;
- (f) las decisiones que el usuario adopte basándose en las estimaciones **orientativas** de coste de la lista de la compra.

**15.4. Cuantía.** 【DECISIÓN — CRÍTICA:
> El texto actual limita la responsabilidad "a lo que hayas pagado por el Servicio en los últimos 12 meses". Frente a un consumidor esta limitación cuantitativa **es muy probablemente abusiva y, por tanto, nula** (art. 86.1 y 86.7 TRLGDCU: son abusivas las cláusulas que excluyan o limiten de forma inadecuada los derechos del consumidor ante el incumplimiento). Además, aplicada a un fallo del filtrado de alérgenos con consecuencias para la salud, entraría en conflicto directo con la cláusula 15.2.a.
> **Opciones a decidir con el abogado:**
> **(a)** Eliminar cualquier tope contractual frente a consumidores y remitir la cuantía a "los daños directos efectivamente probados conforme a la ley".
> **(b)** Mantener un tope **solo para usuarios que no sean consumidores**.
> **(c)** Mantener un tope general pero expresamente subordinado a la cláusula 15.2 y a los derechos imperativos del consumidor, asumiendo el riesgo de que un tribunal lo inaplique.
> El borrador recomienda la opción (a) para consumidores y, en su caso, (b) para no consumidores】.

**15.5. Fuerza mayor.** Ninguna de las partes responderá por el incumplimiento debido a causas de fuerza mayor.

## 16. Cesión

El usuario no puede ceder su posición contractual sin consentimiento del Prestador. El Prestador podrá ceder su posición contractual en caso de reestructuración, fusión o transmisión de la empresa o del Servicio, informando previamente al usuario y sin merma de sus derechos; si la cesión implicara un cambio relevante en el tratamiento de datos, se estará a lo previsto en la Política de Privacidad y el usuario podrá resolver.

## 17. Nulidad parcial

Si alguna cláusula de estos Términos fuera declarada nula o inaplicable, el resto seguirá siendo válido y la cláusula afectada se sustituirá por otra válida que respete al máximo la finalidad de la original y los derechos del consumidor.

## 18. Contacto

【DECISIÓN: correo de contacto — véase Parte A】.

---
---

# Parte C — Política de Privacidad

> **Borrador para revisión de abogado. No constituye asesoramiento jurídico.** Cumple la información exigida por los **arts. 13 (datos recabados del interesado) y 14 (datos no recabados directamente) RGPD**, y corrige tres afirmaciones **materialmente incorrectas** del texto vigente: (i) "todo en la UE (Irlanda)" — hay transferencias internacionales reales; (ii) "no compartimos datos con terceros" — hay al menos 6 encargados del tratamiento; (iii) la señal de "cocinada/descartada" se describe como exclusiva del Plan Pro — en realidad **se registra en todos los planes** (ADR-0001) y solo su **aplicación** al menú propio es Pro.

## 1. Responsable del tratamiento

- **Responsable:** 【DECISIÓN: titular — Parte A】
- **NIF/CIF:** 【DECISIÓN】
- **Domicilio:** 【DECISIÓN】
- **Correo de contacto en materia de protección de datos:** 【DECISIÓN: correo dedicado, p. ej. `privacidad@` en dominio propio】
- **Delegado de Protección de Datos (DPD):** 【DECISIÓN: sí / no. El nombramiento de DPD **no es obligatorio** para este tratamiento según el art. 37 RGPD (no hay observación sistemática a gran escala ni tratamiento a gran escala de categorías especiales en el sentido del RGPD para un servicio en fase de validación), pero conviene documentar la valoración. Si se designa, indicar su dirección de contacto (art. 13.1.b)】

## 2. Cómo obtenemos tus datos

Tratamos datos que:

- (a) **nos facilitas directamente** al registrarte, completar el onboarding (incluido el onboarding en modo invitado), crear recetas propias, marcar favoritos, marcar recetas como cocinadas o descartadas, contratar el Plan Pro o contactar con nosotros;
- (b) **se generan por tu uso del Servicio**: menús generados, listas de la compra, estado de las franjas del menú, valoraciones, avisos leídos o descartados;
- (c) **se recogen automáticamente** por motivos técnicos, de seguridad y, previo consentimiento, de analítica: dirección IP, identificadores de dispositivo/navegador, registros de acceso y de error, eventos de uso;
- (d) **recibimos de terceros**: del proveedor de pagos (Stripe), el estado de tu suscripción y los identificadores de cliente y de suscripción (art. 14 RGPD).

## 3. Categorías de datos, finalidades, bases jurídicas, conservación y destinatarios

> Los **plazos de conservación** concretos se dejan como marcador porque son una decisión que debe cerrar el abogado en función de los plazos de prescripción aplicables. Recomendaciones del borrador entre corchetes.

| # | Finalidad del tratamiento | Categorías de datos | Base jurídica (RGPD) | Plazo de conservación | Destinatarios / encargados |
|---|---|---|---|---|---|
| 1 | **Crear y gestionar tu cuenta y autenticarte** | Correo electrónico; contraseña (con hash); identificador de usuario; marca de sesión anónima/registrada; fecha de alta | **Art. 6.1.b** (ejecución del contrato / medidas precontractuales) | 【DECISIÓN: mientras la cuenta esté activa y hasta 【p. ej. 12 meses】 tras su baja para atender reclamaciones; después, supresión o anonimización】 | Supabase (alojamiento y autenticación); proveedor de correo transaccional 【DECISIÓN】 |
| 2 | **Generar tus menús semanales y tu lista de la compra** (núcleo del servicio) | Preferencias de dieta; cocinas favoritas; ingredientes no deseados; tamaño del hogar; presupuesto semanal; límites de tiempo de cocina; experiencia de cocina; objetivo; selección de comidas a planificar por día; menús generados y su semana ISO; franjas del menú y su estado; valoraciones (1–5) | **Art. 6.1.b** | 【DECISIÓN: mientras la cuenta esté activa; los menús de semanas pasadas 【p. ej. se conservan 12 meses y luego se agregan/anonimizan】】 | Supabase |
| 3 | **Tratar tus alergias y restricciones dietéticas o religiosas para excluir estructuralmente recetas no seguras o no aptas** | Alergias e intolerancias alimentarias declaradas (**dato de salud, art. 9**); restricciones dietéticas que pueden revelar convicciones (p. ej. halal, kosher) o datos de salud (p. ej. celiaquía) (**art. 9**) | **Art. 9.2.a** (consentimiento explícito), en relación con el art. 6.1.b. El consentimiento se recaba mediante casilla específica no premarcada al introducir estos datos | 【DECISIÓN: mientras la cuenta esté activa o hasta que retires el consentimiento borrando estos datos】 | Supabase. **No se comparten con Stripe, PostHog ni Sentry.** La analítica tiene desactivada la captura automática precisamente para no recoger estas etiquetas |
| 4 | **Registrar la señal conductual "cocinada / descartada" y las valoraciones para mejorar el catálogo y el producto** — se registra en **todos los planes** | Identificador de receta; estado (cocinada/descartada/sustituida); valoración; fecha. Se agrega a contadores **globales por receta** (no por usuario) en el catálogo | 【DECISIÓN: base jurídica del registro para usuarios del **Plan Free**. Opciones: **(a) art. 6.1.f** (interés legítimo en mejorar el catálogo y el producto), con juicio de ponderación documentado y derecho de oposición; **(b) art. 6.1.a** (consentimiento) con casilla. Para el **Plan Pro**, el uso de esta señal para personalizar tus menús es **art. 6.1.b** (forma parte del servicio contratado). El borrador recomienda 6.1.f para el registro y 6.1.b para la aplicación Pro】 | 【DECISIÓN: los eventos individuales 【p. ej. 24 meses】; los contadores agregados por receta, de forma indefinida al no ser datos personales una vez agregados】 | Supabase |
| 5 | **Personalización avanzada por aprendizaje (Plan Pro / Family)**: evitar recetas descartadas en las 2 últimas semanas, priorizar cocinadas, generar la tarjeta explicativa "qué hemos aprendido" | Historial personal de recetas cocinadas y descartadas; recuentos personales de interacción por receta | **Art. 6.1.b** (funcionalidad propia del plan contratado) | 【DECISIÓN: mientras mantengas el Plan Pro y 【p. ej. 24 meses】 de historial hacia atrás】 | Supabase |
| 6 | **Guardar tus recetas propias y tus favoritos** | Recetas propias (nombre, ingredientes, pasos); lista de recetas favoritas | **Art. 6.1.b** | 【DECISIÓN: mientras la cuenta esté activa o hasta que las elimines】 | Supabase |
| 7 | **Gestionar tu suscripción y procesar los pagos** | Identificador de cliente y de suscripción de Stripe; plan; fecha de expiración/renovación; marca de pago fallido; datos de pago tratados **directamente por Stripe** (Fresco no almacena el número de tarjeta) | **Art. 6.1.b** (ejecución del contrato de suscripción) y **art. 6.1.c** (obligaciones legales de facturación y fiscales) | 【DECISIÓN: datos de facturación y justificantes, **el plazo legal de conservación de documentación mercantil y fiscal** — orientativamente 6 años (art. 30 Código de Comercio) y 4 años (Ley General Tributaria); confirmar】 | **Stripe** (encargado / responsable independiente para la parte de pagos, según su DPA); asesoría contable/fiscal 【DECISIÓN: si existe】; Administración Tributaria cuando proceda |
| 8 | **Analítica de producto** (medir el uso real del servicio, embudos de conversión, retención) | Identificador de usuario (el mismo `id` de Supabase, incluidos invitados); eventos de uso (menú generado, receta marcada como cocinada, alta, inicio de sesión, inicio de suscripción); propiedades de persona: plan, condición de invitado, método de alta; IP truncada/derivada y datos de dispositivo asociados al SDK | **Art. 6.1.a** (consentimiento), gestionado desde el banner de cookies y equivalentes | 【DECISIÓN: 【p. ej. 14 meses】 a nivel de evento; configurar la retención en PostHog en consecuencia】 | **PostHog** (PostHog Inc., PostHog Cloud UE) |
| 9 | **Seguridad, prevención de abuso y registro de errores** | Dirección IP; identificadores de sesión/dispositivo; registros de acceso; contadores de limitación de peticiones (rate limiting); trazas de error y contexto técnico de la petición que las provoca | **Art. 6.1.f** (interés legítimo en la seguridad, integridad y estabilidad del Servicio), con juicio de ponderación documentado | 【DECISIÓN: registros de acceso y seguridad 【p. ej. 12 meses】; trazas de error 【p. ej. 90 días】; contadores de rate limiting se borran automáticamente a las pocas horas】 | **Vercel** (alojamiento del frontend y registros de acceso); **Sentry** (registro de errores); Supabase |
| 10 | **Enviar notificaciones web push de re-enganche semanal** (recordatorio de planificar la semana) | Suscripción push del navegador (endpoint, claves `p256dh` y `auth`); fecha de último uso | **Art. 6.1.a** (consentimiento), activado mediante el interruptor de notificaciones del perfil | 【DECISIÓN: hasta que desactives las notificaciones o hasta que el servicio de push del navegador informe de que el endpoint ya no es válido】 | Servicio de mensajería push del navegador del usuario (p. ej. Google/FCM para Chrome y Android; Mozilla; Apple), según el navegador que uses |
| 11 | **Mostrar avisos informativos en la aplicación** (Centro de Avisos: bienvenida, guía de rutas, aviso de pago fallido, recetas recomendadas) | Marcas de aviso leído/descartado; plan y estado de pago; catálogo filtrado por tu perfil de seguridad | **Art. 6.1.b** y **art. 6.1.f** (informar sobre el uso y el estado de la cuenta) | 【DECISIÓN: mientras la cuenta esté activa】 | Supabase |
| 12 | **Atender tus consultas y el ejercicio de tus derechos** | Datos de contacto; contenido de la comunicación; datos necesarios para verificar tu identidad | **Art. 6.1.c** (obligación legal de atender los derechos RGPD) y **art. 6.1.f** (gestión de consultas) | 【DECISIÓN: 【p. ej. 3 años】 desde la resolución de la solicitud, para acreditar su atención】 | Proveedor de correo 【DECISIÓN】 |
| 13 | **Modo invitado: permitir generar un menú sin registro y eliminarlo si no se convierte en cuenta** | Los mismos datos de las finalidades 2 y 3 asociados a una sesión anónima; marca de sesión anónima | **Art. 6.1.b** (medidas precontractuales a petición del interesado) y **art. 9.2.a** para las alergias | **Eliminación automática a los 3 días** de inactividad si la sesión no se convierte en cuenta registrada | Supabase |

### 3 bis. Datos que recibimos de terceros (art. 14 RGPD)

De **Stripe** recibimos: la confirmación del estado de tu suscripción (activa, en prueba, en periodo de gracia por impago, cancelada), la fecha de renovación o expiración y los identificadores de cliente y de suscripción. El origen es el proveedor de pagos; la finalidad y la base jurídica son las de la fila 7 de la tabla anterior.

## 4. Encargados del tratamiento y transferencias internacionales de datos

Para prestar el Servicio recurrimos a los siguientes proveedores, que tratan datos personales por nuestra cuenta (encargados del tratamiento) o como responsables independientes en la parte que les corresponda, siempre bajo el correspondiente contrato conforme al **art. 28 RGPD** o instrumento equivalente:

| Proveedor | Servicio prestado | Ubicación del tratamiento | ¿Transferencia internacional? | Mecanismo de garantía (art. 46 RGPD) | Cómo obtener una copia de las garantías |
|---|---|---|---|---|---|
| **Supabase, Inc.** | Base de datos, autenticación, funciones de servidor, alojamiento de los datos de la aplicación | Proyecto alojado en la **UE — Irlanda** (`eu-west-1`). La matriz está en EE. UU. y puede prestar soporte desde allí | Sí, para soporte y administración desde EE. UU. | Cláusulas Contractuales Tipo (CCT) de la UE incorporadas al DPA de Supabase; medidas adicionales | 【DECISIÓN: enlazar el DPA de Supabase y su lista de subencargados; indicar el correo para solicitar copia】 |
| **Stripe Payments Europe, Ltd.** (Irlanda) y **Stripe, Inc.** (EE. UU.) | Procesamiento de pagos y gestión de la suscripción | Irlanda y **EE. UU.** | Sí | Marco de Privacidad de Datos UE-EE. UU. (**Data Privacy Framework**, Stripe Inc. adherida) y CCT como salvaguarda | 【DECISIÓN: enlazar el DPA de Stripe】 |
| **PostHog, Inc.** (EE. UU.) | Analítica de producto | **PostHog Cloud UE** (datos alojados en la UE); acceso de soporte/ingeniería desde EE. UU. | Sí, para acceso desde EE. UU. | CCT de la UE incorporadas al DPA de PostHog | 【DECISIÓN: enlazar el DPA de PostHog】 |
| **Functional Software, Inc.** (Sentry) (EE. UU.) | Registro y monitorización de errores | 【VERIFICAR: región del proyecto Sentry. Los ejemplos del código apuntan a la región **DE (Fráncfort, UE)** (`ingest.de.sentry.io`), pero la configuración admite también región US. Confirmar cuál está en uso en producción】 | Sí, salvo que el proyecto sea 100 % región UE sin acceso desde EE. UU. | Data Privacy Framework (Sentry adherida) y/o CCT | 【DECISIÓN: enlazar el DPA de Sentry】 |
| **Vercel, Inc.** (EE. UU.) | Alojamiento y distribución del frontend; registros de acceso | **EE. UU.** con nodos de borde globales | Sí | Data Privacy Framework (Vercel adherida) y CCT | 【DECISIÓN: enlazar el DPA de Vercel】 |
| **Proveedores de mensajería push del navegador** (p. ej. Google LLC / FCM, Mozilla, Apple) | Entrega de las notificaciones web push que tú has activado | Principalmente **EE. UU.** y otros | Sí | Data Privacy Framework y/o CCT del proveedor correspondiente. Se trata de infraestructura del navegador que tú utilizas; solo reciben el endpoint cifrado y la notificación | No aplica un DPA propio de Fresco; se rige por la política del fabricante de tu navegador |
| **Proveedor de correo transaccional** (confirmación de cuenta, restablecimiento de contraseña, cambios de correo, confirmación de contrato) | Envío de correos del Servicio | 【DECISIÓN: hoy los correos de autenticación se envían a través de la infraestructura de Supabase. Si se contrata un proveedor específico (p. ej. Resend, con dominio propio), declararlo aquí con su ubicación y garantías】 | 【DECISIÓN】 | 【DECISIÓN】 | 【DECISIÓN】 |
| 【VERIFICAR: CDN/anti-abuso (p. ej. Cloudflare) que pudieran usar Supabase o Vercel como subencargados】 | | | | | |

**No** realizamos ninguna otra cesión de datos personales a terceros, salvo obligación legal o requerimiento de autoridad competente. **No vendemos ni alquilamos** datos personales. **No** usamos tus recetas propias ni tus datos de salud para entrenar modelos ni para ningún fin distinto de prestarte el Servicio.

## 5. Elaboración de perfiles y decisiones automatizadas (arts. 13.2.f y 22 RGPD)

**5.1.** El Servicio realiza un tratamiento automatizado consistente en **puntuar y ordenar las recetas candidatas** de su catálogo para asignar una a cada franja del menú. La puntuación pondera, entre otros factores: el ajuste al tiempo de cocina disponible en día laborable o fin de semana; la variedad de categorías y la alternancia de platos contundentes y ligeros; la coincidencia con la temporada; la valoración media de la receta; una penalización de las recetas muy descartadas por el conjunto de usuarios; y un pequeño factor de aleatoriedad reproducible.

**5.2.** En el **Plan Pro / Family**, además: se **excluyen del conjunto de candidatas** las recetas que hayas marcado como cocinadas o descartadas en las 2 últimas semanas, y tu historial personal de interacción **ajusta al alza o a la baja** la puntuación de cada receta.

**5.3.** **Lógica aplicada:** es un algoritmo determinista de reglas y pesos, ejecutado en nuestros servidores; **no interviene ningún sistema de inteligencia artificial de terceros**. **Importancia y consecuencias:** el resultado es únicamente una propuesta de menú **totalmente editable**; puedes cambiar, mover o eliminar cualquier receta. Este tratamiento **no produce efectos jurídicos** ni te afecta significativamente de modo similar, por lo que **no está sujeto a la prohibición del art. 22.1 RGPD**.

**5.4.** El filtrado de seguridad alimentaria (exclusión de recetas con alérgenos declarados o contrarias a tu dieta) **no es una decisión discrecional**, sino una exclusión estructural previa; su fiabilidad depende de la exactitud de los datos que introduzcas (véase la Parte B, cláusula 10).

## 6. Tus derechos

Puedes ejercer, de forma gratuita, los siguientes derechos:

- **Acceso** a tus datos personales.
- **Rectificación** de datos inexactos o incompletos.
- **Supresión** ("derecho al olvido"), cuando ya no sean necesarios, retires el consentimiento o te opongas al tratamiento.
- **Limitación** del tratamiento en los supuestos del art. 18 RGPD.
- **Portabilidad**: recibir en un formato estructurado, de uso común y lectura mecánica los datos que nos hayas facilitado y que tratemos por consentimiento o para ejecutar el contrato, y transmitirlos a otro responsable. El Servicio ofrece una función de **exportación de datos** en tu perfil.
- **Oposición** al tratamiento basado en interés legítimo (finalidades 4 —registro de la señal conductual en Plan Free— y 9 —seguridad—, en lo que no sea imprescindible para prestar o proteger el Servicio), y a cualquier tratamiento con fines de mercadotecnia directa.
- **No ser objeto de decisiones automatizadas** con efectos jurídicos o similares; como se explica en el apartado 5, no realizamos este tipo de decisiones.
- **Retirar el consentimiento** en cualquier momento (para las alergias y la dieta, borrando esos datos de tu perfil; para la analítica, desde la configuración de cookies; para las notificaciones, desde el interruptor del perfil). **La retirada del consentimiento no afecta a la licitud del tratamiento previo a dicha retirada.**

**Cómo ejercerlos:** escribiendo a 【DECISIÓN: correo de privacidad】, indicando el derecho que ejerces y adjuntando, si es necesario para verificar tu identidad, un medio de identificación. Responderemos en el plazo de **un mes** (ampliable a dos más si la solicitud es compleja, informándote de la ampliación).

**Reclamación ante la autoridad de control:** si consideras que el tratamiento no se ajusta a la normativa, puedes reclamar ante la **Agencia Española de Protección de Datos (AEPD)**:

- Sede electrónica: `https://sedeagpd.gob.es`
- Dirección postal: C/ Jorge Juan, 6, 28001 Madrid.

Antes, puedes dirigirte a nuestro 【DECISIÓN: DPD, si se designa】.

## 7. Datos de menores

El Servicio no se dirige a menores de 14 años (Parte B, cláusula 3). No recabamos conscientemente datos de menores de esa edad. Si detectamos que se han obtenido datos de un menor de 14 años sin el consentimiento de sus titulares de la patria potestad o tutela, los suprimiremos sin dilación.

## 8. Datos de invitado (sesión anónima) y su eliminación

Cuando usas Fresco **sin registrarte**, creamos una sesión anónima con un identificador propio. Los datos que introduces (incluidas alergias y dieta, tratadas con tu consentimiento explícito) quedan asociados a esa sesión. **Si no conviertes la sesión en una cuenta registrada, todos esos datos se eliminan automáticamente a los 3 días** mediante un proceso programado que borra la sesión anónima y, en cascada, todo su contenido (perfil, menús, listas). Si conviertes la sesión en cuenta, los datos se conservan y pasan a regirse por el resto de esta Política.

## 9. Medidas de seguridad

Aplicamos medidas técnicas y organizativas apropiadas al riesgo (art. 32 RGPD): cifrado en tránsito (HTTPS/TLS), control de acceso basado en la propiedad de cada fila de datos (RLS), separación de claves y secretos, limitación de peticiones, política de contraseñas robustas con comprobación contra listas de filtraciones, cabeceras de seguridad y política de seguridad de contenidos (CSP), y minimización de datos en la analítica (captura automática desactivada para no recoger etiquetas de salud). 【DECISIÓN: describir, a alto nivel, las medidas organizativas: control de accesos del personal, registro de subencargados, procedimiento de gestión de incidentes】.

## 10. Violaciones de seguridad de los datos (arts. 33 y 34 RGPD)

Disponemos de un procedimiento interno para detectar, documentar y gestionar las violaciones de seguridad de los datos personales. En caso de una violación que **suponga un riesgo para tus derechos y libertades**, la **notificaremos a la AEPD en un plazo máximo de 72 horas** desde que tengamos constancia de ella; y si la violación **entraña un alto riesgo**, te la comunicaremos también a ti sin dilación indebida, describiendo su naturaleza, las posibles consecuencias y las medidas adoptadas. Mantendremos un **registro interno de todas las violaciones**, con independencia de que sean o no notificables. 【DECISIÓN: designar la persona/rol responsable de coordinar la respuesta a incidentes y, si procede, el apoyo del encargado (Supabase/Vercel notifican al responsable según sus DPA)】.

## 11. Cambios en esta Política

Podremos actualizar esta Política de Privacidad. Los cambios sustanciales se comunicarán a los usuarios registrados por correo electrónico y/o mediante aviso destacado en la aplicación, con antelación razonable a su entrada en vigor. La fecha de la última actualización figura al final. 【DECISIÓN: fecha de versión y control de versiones】.

## 12. Información resumida (capa 1)

> Texto breve para mostrar como primera capa, con enlace a esta Política completa.

| | |
|---|---|
| **Responsable** | 【DECISIÓN】 |
| **Finalidad** | Prestarte el servicio de planificación de menús y lista de la compra; gestionar tu cuenta y, si la contratas, tu suscripción Pro; con tu permiso, analítica y notificaciones. |
| **Legitimación** | Ejecución del contrato; consentimiento explícito para tus datos de alergias y dieta; consentimiento para analítica y notificaciones; interés legítimo para seguridad; obligaciones legales para facturación. |
| **Destinatarios** | Proveedores tecnológicos (alojamiento, pagos, analítica, errores, correo) que pueden implicar **transferencias internacionales** con garantías adecuadas. No vendemos tus datos. |
| **Derechos** | Acceso, rectificación, supresión, limitación, portabilidad, oposición y retirada del consentimiento, escribiendo a 【DECISIÓN】. Reclamación ante la AEPD. |
| **Información adicional** | Política de Privacidad completa (esta Parte C). |

---
---

# Parte D — Política de Cookies

> **Borrador para revisión de abogado. No constituye asesoramiento jurídico.** Implementa el **art. 22.2 LSSI-CE** y la **Guía de cookies de la AEPD** vigente. **Hallazgo que corrige:** hoy la analítica (PostHog) se carga **sin banner de consentimiento previo**, lo que constituye un incumplimiento del art. 22.2 LSSI. Esta política presupone la implantación de un banner conforme (Parte F, punto 4).

## 1. Qué son las cookies y tecnologías equivalentes

Una cookie es un archivo que se descarga en tu dispositivo al acceder a determinadas páginas o aplicaciones web y que permite almacenar y recuperar información. Esta política se aplica también a **tecnologías equivalentes** (almacenamiento local `localStorage` y `sessionStorage`, identificadores de dispositivo, píxeles), que reciben el mismo tratamiento legal.

## 2. Consentimiento (primera capa del banner)

Al acceder por primera vez, se mostrará un **banner de cookies** que permitirá, con la misma facilidad:

- **Aceptar todas.**
- **Rechazar todas** (botón con la misma visibilidad y en el mismo nivel que "Aceptar").
- **Configurar** / **Preferencias** (panel de segunda capa para aceptar o rechazar por categorías).

Mientras no des tu consentimiento, **solo se instalarán las cookies técnicas o necesarias**. El banner **no usará casillas premarcadas** para las cookies no necesarias, **no** condicionará el acceso al servicio a la aceptación (sin "muros de cookies" que no ofrezcan alternativa) y **no** empleará patrones que induzcan a aceptar. Podrás **cambiar o revocar** tu elección en cualquier momento desde el enlace "Configuración de cookies" del pie de página. 【DECISIÓN: duración durante la cual se recuerda la elección antes de volver a preguntar — la AEPD recomienda no más de 24 meses; el borrador propone 12 meses】.

## 3. Cookies y almacenamiento que utilizamos

> La tabla debe cerrarse **tras una auditoría técnica real** de lo que instala cada proveedor en la versión desplegada. Los valores siguientes reflejan lo detectado en el código y la configuración actuales y deben confirmarse.

| Nombre / patrón | Proveedor | Finalidad | Duración | Tipo |
|---|---|---|---|---|
| `sb-<ref>-auth-token` (y variantes `-code-verifier`, fragmentos numerados) | Supabase (primera parte) | Mantener tu sesión iniciada y renovarla de forma segura | Sesión / hasta el cierre de sesión; el token de refresco 【VERIFICAR: caducidad configurada】 | **Técnica / necesaria** (exenta de consentimiento) |
| Estado del asistente de onboarding | Fresco (primera parte, `sessionStorage`) | Conservar tus respuestas del onboarding si recargas la página a mitad del proceso | Hasta cerrar la pestaña | **Técnica / necesaria** |
| Preferencia de cookies | Fresco (primera parte) | Recordar tu elección en el banner de cookies | 【DECISIÓN: p. ej. 12 meses】 | **Técnica / necesaria** |
| `ph_<project_key>_posthog` | PostHog | Identificar de forma persistente el navegador para medir uso, embudos y retención de producto | 【VERIFICAR: por defecto 12 meses en PostHog; confirmar la configuración】 | **Analítica** (requiere consentimiento) |
| Identificadores y marcas asociados de PostHog en `localStorage` (p. ej. `distinct_id`, `$sesid`, feature flags) | PostHog | Continuidad de sesión de analítica y segmentación por propiedades (plan, invitado, método de alta) | Persistente hasta borrado o retirada del consentimiento | **Analítica** (requiere consentimiento) |
| 【VERIFICAR: cookies técnicas de Vercel (p. ej. balanceo/edge) y de Cloudflare si aplica】 | Vercel / Cloudflare | Entrega y seguridad de la aplicación | 【VERIFICAR】 | **Técnica / necesaria** (a confirmar) |
| Sentry | Sentry | El SDK de Sentry usa principalmente almacenamiento propio en memoria/`sessionStorage` para agrupar errores; 【VERIFICAR si instala cookies persistentes en la versión desplegada】 | 【VERIFICAR】 | 【VERIFICAR: si no instala cookies persistentes, no procede en esta tabla; el tratamiento de errores se cubre por interés legítimo en la Parte C, finalidad 9】 |

**Suscripción push:** la activación de notificaciones web push **no es una cookie**, sino una suscripción del navegador que solo se crea si tú la activas expresamente en tu perfil; se describe en la Parte C, finalidad 10.

**Cookies de terceros con fines publicitarios o de redes sociales:** **no se utilizan.**

## 4. Analítica sin cookies (opción a valorar)

PostHog admite un modo de funcionamiento **sin cookies / sin persistencia** (identificación solo en memoria). 【DECISIÓN: valorar activar el modo *cookieless* de la analítica. Ventaja: reduce (aunque no necesariamente elimina) la necesidad de consentimiento previo para la analítica y simplifica el banner. Inconveniente: se pierde la medición de retención entre sesiones, que es justamente la métrica que motivó la elección de PostHog (ADR-0013). Si el modo sin cookies no permite medir la retención a 3 semanas del plan de validación, mantener la analítica bajo consentimiento】.

## 5. Cómo gestionar las cookies desde tu navegador

Además del panel de configuración de Fresco, puedes bloquear o eliminar cookies desde los ajustes de tu navegador (Chrome, Firefox, Safari, Edge). El bloqueo de las cookies técnicas puede impedir el funcionamiento correcto del Servicio.

## 6. Actualización

Esta Política de Cookies puede actualizarse para reflejar cambios técnicos o normativos. Fecha de última actualización: 【DECISIÓN】.

---
---

# Parte E — Registro de Actividades de Tratamiento (RAT, RGPD art. 30)

> **Borrador para revisión de abogado. No constituye asesoramiento jurídico.** Plantilla del RAT como **responsable del tratamiento** (art. 30.1 RGPD), para completar y conservar como **documento interno** (no se publica). Una actividad por finalidad, alineada con la tabla de la Parte C. Debe fecharse, versionarse y actualizarse cuando cambie cualquier tratamiento o proveedor.

**Datos de cabecera del RAT:**

- Responsable: 【DECISIÓN: nombre, NIF, domicilio, contacto】
- Representante del responsable (si aplica): 【DECISIÓN: normalmente no aplica, responsable establecido en España】
- DPD: 【DECISIÓN: sí/no y contacto】
- Fecha de creación / última revisión del RAT: 【DECISIÓN】

| # | Actividad de tratamiento | Fines del tratamiento | Categorías de interesados | Categorías de datos personales | Categorías especiales (art. 9) | Categorías de destinatarios | Transferencias internacionales (país + garantía) | Plazo de supresión previsto | Medidas técnicas y organizativas de seguridad (art. 32) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Gestión de cuentas y autenticación | Alta, identificación y acceso de usuarios | Usuarios registrados; usuarios invitados | Correo, contraseña con hash, identificadores, fechas | No | Supabase; proveedor de correo | UE (Supabase eu-west-1); EE. UU. para soporte (CCT) | 【DECISIÓN】 | RLS, TLS, hash de contraseñas, MFA interno 【VERIFICAR】, control de accesos |
| 2 | Generación de menús y listas de la compra | Prestación del servicio principal | Usuarios registrados e invitados | Preferencias de dieta, cocinas, ingredientes no deseados, hogar, presupuesto, tiempos, experiencia, objetivo, menús, franjas, valoraciones | No (las alergias/dieta se registran en la actividad 3) | Supabase | UE; EE. UU. soporte (CCT) | 【DECISIÓN】 | RLS, TLS, minimización |
| 3 | Tratamiento de datos de salud y convicciones (alergias y restricciones dietéticas/religiosas) | Excluir estructuralmente recetas no seguras o no aptas | Usuarios registrados e invitados | Alergias, intolerancias, restricciones dietéticas | **Sí** — datos de salud y, en su caso, convicciones (art. 9) | Supabase (no se comparten con Stripe/PostHog/Sentry) | UE; EE. UU. soporte (CCT) | 【DECISIÓN】 | RLS, TLS, exclusión de estas etiquetas de la analítica, acceso restringido |
| 4 | Registro de la señal conductual y valoraciones | Mejora del catálogo y del producto (todos los planes) | Usuarios registrados e invitados | Id de receta, estado, valoración, fecha; contadores agregados por receta | No | Supabase | UE; EE. UU. soporte (CCT) | 【DECISIÓN: evento vs. agregado】 | RLS, TLS, agregación |
| 5 | Personalización avanzada por aprendizaje (Pro/Family) | Ejecutar la funcionalidad del plan de pago | Usuarios Pro/Family | Historial personal de cocinadas/descartadas, recuentos personales por receta | No | Supabase | UE; EE. UU. soporte (CCT) | 【DECISIÓN】 | RLS, funciones con seguridad definida, TLS |
| 6 | Recetas propias y favoritos | Biblioteca personal del usuario | Usuarios registrados | Nombre, ingredientes y pasos de recetas; lista de favoritos | No | Supabase | UE; EE. UU. soporte (CCT) | 【DECISIÓN】 | RLS, TLS |
| 7 | Gestión de la suscripción y pagos | Cobro y gestión del Plan Pro; facturación | Usuarios Pro/Family | Identificadores de cliente y suscripción de Stripe, plan, fechas, marca de impago; datos de pago tratados por Stripe | No | Stripe; asesoría fiscal 【DECISIÓN】; AEAT | Irlanda y **EE. UU.** (Stripe) — Data Privacy Framework + CCT | 【DECISIÓN: plazo fiscal/mercantil】 | Tokenización por Stripe, no almacenamiento de PAN, TLS, trigger que impide la escritura del estado de suscripción desde el cliente |
| 8 | Analítica de producto | Medir uso, embudos y retención (KPI del negocio) | Usuarios registrados e invitados que han consentido | Id de usuario, eventos de uso, propiedades de persona (plan, invitado, método de alta), datos de dispositivo/IP asociados | No | PostHog | Datos en **UE** (PostHog Cloud EU); acceso desde EE. UU. (CCT) | 【DECISIÓN】 | Consentimiento previo, captura automática desactivada, proxy de ingesta en dominio propio, retención limitada en el proveedor |
| 9 | Seguridad, prevención de abuso y registro de errores | Integridad, disponibilidad y seguridad del Servicio | Todos los usuarios y visitantes | IP, identificadores de sesión/dispositivo, logs de acceso, contadores de rate limiting, trazas de error y contexto | No | Vercel; Sentry; Supabase | **EE. UU.** (Vercel — DPF/CCT); 【VERIFICAR región Sentry】 | 【DECISIÓN: logs vs. trazas vs. contadores】 | Minimización, seudonimización donde sea posible, retención corta, envío silencioso ante fallo |
| 10 | Notificaciones web push | Recordatorio semanal de planificación (opt-in) | Usuarios que han activado las notificaciones | Endpoint y claves de la suscripción push, fecha de último uso | No | Servicio push del navegador (Google/FCM, Mozilla, Apple) | **EE. UU.** y otros — DPF/CCT del fabricante del navegador | 【DECISIÓN】 | Consentimiento explícito, firma VAPID, cifrado del contenido, borrado de endpoints inválidos |
| 11 | Centro de Avisos | Comunicaciones informativas in-app y estado de la cuenta | Usuarios registrados | Marcas de aviso leído/descartado, plan, estado de pago | No | Supabase | UE; EE. UU. soporte (CCT) | 【DECISIÓN】 | RLS, TLS |
| 12 | Atención a consultas y ejercicio de derechos | Atender solicitudes y acreditar su tramitación | Usuarios y terceros que contactan | Datos de contacto, contenido de la comunicación, prueba de identidad si procede | Posible, según el contenido que aporte el interesado | Proveedor de correo | 【DECISIÓN】 | 【DECISIÓN: p. ej. 3 años】 | Acceso restringido, minimización |
| 13 | Modo invitado y su eliminación automática | Permitir un primer uso sin registro y suprimir si no se convierte | Usuarios invitados | Datos de las actividades 2 y 3 asociados a sesión anónima | Sí (alergias/dieta) | Supabase | UE; EE. UU. soporte (CCT) | **3 días** (borrado automático programado) | Proceso programado de borrado en cascada, RLS |

**Anexo al RAT (recomendado):**
- Lista actualizada de **encargados y subencargados** con enlace a cada contrato/DPA (Parte C, apartado 4).
- **Juicios de ponderación** de los tratamientos basados en interés legítimo (actividades 4 —Plan Free— y 9).
- Referencia a la **evaluación sobre la necesidad de una EIPD** (art. 35): 【DECISIÓN: dado que se tratan datos de salud aunque a pequeña escala y con finalidad limitada, documentar una valoración de si procede una Evaluación de Impacto; el borrador estima que, por el volumen y la finalidad estrictamente de seguridad alimentaria, probablemente **no** sea obligatoria, pero la valoración debe constar por escrito】.

---
---

# Parte F — Checklist de implementación para ingeniería

> **Borrador para revisión de abogado. No constituye asesoramiento jurídico.** Cambios de código y producto a ejecutar **una vez el abogado apruebe los textos**. No implementar antes de la validación letrada de los literales. Todos los textos deben salir del documento aprobado, no de este borrador.

| # | Cambio | Dónde | Notas |
|---|---|---|---|
| 1 | **Sustituir el placeholder de entidad legal** por el nombre y NIF/CIF reales | `components/legal/legal-modal.tsx:22` (`LEGAL_ENTITY_PLACEHOLDER`) y cualquier otro punto donde se muestre el titular | No desplegar a producción hasta tener la entidad decidida (【DECISIÓN A】) |
| 2 | **Eliminar el banner "Borrador — pendiente de revisión legal"** | `components/legal/legal-modal.tsx:152-154` | Solo tras la aprobación letrada registrada en FRESCO-365 |
| 3 | **Crear rutas y contenidos legales completos**: `/aviso-legal`, `/terminos`, `/privacidad`, `/politica-de-cookies` como páginas propias (no solo modal), enlazadas desde el pie de página en toda la app y en el onboarding | Nuevo: `app/(marketing)/aviso-legal/`, etc. Sustituir/duplicar el contenido hoy incrustado en `legal-modal.tsx` | Los textos legales deben ser accesibles **sin iniciar sesión** y con URL permanente. Mantener versionado y fecha de vigencia |
| 4 | **Banner de cookies conforme + gate de PostHog**: PostHog **no debe inicializarse** hasta que exista consentimiento de analítica; primera capa con Aceptar / Rechazar / Configurar equiparables; enlace "Configuración de cookies" en el pie; persistencia de la elección | `app/providers/posthog-provider.tsx` (hoy hace `posthog.init` sin gate); nuevo proveedor de consentimiento; `app/layout.tsx` | Considerar además el modo *cookieless* de PostHog (【DECISIÓN L】). Revisar el proxy `/ingest` para que no dispare nada antes del consentimiento |
| 5 | **Casilla de confirmación de edad (14+)**, no premarcada, en el alta registrada y en el onboarding de invitado | `app/signup/page.tsx`; `app/onboarding/page.tsx` (paso de identidad) | Bloquear el avance si no se marca. Guardar prueba del consentimiento (timestamp + versión de términos) |
| 6 | **Casilla de aceptación de Términos y Privacidad** en la **segunda vía de alta** (onboarding, paso de identidad), equiparable a la que ya exista en `/signup` | `app/onboarding/page.tsx` (identity step); `app/signup/page.tsx` | Hoy el usuario de onboarding puede generar un menú sin aceptar términos. Registrar versión aceptada |
| 7 | **Aviso de privacidad + consentimiento explícito de datos de salud** en el paso de alergias del onboarding (incluido el de invitado) | `app/onboarding/page.tsx` (paso de dieta/alergias) | Texto breve enlazando a la Política de Privacidad + casilla específica "Consiento el tratamiento de mis datos de alergias y dieta para excluir recetas no seguras" (art. 9.2.a). Sin esta casilla no se guardan alergias |
| 8 | **Correo de confirmación del contrato en soporte duradero** tras contratar Pro (art. 98.7 TRLGDCU), con toda la información precontractual, el modelo de desistimiento y la confirmación del art. 103.m | Nuevo correo transaccional; se dispara tras `checkout.session.completed` en `app/api/stripe/webhook/route.ts` o proceso asociado | **Bloqueado por el dominio de correo**: requiere dominio propio verificado con un proveedor de envío (nota "Resend SMTP blocked"). Prerrequisito para poder cobrar |
| 9 | **Resumen precontractual + casillas de desistimiento** antes de redirigir a Stripe Checkout: características, precio total con IVA, duración, renovación automática mensual, derecho de desistimiento y su pérdida; casilla de solicitud de ejecución inmediata (art. 103.m) y casilla/enlace de información de desistimiento | `app/(app)/profile/page.tsx` (CTA "Pásate a Fresco Pro"); nueva pantalla intermedia antes de `POST /api/stripe/checkout` | Guardar prueba del consentimiento a la ejecución inmediata (necesario para la política de reembolso de la cláusula 7) |
| 10 | **Enlace de "Configuración de cookies"** y enlaces a los 4 documentos legales en el pie de página global y en las páginas de auth | Componente de footer; layout de auth | Requisito LSSI: revocación tan fácil como la prestación |
| 11 | **Actualizar `SECTION_LABEL` y estructura del modal** para reflejar 4 documentos (Términos, Privacidad, Cookies, Aviso Legal) o migrar el modal a enlaces a las páginas nuevas | `components/legal/legal-modal.tsx` | El modal puede quedar como resumen con "leer completo" que abre la página |
| 12 | **Página de export de datos**: verificar que cubre todas las categorías de la Parte C (perfil, menús, franjas, listas, recetas propias, favoritos, señal conductual, avisos) para el derecho de portabilidad | `GET /api/profile/export` | Documentar qué incluye y qué no (y por qué) |
| 13 | **Registrar la versión de textos aceptada** por cada usuario (términos, privacidad, edad, salud, desistimiento) con fecha | Esquema: nueva tabla o columnas en `user_profiles` | Necesario para acreditar el consentimiento (art. 7.1 RGPD) y su versión |
| 14 | **Verificar región de Sentry** (US vs DE) y fijarla explícitamente a UE si es viable; documentar en ADR-0009 | `sentry.*.config.ts`, DSN | Alimenta la tabla de transferencias de la Parte C |
| 15 | **Revisar el texto de los correos de Supabase Auth** (confirmación, cambio de correo, recuperación) para que remitan a las políticas y usen dominio propio | Configuración de plantillas de Supabase Auth | Relacionado con el punto 8 |
| 16 | **Juicios de ponderación de interés legítimo** documentados (Plan Free señal conductual; seguridad/errores) y guardados junto al RAT | Documento interno | No es código, pero es prerrequisito de cumplimiento de las finalidades 4 y 9 |

---
---

# Parte G — Lista consolidada de decisiones para el fundador / abogado

> Cada elemento corresponde a un marcador `【DECISIÓN】` del documento. Numeración estable para poder referenciarla en la revisión.

## Entidad y datos identificativos (Aviso Legal, art. 10 LSSI)

1. **Forma jurídica**: autónomo (persona física) o sociedad (S.L. u otra). Condiciona campos registrales, fiscalidad y varias cláusulas.
2. **Nombre / denominación social** completa del titular.
3. **NIF / CIF**.
4. **Domicilio a efectos de notificaciones** (y decisión sobre no publicar el domicilio particular si es autónomo: domicilio profesional, coworking o apartado postal).
5. **Datos de inscripción registral** (Registro Mercantil si es sociedad; "no procede" si es autónomo).
6. **Correo electrónico de contacto** oficial, preferiblemente en **dominio propio** (sustituir `hola.frescoapp@gmail.com`).
7. **Teléfono de contacto** o decisión de que el único canal es el correo.
8. **Dominio(s)** desde los que se presta el servicio (contratar dominio propio; hoy solo subdominios de Vercel).
9. **Marca "Fresco"**: registrada, en trámite o sin registrar (OEPM/EUIPO).
10. **Códigos de conducta**: adhesión a alguno (Confianza Online / Autocontrol) o ninguno.
11. **Licencias o comunicaciones administrativas** adicionales según forma jurídica y domicilio (verificar con el abogado).

## Términos y Condiciones

12. **Fecha de entrada en vigor y sistema de versionado** de los Términos (y de la Política de Privacidad y de Cookies).
13. **Plan Family**: ¿está activo comercialmente? Precio y contenido, o eliminarlo de los textos si solo existe a nivel de datos.
14. **IVA en el precio de 4,99 €**: precio final con impuestos incluidos (recomendado para consumidores) o "+ IVA"; reflejarlo de forma coherente en toda la app.
15. **Aviso previo a la renovación**: enviar recordatorio antes de la primera renovación tras la prueba (recomendado) y/o antes de cada renovación.
16. **Política de reembolso** del periodo mensual en curso al cancelar (por defecto sin reembolso salvo desistimiento o error).
17. **Alcance del derecho de desistimiento y del art. 103.m** para una suscripción mensual: reembolso proporcional dentro de los 14 días (opción recomendada) u otra fórmula; cerrar la redacción de las cláusulas 7.3 y 7.4 en consecuencia.
18. **Verificación de edad**: autodeclaración por casilla (admitida por la doctrina mayoritaria para bajo riesgo) o algún control adicional; documentar la decisión y el procedimiento ante un menor detectado.
19. **Navegadores y versiones mínimas** soportados (información de compatibilidad, art. 97 TRLGDCU).
20. **Alcance de las obligaciones del Reglamento de Servicios Digitales (DSA)** aplicables y procedimiento de retirada de contenido de usuario ilícito.
21. **Preaviso de modificación de los Términos** (30 días propuesto) y canal.
22. **Preaviso de subida de precio** (30 días propuesto) y canal.
23. **Preaviso y política de reembolso en caso de cierre del Servicio.**
24. **Ciudad de sometimiento a fueros para usuarios que no sean consumidores.**
25. **Hojas de reclamaciones** conforme a la normativa autonómica de consumo del domicilio del Prestador: ponerlas a disposición o no.
26. **Adhesión a un sistema de resolución alternativa de litigios de consumo** (Junta Arbitral de Consumo u otro) o declaración expresa de no adhesión.
27. **Limitación de responsabilidad — cuantía (CRÍTICO)**: eliminar el tope de "12 meses" frente a consumidores y remitir a los daños directos probados (opción recomendada); mantener tope solo para no consumidores; o asumir el riesgo de inaplicación. Confirmar que no se excluye nada respecto a daños a la salud/seguridad.
28. **Registro de marca / titularidad de la propiedad intelectual del catálogo** (coordinar con la decisión 9).

## Privacidad

29. **Correo dedicado de privacidad** (p. ej. `privacidad@dominio`).
30. **Delegado de Protección de Datos (DPD)**: designar o no; documentar la valoración; si se designa, publicar su contacto.
31. **Plazos de conservación por cada finalidad** de la tabla de la Parte C (13 filas) — decisión jurídica según plazos de prescripción; hay recomendaciones entre corchetes en cada fila.
32. **Base jurídica del registro de la señal conductual para usuarios del Plan Free**: interés legítimo con juicio de ponderación (recomendado) o consentimiento.
33. **Plazo de conservación de eventos de analítica** y configuración equivalente en PostHog.
34. **Plazo de conservación de datos de facturación** (plazo mercantil ~6 años / fiscal ~4 años; confirmar).
35. **Existencia de asesoría contable/fiscal externa** como destinataria de datos de facturación.
36. **Proveedor de correo transaccional** definitivo (Supabase por defecto hoy; declarar Resend u otro si se contrata), con su ubicación y garantías.
37. **Enlaces a los DPA / acuerdos de encargado** de Supabase, Stripe, PostHog, Sentry y Vercel, y correo para solicitar copia de garantías.
38. **Región del proyecto Sentry** (US vs DE) — verificar y, a ser posible, fijar en UE.
39. **Verificación de subencargados tipo CDN/anti-abuso** (Cloudflare u otros) usados por Supabase/Vercel.
40. **Medidas organizativas de seguridad** a describir (control de accesos del personal, gestión de incidentes, registro de subencargados).
41. **Persona/rol responsable de coordinar la respuesta a violaciones de seguridad.**
42. **Valoración documentada sobre la necesidad de una Evaluación de Impacto (EIPD, art. 35 RGPD).**
43. **Contenido exacto de la primera capa (resumen) de privacidad** una vez fijados responsable y correos.

## Cookies

44. **Duración de la validez del consentimiento de cookies** antes de volver a solicitarlo (máx. 24 meses; 12 propuesto).
45. **Auditoría técnica real de cookies** en la versión desplegada para cerrar la tabla de la Parte D (nombres, proveedores, duraciones, tipos), incluidas cookies de Vercel/Cloudflare y comportamiento de Sentry.
46. **Activar o no el modo *cookieless* de PostHog** (sopesar contra la métrica de retención a 3 semanas del plan de validación — ADR-0013).
47. **Fecha de última actualización** de la Política de Cookies.

## RAT y organización interna

48. **Datos de cabecera del RAT** (responsable, representante, DPD, fecha de versión).
49. **Juicios de ponderación de interés legítimo** por escrito (Plan Free señal conductual; seguridad/errores).
50. **Anexo del RAT** con lista viva de encargados/subencargados y enlaces a contratos.

## Transversal

51. **Revisión letrada completa registrada en FRESCO-365** (quién revisó y cuándo) — criterio de aceptación del ticket.
52. **Orden de despliegue**: no eliminar el banner "Borrador" ni el placeholder de entidad, ni cobrar a ningún usuario, hasta que 1–8, 14, 16–17, 27, 31 y 51 estén cerrados y los textos aprobados.

---

_Fin del borrador. Documento sujeto a revisión de abogado. No constituye asesoramiento jurídico._
