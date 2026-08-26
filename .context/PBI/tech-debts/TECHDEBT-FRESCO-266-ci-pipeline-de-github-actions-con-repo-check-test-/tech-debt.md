# Tarea: CI: pipeline de GitHub Actions con repo:check + test:e2e en cada PR

**Jira Key:** [FRESCO-266](https://basiliomontescastano.atlassian.net/browse/FRESCO-266)
**Status:** WIP
**Type:** Tarea

---

## Description

## Contexto

Auditoría externa (Dojo, Ely, 14 ago 2026) detectó que `.github/` no existe en el repo — nunca hubo CI. `bun run repo:check` (format + lint + types + vars) y `bun run test:e2e` (Playwright) ya existen en `package.json`, pero ningún pull request los ejecuta.

Verificado el 26 ago 2026: el hueco creció desde la auditoría. 133 PRs ya mergeados sin gate, 22 escenarios `@automatizado` y 19 ficheros de tests unitarios que no corren en ningún PR.

Eje de auditoría afectado: ***Testabilidad*** (4,0/5 — el único hallazgo Alto de toda la auditoría).

## Solución propuesta

Workflow de GitHub Actions (`.github/workflows/pr-check.yml`) que en cada pull request contra `staging` y `main`:

1. Instala dependencias (`bun install`).
2. Corre `bun run repo:check` (format, lint, types, vars, skills).
3. Corre `bun run test:e2e`.
4. Bloquea el merge si algo falla.

## Plan de acción

1. Crear `.github/workflows/pr-check.yml` con trigger `pull_request` hacia `staging` y `main`.
2. Configurar como secretos de GitHub Actions las variables de entorno que `test:e2e` necesita (ver `.env.example`).
3. Validar el workflow abriendo un PR de prueba.
4. Activar "Require status checks to pass before merging" en la protección de rama de `staging` y `main`.

## Retorno esperado

Es el único hallazgo de la auditoría con retorno compuesto: cada día sin CI, el volumen de PRs sin proteger sigue creciendo. Una vez resuelto, el hallazgo "cobertura declarada vs ejecutada" (ratio de escenarios automatizados) se vuelve un número fiable automáticamente, sin trabajo adicional.

---

## Fields

### Clasificación

0|i001of:

### customfield_10000

{}

---

## Metadata

- **Created:** 8/26/2026
- **Updated:** 8/26/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-dojo

---

_Synced from Jira by sync-jira-issues_
