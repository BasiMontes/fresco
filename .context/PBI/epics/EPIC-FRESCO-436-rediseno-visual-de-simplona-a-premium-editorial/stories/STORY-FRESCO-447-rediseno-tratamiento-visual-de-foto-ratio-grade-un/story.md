# Rediseño | Tratamiento visual de foto: ratio + grade unificador

**Jira Key:** [FRESCO-447](https://basiliomontescastano.atlassian.net/browse/FRESCO-447)
**Epic:** [FRESCO-436](https://basiliomontescastano.atlassian.net/browse/FRESCO-436) (Rediseño visual: de "simplona" a premium editorial)
**Type:** Historia
**Status:** Listo
**Priority:** Medium
**Story Points:** -

---

## Overview

## Objetivo

Distinto de FRESCO-435 (que arregla que la foto sea **la correcta**). Aquí: que 600 fotos de 600 fuentes distintas ***parezcan la misma marca***. Es el principal compensador de no gastar en fotografía.

## Alcance

- ***Ratio de recorte único*** en todas las superficies (mismo aspect ratio en Menú, Calendario, Biblioteca, detalle).
- ***Filtro CSS sutil unificador***: grade cálido leve, saturación y contraste constantes, para que fotos con luz y estilo distintos compartan tono.
- `object-fit: cover` + focal point si el pipeline lo aporta.
- Definir el tratamiento como token/utilidad reutilizable, no ad-hoc por pantalla.

## Dependencias

Bloqueada por tarjeta 5 (card de receta). Enlaza FRESCO-31 y FRESCO-435.

---

## Metadata

- **Created:** 9/5/2026
- **Updated:** 9/6/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** fotos, rediseno

---

_Synced from Jira by sync-jira-issues_
