# DEFECT: Etiqueta de semana ambigua al cruzar de mes en el Calendario

**Jira Key:** [FRESCO-109](https://basiliomontescastano.atlassian.net/browse/FRESCO-109)
**Priority:** Medium
**Status:** WIP
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: `components/calendar/week-navigation.tsx` (cálculo de `label`)
- ***Pasos para reproducir***: navegar a una semana que cruce fin de mes (ej. 27 jul – 2 ago).
- ***Esperado***: alguna indicación de que los dos extremos pertenecen a meses distintos.
- ***Observado***: el label siempre usa el mes del domingo para ambos extremos — se muestra literalmente "27–2 AGO", que se lee como si el 27 fuera de agosto (después del 2), cuando en realidad es de julio.

## Por qué importa

Un usuario puede malinterpretar en qué mes cae el inicio de la semana al planificar su menú, especialmente en semanas que cruzan fin de mes.

## Alcance

Agregar indicación de que los extremos pertenecen a meses distintos, por ejemplo mostrando "27 JUL – 2 AGO" en vez de "27–2 AGO".

## Cómo reproducir

1. En el Calendario, navegar a una semana que cruce fin de mes (ej. 27 jul – 2 ago).
2. Observar la etiqueta de la semana.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/7/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
