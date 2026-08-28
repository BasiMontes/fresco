# Tarea: Jira: enlazar cada defecto a la historia/épica que rompió + adjuntar evidencia

**Jira Key:** [FRESCO-282](https://basiliomontescastano.atlassian.net/browse/FRESCO-282)
**Status:** Merged
**Type:** Tarea

---

## Description

## Contexto

Re-auditoría 27 ago 2026, hallazgo 04 (ALTO), eje Backlog.

## Hallazgo

***120 de 122 defectos están huérfanos**** — sin enlace a la historia o épica que regresaron, y en su mayoría sin enlace a nada. 21 de 122 (17%) tienen alguna captura; ****cero*** tienen captura de red (HAR). El campo Evidence: 0/122.

La densidad de defectos por feature —la métrica de cabecera del shift-left, la que probaría o refutaría la tesis del proyecto— no se puede consultar desde Jira. (El baseline dijo "41 defectos con evidencia de red"; se infirió de las carpetas del repo, no de la instancia, y no sobrevive al contacto con ella.)

## Solución propuesta

Al crear un bug, enlazarlo (`Relates` / `Blocks`, o `parent`) a la historia o épica afectada, y adjuntar la evidencia (screenshot mínimo; HAR cuando aplique).

## Plan de acción

1. Añadir el paso "link a la feature afectada + adjuntar evidencia" al flujo de creación de bugs.
2. Opcional: barrido puntual de los ~26 bugs vivos para enlazarlos retroactivamente.

## Retorno esperado

Un campo más por bug. A cambio: densidad de defectos por épica consultable, y trazabilidad defecto→feature real.

---

## Fields

### Clasificación

0|i001rz:

### customfield_10000

{repository={count=3, dataType=repository}, json={"cachedValue":{"errors":[],"summary":{"repository":{"overall":{"count":3,"lastUpdated":"2026-08-27T21:52:07.000+0200","dataType":"repository"},"byInstanceType":{"GitHub":{"count":3,"name":"GitHub"},"oAuth-com.github.integration.production":{"count":3,"name":"GitHub"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/27/2026
- **Updated:** 8/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-2

---

_Synced from Jira by sync-jira-issues_
