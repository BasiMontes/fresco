# Tarea: Aterrizar FRESCO-266: e2e bloqueante + tests unitarios en un job de CI

**Jira Key:** [FRESCO-280](https://basiliomontescastano.atlassian.net/browse/FRESCO-280)
**Status:** Finalizada
**Type:** Tarea

---

## Description

## Contexto

Re-auditoría 27 ago 2026, hallazgo 02 (ALTO), eje Testabilidad. Combina dos huecos: los tests unitarios no corren en ningún sitio, y la rama que lo arregla está parada.

## Hallazgo

- ***21 ficheros ****`**.test.ts` (el doble que en el baseline: `lib/***`, `supabase/functions/***`). No hay script `test` en `package.json` de `main`, no están en los hooks de Husky, no están en la CI. La mitad barata de la suite —segundos, sin navegador— no protege nada.
- La rama `ci/FRESCO-266-flip-e2e-blocking` (PR #149 → `dev`, abierto) ya hace el trabajo: quita `continue-on-error`, cablea `test:unit` (`bun test`) en `repo:check`, añade `bunfig.toml` + `bun-test-setup.ts`, y cambia el e2e de `next dev` a `build && start`. Pero está ***6/6 runs en rojo, 22 commits por detrás de ****`dev`****, ******~******26 h sin tocar****. Sus fallos (drift de signup, `@aprendizaje` sin huecos, regex de lista-compra) ****ya están arreglados en ****`main`****/***`dev` por los PRs #151–154.

## Plan de acción

1. Mergear `dev` en `ci/FRESCO-266-flip-e2e-blocking` (trae los 22 commits con los fixes).
2. Re-correr la CI de la rama. Confirmar el job e2e en verde (la caja sin marcar de la propia descripción del PR).
3. Mergear el PR #149.
4. Marcar la caja de `test:e2e` como required check (depende del ticket 1).

## Retorno esperado

Los 21 tests unitarios empiezan a correr en cada PR. El e2e pasa de informativo a señal real. Cierra el hallazgo ALTO original del baseline de verdad, no a medias.

---

## Fields

### Clasificación

0|i001rj:

### customfield_10000

{}

---

## Metadata

- **Created:** 8/27/2026
- **Updated:** 8/28/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-2

---

_Synced from Jira by sync-jira-issues_
