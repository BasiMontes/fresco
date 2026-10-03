# Auditoría 6 externa (2026-10-01): tabla de solapes con la 6 interna

> Fuente: [`2026-10-01-audit-6-externa.html`](./2026-10-01-audit-6-externa.html) (Ely, `main@eb98b0e`, 3,8/5, rúbrica v1, 10 hallazgos con peso + lista "para cuando pases cerca").
> Contraparte: [`2026-10-02-audit-6.md`](./2026-10-02-audit-6.md) (6 interna, 3,2/5, 82 hallazgos, EPIC FRESCO-775).
> Ticket de este análisis: FRESCO-832. Estados de Jira consultados el 2026-10-03.

Los dos documentos usan la misma rúbrica y se separan 0,6 en 24 horas porque miran cosas distintas (la externa no tuvo Jira ni la base de datos hospedada; la interna recorrió la app en staging con un usuario Free). Por eso la nota absoluta no mide tendencia: ver [`README.md`](./README.md).

## Hallazgos con peso

| # | Externa | Severidad | Solape con la 6 interna | Ticket | Estado |
|---|---|---|---|---|---|
| 1 | RPC `apply_recipe_status_update` sin guardas | Bloqueante | A6-S1, A6-T1 (mismo hallazgo) | FRESCO-776 | Finalizada |
| 2 | El gate de promoción no frena con staging en rojo (17 de 179 SHAs) | Alto | Ninguno (la interna no miró el historial de promoción) | FRESCO-829 (`git:promote`, #473) y FRESCO-831 (divergencia aceptada, #475). FRESCO-833 es el ticket de origen | 829 y 831 entregados; 833 en Rechazos |
| 3 | Gates de cierre perdidos en el sync del 7 de septiembre (313, 404, I22) | Alto | Parcial: A6-P8 y A6-P1 son el síntoma (cierres sin evidencia) | FRESCO-830 (#476); FRESCO-812 cubre la evidencia de cierre; FRESCO-834 es el ticket de origen | 830 entregado; 834 en Rechazos |
| 4 | 78 commits directos con identidad `test@example.com` | Medio | Ninguno | FRESCO-828 (bloqueo en pre-commit hacia delante) y FRESCO-837 (revisar los ya entrados, 736 y 738) | 837 en Listo |
| 5 | Tarjetas de ahorro con cifras antes de que haya datos | Medio | A6-P5 (mismo hallazgo) | FRESCO-792 (`27ed69ea`) | Finalizada |
| 6 | Documentación de sistema parada en el 3 de septiembre | Medio | A6-A2 (ADRs) y parcial en la 6 interna | FRESCO-814 (mapas y epic-tree), FRESCO-835 (roadmap, glosario, README de auditorías), FRESCO-789 (ADRs) | 814 y 835 en Listo; 789 Finalizada |
| 7 | El e2e corre contra un `seed.sql` desfasado (issue #349) | Medio | A6-D3 (mismo hallazgo) | FRESCO-800 | Listo |
| 8 | ADRs 0028/0032/0033/0035 en `Proposed` | Medio | A6-A2, A6-A10 | FRESCO-789 | Finalizada |
| 9 | Gates de FRESCO-281, 282 y 321 también descartados por el sync | Alto (hallado después, al verificar el nº 3) | Ninguno | FRESCO-839 | Listo |
| 10 | Bifurcación: reglas que viven en una capa que el actor puede saltarse | Patrón, no hallazgo | Ninguno | Cubierto por los nº 1 a 4 y 9 | n/a |

## Lista "para cuando pases cerca" (Bajo)

Verificado con `rg` sobre `2026-10-02-audit-6/`: la 6 interna **no** menciona `x-powered-by`, `server-only`, los botones de 14 px, `brag-output` como basura versionada, `DESIGN.md:4`, `hotfix.md` ni los tests de Edge fuera del typecheck. Los tickets de higiene FRESCO-816 a 821 agrupan "hallazgos BAJO de audit-6", así que no cubren estos puntos por defecto. Dos excepciones: el ADR-0002 duplicado es A6-A2 y `/admin/recipes` ya estaba revisado por la interna (404 real en vivo, A5-H8a resuelto), lo que contradice la externa y merece repetir la comprobación.

| Punto | Solape con la 6 interna | Ticket | Estado |
|---|---|---|---|
| `hotfix.md:51`, `dependabot.yml` y `git_strategy` dicen `dev`, los PRs van a `staging` | Ninguno | FRESCO-836 | Rechazos, sin motivo documentado |
| `admin_bypass: false` convive con el bypass de admin en el mirror push | Ninguno | FRESCO-831 (divergencia aceptada, #475) | Entregado |
| 16 tests de Edge Functions fuera de cualquier typecheck | Ninguno | FRESCO-836 | Rechazos, sin motivo documentado |
| `lib/supabase/service.ts` sin `import 'server-only'` | Ninguno | FRESCO-836 | Rechazos, sin motivo documentado |
| Botones "Todos" y "Ninguno" de `/profile` a 14 px | Ninguno (FRESCO-787 añade el proyecto móvil/tablet, no este caso) | FRESCO-836 | Rechazos, sin motivo documentado |
| `/admin/recipes` responde 200 con "no encontrada" | Contradice A5-H8a de la interna (404 real); repetir la comprobación | FRESCO-836 | Rechazos, sin motivo documentado |
| Cabecera `x-powered-by: Next.js` | Ninguno | FRESCO-836 | Rechazos, sin motivo documentado |
| 14,7 MB de `brag-output*`, `step2-vegano.yml`, `landing-top.png`, `tasks/` | Ninguno (la interna solo anota `brag-output/` sin trackear) | FRESCO-836 | Rechazos, sin motivo documentado |
| `DESIGN.md:4` dice "Menús semanales con IA" | Ninguno | FRESCO-836 | Rechazos, sin motivo documentado |
| `ADR-0002-multi-harness-single-source.md` choca con el ADR-0002 propio | A6-A2 | FRESCO-789 | Finalizada |

## Fuera de alcance de esta tabla

Los cinco hallazgos de la auditoría 4 que la externa no pudo comprobar sin Jira (A4-M16, A4-H17 en parte, A4-M23, A4-L19, A4-L20) no son hallazgos nuevos de la 6: pertenecen al EPIC FRESCO-359.

## Cobertura

Los 10 hallazgos con peso tienen ticket. De la lista "para cuando pases cerca", 2 puntos están resueltos (FRESCO-831, FRESCO-789) y 8 dependen de FRESCO-836, que está en Rechazos sin motivo escrito. Hasta que 836 se reabra o documente su descarte, el criterio de cierre de FRESCO-832 ("ticket o motivo de descarte") queda cumplido a medias para esos 8.
