# DEFECT: 228/1000 recetas muestran dificultad en blanco (falta key 'alta' en DIFICULTAD_LABELS)

**Jira Key:** [FRESCO-122](https://basiliomontescastano.atlassian.net/browse/FRESCO-122)
**Priority:** Medium
**Status:** Listo
**Components:** None

---

## Description

Qué se observa

Dónde: lib/recipes/labels.ts:36-41 (DIFICULTAD_LABELS), components/recipes/recipe-detail.tsx:79-89

Pasos para reproducir:
1. Abrir cualquier receta cuyo meta.dificultad = "alta" en DB (ejemplo verificado: /recipes/ac85f924-96de-4181-8c33-73c42a00345d, "Tortilla francesa con especias con miel").
2. Ver el detalle de la receta.

Esperado: "30 min · alta · muy bajo" (o el label humanizado correspondiente).

Observado: "30 min ·  · muy bajo" — doble punto literal, dificultad en blanco. DIFICULTAD*LABELS está tipado como Record<DificultadReceta,string> con keys muy*facil | facil | media | avanzada, pero el seed real de datos usa el valor "alta" (228 de 1000 recetas, 22.8%) en vez de "avanzada" (solo 1 fila real). Como meta es jsonb (no enum tipado en Postgres), TypeScript no detecta el mismatch. La condición receta.meta?.dificultad ? DIFICULTAD_LABELS[...] : '—' es truthy para "alta" así que nunca cae al fallback '—', simplemente renderiza undefined (nada).

Evidencia: query en vivo — select meta->>'dificultad', count(*) from recipes group by 1 confirma 228 filas con "alta" vs 1 con "avanzada".

Por qué importa

22.8% del catálogo (228 recetas) muestra información de dificultad rota — visible en cualquier detalle de receta, alto volumen de usuarios afectados.

Alcance

Opción A (más simple): añadir "alta" como alias de "avanzada" en DIFICULTAD_LABELS (o renombrar la key). Opción B: migrar los 228 registros de meta.dificultad de "alta" a "avanzada" en DB para normalizar el dato. Recomendado: A + B combinados — arreglar el símbolo del código Y limpiar el dato para que el tipo TS vuelva a ser garantía real.

Cómo reproducir

Ver Pasos para reproducir arriba.


---

## Metadata

- **Created:** 8/8/2026
- **Updated:** 8/8/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** major, qa-sweep-2026-08-08

---

_Synced from Jira by sync-jira-issues_
