# Audit-6 · Eje DevOps/CI/release (rubric v1)

Fecha: 2026-10-02 · Modo: solo lectura · Repo: `BasiMontes/fresco` · HEAD `3fe02a95`

## Score: 3,5 / 5 (igual que audit-5)

Dos ALTO de audit-5 cerrados (A5-H1, A5-H2) y el estado vivo está limpio. Lo compensan hallazgos nuevos: vulnerabilidades abiertas sin ninguna alarma, y el control semanal de deriva en rojo 3 semanas seguidas sin que nadie actúe. Sin BLOCKER.

Conteo: **0 BLOCKER · 2 ALTO · 6 MEDIO · 6 BAJO**

## Verificado en vivo

| Comprobación | Resultado |
|---|---|
| SHAs `origin/dev`, `staging`, `main` | Los tres en `3fe02a95`, idénticos. |
| Vercel `fresco-dev/pre/pro` | Los tres READY, creados 00:15 CEST, con CSP enforcing + HSTS preload + XFO DENY + nosniff + Referrer + Permissions-Policy. CSP con nonce y `strict-dynamic`. |
| `bun run git:policy verify` | Sin drift entre lo declarado y el host. Solo 6 notas: `non_fast_forward` y `deletion` ausentes en rulesets, cubiertas por la protección clásica. |
| Protección de ramas | `main`/`staging`/`dev` exigen `repo:check`, `test:unit`, `test:e2e` (strict=false). `dev` además exige PR con 0 aprobaciones. `main`/`staging` no exigen PR. `enforce_admins=false`. Force push y borrado bloqueados. |
| Migraciones `supabase migration list --linked` | 84/84 local = remoto, sin desfases. |
| Edge functions: `check-functions-drift.ts` + `functions list` | 8 desplegadas, ≥ fuente en repo, 0 drift. |
| `bun run vars:env:check` | 0 errores; 1 aviso (`ATLASSIAN_URL` obsoleta en `.env`). |
| Ramas remotas | 4 (`dev`, `main`, `staging`, `test/FRESCO-464-...`). Antes eran 82. |
| Runs de GitHub | Últimos 100: PR Check 31/31 verde, Post-Deploy Smoke 41/41 verde, Edge functions 14/14 verde, Drift checks 11/14 (los 3 rojos son el commit de migración empujado antes de aplicarse, 18:31–19:44 UTC, y se cura al aplicarla). |
| Secretos del repo | `ENV_FILE`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `CATALOG_REFRESH_TOKEN`. Secret scanning y push protection activos. Permisos de workflow por defecto en `read`. Acciones ancladas por SHA. |
| Despliegues Vercel | ≥ 40 en un día (1 oct), repartidos entre las 3 ramas y 2 ramas de PR. |

## Hallazgos

| ID | Sev. | Evidencia | Escenario de fallo | Fix |
|---|---|---|---|---|
| A6-D1 | ALTO | `bun audit`: **13 vulnerabilidades (7 high, 5 moderate, 1 low)**: `postcss <=8.5.22` (vía `next`), `nanoid`, `brace-expansion`, `dompurify`, `yaml`. Con `--prod` sigue saliendo lo mismo. API de GitHub: "Dependabot alerts are disabled", `dependabot_security_updates: disabled`. Ni CI ni husky ejecutan `bun audit` (rg sin coincidencias). Dependabot (bun) ya está configurado, pero su PR #403 (36 actualizaciones agrupadas, 28 sep) se cerró en 49 min y no hay otro abierto. | Sale un CVE explotable en una dependencia de runtime (`dompurify`, `next>postcss`) y nada avisa: ni alerta, ni PR de seguridad, ni CI rojo. La cobertura de A5-H1 es nominal: monitoriza pero no entrega. | Activar Dependabot alerts y security updates (Settings > Security). Añadir `bun audit --audit-level=high` a `repo:check` (o a un job semanal). Partir el grupo `dependencies` (p. ej. minor/patch vs major) para que los PR sean revisables. Subir `next`/`dompurify` para limpiar los 7 high. |
| A6-D2 | ALTO | ADR-0020: un único proyecto Supabase (`jdqemhewjrjuopssdurn`) para local/dev/staging/prod en plan Free. Sin runbook de backup/restore: `rg` de backup/PITR/restore en `docs/` y ADR-0020 no da nada. `docs/workflows/hotfix.md` dice "ejecutar la down-migration por separado" pero `supabase/migrations/` no contiene ninguna migración down. El rollback de Vercel no deshace la BD. | Una migración destructiva, un `DELETE` o un UPDATE masivo accidental (scripts como `prune-duplicate-recipes`, `merge-near-duplicate-recipes`) sobre prod: sin PITR (Free) ni procedimiento, la recuperación es incierta. El runbook promete algo que no existe. | Documentar en ADR-0020 el RPO/RTO real y el procedimiento de dump. Cron semanal de `pg_dump` a almacenamiento externo. Que el runbook de hotfix diga "forward-fix de BD" en vez de down-migration. Reabrir con Supabase Pro (backups diarios + PITR). |
| A6-D3 | MEDIO | Cron `migration-drift-check.yml`: el job `check seed.sql vs prod recipe catalog` falla **3 semanas seguidas** (14, 21 y 28 sep, runs programados en rojo). Issue #349 abierto desde 14 sep, sin comentarios. Un segundo job de la misma workflow sí pasa. | El fixture e2e se queda atrás del catálogo real y los tests corren contra datos obsoletos. Peor: un aviso rojo semanal que nadie lee entrena a ignorar el canal que sí avisó de FRESCO-413. | Regenerar `seed.sql` y cerrar #349. Asignar responsable y SLA al issue de deriva. Valorar que el job deje de abrir un issue duplicado y escale (p. ej. falle `repo:check` si el fixture lleva más de N días desfasado). |
| A6-D4 | MEDIO | Checks requeridos (`gh api .../protection`): solo `repo:check`, `test:unit`, `test:e2e`. Los jobs `test:db-integration` (RLS/triggers) y `deno:check` (lint + typecheck de edge functions) existen en `pr-check.yml` y corren, pero **no son requeridos**. `main`/`staging` no exigen PR y `enforce_admins=false`. | Un PR que rompe un trigger de seguridad (clase FRESCO-360/A5-B2) o el typecheck de las edge functions se puede fusionar con esos jobs en rojo. | Añadir `test:db-integration` y `deno:check` a los checks requeridos de las 3 ramas, y `git:policy apply` para dejarlo reflejado. |
| A6-D5 | MEDIO | `refresh-supermarket-prices.yml` (FRESCO-770) usa `secrets.SUPABASE_URL` y `secrets.SUPABASE_SERVICE_ROLE_KEY`, pero la lista de secretos del repo no los incluye. `gh run list`: **0 ejecuciones**, nunca disparado. La bitácora (1 oct) confirma "falta añadir los secretos". No he podido ejecutar el dry-run local (bloqueado por el clasificador, no se evadió). `refresh-mercadona-catalog` falló 3 veces el 1 oct (primer fallo: `token` obligatorio no suministrado; luego fallos al abrir el PR) antes de pasar en la cuarta. | El runner de precios llega a producción sin ninguna prueba end-to-end en CI y fallará en el primer intento por falta de secretos. El service-role key en Actions se desplegaría con una workflow sin historial. | Añadir los secretos o dejar la workflow sin merge hasta entonces. Ejecutar un `workflow_dispatch` en dry-run antes del primer `--apply`. Registrar en el ticket el resultado de las 4 ejecuciones de mercadona (causa de cada fallo). |
| A6-D6 | MEDIO | `ENV_FILE` es el `.env` completo de producción, restaurado en cada job e2e de PR (`pr-check.yml` L253-264) y en post-deploy-smoke. `.env.ci` pisa Supabase, Stripe, PostHog y Sentry (A4-H7 resuelto), pero el resto de claves sigue entrando al runner. `SUPABASE_ACCESS_TOKEN` es un PAT de cuenta (valor amplio) usado por el despliegue automático de edge functions. Repo público. | Un PR con código malicioso en rama del mismo repo (colaborador comprometido, dependencia con postinstall) lee el resto de secretos de prod del `.env`. El PAT permite tocar cualquier proyecto de la cuenta. | Trocear `ENV_FILE` y entregar a e2e solo lo que necesita. Sustituir el PAT por uno con alcance mínimo, o desplegar con un token de proyecto. Activar `sha_pinning_required` (hoy `false`). |
| A6-D7 | MEDIO | No hay endpoint de salud ni monitor de uptime (`fd health` en `app/` sin resultados; nada en `docs/` ni ADR). Sentry está cableado (client/server/edge con `environment`), pero sin `release` ni tag de commit; `tracesSampleRate: 0.1`. No hay alertas definidas en el repo ni runbook de guardia. | Una caída parcial (Edge Function en 500, Stripe webhook fallando) solo se detecta cuando alguien lo ve. Sin `release`, un error en Sentry no se atribuye a un deploy concreto y el rollback se decide a ciegas. | Añadir `/api/health` (app + dependencia de Supabase) y un monitor externo gratuito. Inyectar `release = VERCEL_GIT_COMMIT_SHA` en Sentry. Documentar 2-3 alertas mínimas. |
| A6-D8 | MEDIO | Más de 40 despliegues Vercel en un solo día (1 oct), con un push a `staging` que desplegaba las 3 ramas más las de PR. Tope Free: 100/día (ya se alcanzó el 2026-09, ver memoria `vercel_deploy_cap_100_per_day`). `edge-functions-drift` y `post-deploy-smoke` se cuelgan de cada deploy. | En un día de varios PR seguidos se agota el cupo y se bloquea el despliegue de producción, justo cuando haría falta un hotfix. | Evitar desplegar `dev`+`staging`+`main` en cada ff (ignored build step para `dev`/`staging` o `vercel.json` con `git.deploymentEnabled`), o dejar una reserva documentada. |
| A6-D9 | BAJO | 91 de los últimos 300 commits tienen autor `test <test@example.com>`; ninguno está firmado (`%G?`: 166 E, 134 N). Vercel registra `githubCommitAuthorLogin: bhanuprasad14` para el commit de HEAD. | Trazabilidad forense débil: el commit en producción no identifica a una persona real. | Fijar `user.name/email` en el entorno de ejecución del agente; valorar firma de commits o el trailer `Claude-Session` ya definido. |
| A6-D10 | BAJO | `enforce_admins=false` y `strict=false` en las 3 ramas; `main`/`staging` sin PR obligatorio. Autodocumentado en `git_strategy`. | Un push directo a `main` esquiva los checks; solo lo frena la disciplina. | Aceptado y documentado; reconsiderar si entra un segundo colaborador. |
| A6-D11 | BAJO | `.context/audits/branch-protection.md` es una captura del 2026-08-30 (solo `branches/*/protection`), no refleja `dev` con PR requerido ni los rulesets. | Un auditor sin acceso a `gh` lee una foto vieja. | Regenerar con `git:policy verify --stamp` o añadir fecha de caducidad al fichero. |
| A6-D12 | BAJO | Rama remota `test/FRESCO-464-get-recent-recipe-ids-spoof` huérfana (PR #313 sin fusionar según memoria). `stale-branch-cleanup.yml` (FRESCO-732) aún no ha ejecutado nunca (primer cron: lunes 5 oct). | Acumulación lenta, como en A5-H2. | Vigilar la primera ejecución del lunes; borrar o cerrar la rama. |
| A6-D13 | BAJO | `.env` conserva `ATLASSIAN_URL` (aviso de `vars:env:check`). | Copia obsoleta tras una migración de Jira. | Borrar la línea. |
| A6-D14 | BAJO | `stripe-e2e.yml` programado los lunes, pero **0 ejecuciones programadas** hasta hoy (solo un dispatch manual el 29 sep). | Garantía "viva" no comprobada aún. | Comprobar la ejecución del lunes 5 oct. |

## Positivos

- Paridad de despliegue perfecta: 3 ramas, 3 dominios Vercel y SHA idénticos; promoción por ff-only con e2e sobre el SHA de `staging`.
- Cabeceras de seguridad completas en las tres URLs: CSP enforcing con nonce y `strict-dynamic`, `report-uri` a Sentry, HSTS preload. Cierra el follow-up de FRESCO-312.
- Migraciones 84/84 y funciones 8/8 sincronizadas, con dos compuertas automáticas (drift de migraciones en `push: staging`, auto-deploy de edge functions) que ya detectaron casos reales.
- `git:policy verify`: cero deriva entre política declarada y GitHub (A5 "sin drift" se mantiene).
- Acciones ancladas por SHA, `persist-credentials:false`, `permissions: read` por defecto; e2e aislado de prod con aserción explícita (`*supabase.co*` aborta) y `.env.ci` que neutraliza Stripe/PostHog/Sentry.
- CI estable: 100 % verde en PR Check y Post-Deploy Smoke en los últimos 100 runs; e2e en 4-5 min y 1 reintento.
- Runbook de hotfix y rollback con árbol de decisión (rollback vs forward-fix).
- Secret scanning + push protection activos.

## Regresiones audit-4 / audit-5

| Hallazgo previo | Estado hoy |
|---|---|
| A5-H1 Dependabot sin npm/bun | **Cerrado en configuración** (ecosistema `bun` + `github-actions`, semanal), pero ver A6-D1: sin alertas, PR #403 cerrado y 13 vulns abiertas. |
| A5-H2 82 ramas mergeadas | **Cerrado**: 4 ramas remotas. Barrido de ramas cerradas sin merge añadido (aún sin ejecutar). |
| A5-H5 `@requiere-stripe-real` sin wiring en CI | **Cerrado**: `stripe-e2e.yml` semanal (aún sin ejecución programada, A6-D14). |
| A4-H7 CI usaba Stripe/PostHog/Sentry de prod | **Cerrado** (`.env.ci` los pisa), con residuo A6-D6. |
| A4-M11 un único proyecto Supabase | **Sigue abierto, aceptado** (ADR-0020); impacto de recuperación en A6-D2. |
| A4-L16 smoke con secretos, acciones por tag móvil | **Cerrado** (SHA pin, `persist-credentials:false`). |
| FRESCO-312 CSP | **Cerrado**: enforcing con nonce. |
| FRESCO-325/413 drift de migraciones | **Funciona**: 84/84; los 3 rojos de hoy son la compuerta haciendo su trabajo. |
| A4/A5 `enforce_admins:false`, `strict:false` | Sin cambios, aceptado (A6-D10). |

Limitaciones: no se ejecutó el dry-run de `refresh-supermarket-prices.ts` (denegado por el clasificador). No se consultó la facturación de Vercel ni el panel de Supabase para confirmar plan/backups: A6-D2 se apoya en la ausencia de documentación y en ADR-0020.
