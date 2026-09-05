# Tarea: Rellenar entidad legal + corregir la política de privacidad (encargados y transferencias)

**Jira Key:** [FRESCO-430](https://basiliomontescastano.atlassian.net/browse/FRESCO-430)
**Status:** Listo
**Type:** Tarea

---

## Description

## Contexto

Dos arreglos de ***texto*** (sin lógica) para que Fresco deje de tener contenido legal falso o incompleto en producción, apoyándose en el borrador de FRESCO-365 (`.context/legal/FRESCO-365-borrador-textos-legales.md`).

## Qué hay que hacer

### 1. Rellenar la identidad del prestador

- `components/legal/legal-modal.tsx:22` — sustituir `LEGAL*ENTITY*PLACEHOLDER` por los datos reales del titular: ***Basilio Montes Castaño***, autónomo (persona física), NIF + domicilio a efectos de notificaciones + correo de contacto.
- Quitar el banner "Borrador — pendiente de revisión legal antes de producción" (`legal-modal.tsx:152-154`).
- Decisiones pendientes del fundador: NIF, domicilio a publicar (particular o fiscal), correo. ***Prerrequisito***: estar dado de alta como autónomo (RETA + Hacienda) — cobrar suscripciones sin alta es un problema aparte de Hacienda/SS, no de este ticket.

### 2. Corregir la Política de Privacidad para que sea veraz

- Declarar ***todos los encargados***: Stripe, PostHog, Sentry, Vercel, proveedor de push (FCM), email de auth de Supabase — hoy solo menciona Supabase.
- Declarar la ***transferencia internacional*** a EE.UU. (Stripe, FCM, posible Sentry) con su mecanismo (DPF / cláusulas contractuales tipo). Hoy la política afirma "todo en la UE" y "no compartimos datos" — es materialmente falso en cuanto hay un pago con Stripe.
- Corregir la ***contradicción****: la señal cocinada/descartada se ****registra en todos los planes**** (ADR-0001); solo su **aplicación* a la generación es Pro. Hoy "Información que Recopilamos" la presenta como solo-Pro.
- Añadir los datos tratados no declarados: presupuesto semanal, límites de tiempo de cocina, experiencia/objetivo, `planning_selection`, favoritos, recetas propias, listas de la compra, IDs de Stripe, suscripciones push, eventos de analítica, errores.
- Base jurídica por finalidad (art. 6/9), no solo la de alergias.

## Fuera de alcance

- La reescritura completa de los Términos (limitación de responsabilidad, desistimiento) — necesita abogado, va aparte.
- El RAT (documento interno del fundador).
- Rutas dedicadas `/aviso-legal` `/politica-de-cookies` — pueden ir con la card de cookies.

## Notas

- El texto ya redactado está en el borrador de FRESCO-365, Partes A y C. Esta card lo lleva al código.
- No sustituye a la revisión letrada; elimina lo falso/incompleto que hay ahora.

---

## Fields

### Clasificación

0|i002iu:zr

### customfield_10000

{}

---

## Metadata

- **Created:** 9/3/2026
- **Updated:** 9/4/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-4, legal, rgpd

---

_Synced from Jira by sync-jira-issues_
