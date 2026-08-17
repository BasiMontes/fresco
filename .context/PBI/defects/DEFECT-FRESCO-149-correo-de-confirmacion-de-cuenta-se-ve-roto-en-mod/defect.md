# DEFECT: Correo de confirmación de cuenta se ve roto en modo oscuro (falta color-scheme / dark-mode styles)

**Jira Key:** [FRESCO-149](https://basiliomontescastano.atlassian.net/browse/FRESCO-149)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: config de Auth de Supabase — `mailer*templates*confirmation*content` (y `mailer*templates*recovery*content`, mismo patrón), gestionado vía Management API, no vive en el repo.
- El HTML del correo de confirmación tiene estilos inline completos (fondo crema, card blanca redondeada, banner verde con logo, botón naranja) pero ***no incluye*** `<meta name="color-scheme" content="light dark">` ni ningún bloque `@media (prefers-color-scheme: dark)`.
- Sin esa señal, clientes de correo con modo oscuro (confirmado en iOS Mail) invierten/descartan los `background-color` inline que detectan como "solo modo claro" — el fondo termina en negro plano, se pierde la card blanca y el fondo crema, mientras el logo (imagen) y el botón (con `background-color` fuerte) sobreviven.
- Reportado en vivo por el user tras confirmar cuenta con `basi_montes@hotmail.com`: correo llegó a Spam y, dentro del cliente, se veía sin estilo — banner y botón sí, resto del layout no.

## Por qué importa

Primer contacto real de marca con el usuario (confirmación de cuenta / recuperación de contraseña) se ve roto para cualquiera que use su cliente de correo en modo oscuro — un porcentaje alto en iOS Mail/Gmail app. Refuerza además la sensación de correo poco confiable justo cuando ya iba a Spam.

## Alcance

- Agregar `<meta name="color-scheme" content="light dark">` + `<meta name="supported-color-schemes" content="light dark">` al HTML de `mailer*templates*confirmation_content`.
- Agregar bloque `<style> @media (prefers-color-scheme: dark) { ... } </style>` que fije explícitamente los colores de fondo/texto del card para que no dependan de la inversión automática del cliente.
- Aplicar el mismo tratamiento a `mailer*templates*recovery_content` (mismo layout base, mismo problema).
- Publicar el cambio vía Supabase Management API (`PATCH /v1/projects/{ref}/config/auth`) — no hay archivo de plantilla en el repo, la fuente de verdad es la config remota de Auth.

## Cómo reproducir

1. Disparar un signup o "reenviar confirmación" a una cuenta de email cuyo cliente esté en modo oscuro (ej. iOS Mail con tema oscuro del sistema).
2. Abrir el correo "Confirma tu cuenta en Fresco".
3. Observar fondo negro plano en vez del fondo crema/card blanca del diseño — banner verde y botón naranja sí se ven bien.

---

## Metadata

- **Created:** 8/9/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
