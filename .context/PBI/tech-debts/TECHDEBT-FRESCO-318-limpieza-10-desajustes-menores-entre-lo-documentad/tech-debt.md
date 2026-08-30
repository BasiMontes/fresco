# Tarea: Limpieza: 10 desajustes menores entre lo documentado y lo real

**Jira Key:** [FRESCO-318](https://basiliomontescastano.atlassian.net/browse/FRESCO-318)
**Status:** Listo
**Type:** Tarea

---

## Description

HALLAZGO BAJO — desajustes menores entre lo escrito y lo real. 10 puntos, cada uno de 1-5 min.

1. lib/supabase/service.ts:7-8 dice "exactly one caller today"; app/api/cron/stripe-reconcile/route.ts:4 es el segundo.
2. domain-glossary.md:29 dice "14 ADRs ... ADR-0006 is the only gap". Hay 15 y el 0006 existe desde el 08-08.
3. project.yaml:7 sigue diciendo "This is the project-starter TEMPLATE. All values are intentionally null". git_strategy.meta.created: 2026-06-20 es anterior al primer commit.
4. Sin bloque `dev` en environments: aunque fresco-dev.vercel.app está vivo (misma omisión que causó el CORS de FRESCO-297).
5. .impeccable/config.json trackeado aunque eslint.config.js lo documenta como local-only.
6. 14 directorios n8n-* en .agents/skills/ tras quitar sus symlinks.
7. 47 review.md / compliance-matrix.md siguen tras "retirarlos" en 1c7cf21.
8. 8 ramas remotas 41-178 commits por detrás.
9. app/dev/skeleton-capture se sirve en producción sin gate de NODE_ENV.
10. 6 de 15 ADRs siguen en Proposed con la decisión implementada hace semanas (0001 desde el 25-07).


---

## Fields

### Clasificación

0|i001zr:

### customfield_10000

{}

---

## Metadata

- **Created:** 8/29/2026
- **Updated:** 8/29/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-3

---

_Synced from Jira by sync-jira-issues_
