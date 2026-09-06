# Tarea: Replantear el pipeline de fotos de recetas: precisión sobre fuerza bruta

**Jira Key:** [FRESCO-435](https://basiliomontescastano.atlassian.net/browse/FRESCO-435)
**Status:** Listo
**Type:** Tarea

---

## Description

## Contexto

El pipeline actual de fotos de receta (`scripts/fetch-recipe-photos.ts`) busca en Unsplash (tier preciso + tier amplio) y, si falla, cae a Pexels y Pixabay. La query se arma traduciendo el nombre de la receta ES -> EN con un diccionario y añadiendo palabras genéricas (`cooked meal food photography`). Deduplica por hash de foto.

El problema: ***subir cobertura a fuerza bruta no funciona***. La búsqueda por nombre de plato en bancos de imágenes genéricos devuelve, la mayoría de las veces, el plato equivocado, ingredientes crudos, packaging de marca o escenas sin relación.

## Evidencia

| Métrica | Valor |
| --- | --- |
| Tasa de mismatch histórica | ~70-82% |
| Última tanda (40 candidatos, 2026-09-05) | 7 MATCH / 30 MISMATCH / 3 con marca visible = ***17,5% de acierto*** |
| Pexels + Pixabay como fallback | apenas mueven la aguja |
| QA | manual y visual en cada tanda (cuello de botella) |

Ejemplos reales de la última tanda: "Tostada con salmón ahumado" -> macro de salmón crudo; "Porridge de avena" -> cuenco de cereales de bolsa; "Tortilla de espárragos" -> espárragos crudos sin tortilla; dos recetas de "Pavo al horno" -> la misma foto de mesa de Thanksgiving.

## Causa raíz

1. Los buscadores de stock genéricos no tienen buena cobertura ni relevancia para platos cocinados concretos (y menos con nombre en español traducido).
2. El match es puramente léxico: ninguna verificación de que la imagen devuelta represente de verdad el plato.
3. Sin verificación semántica, cada tanda necesita revisión humana -> el rendimiento neto es diminuto (7 fotos por 40 candidatos procesados).

## Opciones a evaluar (spike incluido en esta tarjeta)

| Opción | Qué aporta | Coste / riesgo |
| --- | --- | --- |
| ***A. Bucle de verificación con modelo de visión*** | Tras traer candidatos, cada imagen pasa por un modelo de visión (Claude) con nombre + ingredientes -> aceptar/rechazar automático. Elimina la QA manual y sube la precisión a ~100% de lo que se aplica. | No sube el hit-rate de la fuente; coste de inferencia por imagen. |
| ***B. Fuente específica de recetas**** | APIs tipo Spoonacular / Edamam / TheMealDB devuelven imagen ligada a receta -> mucha más relevancia. | Cobertura de **nuestras* recetas concretas variable; licencia/atribución a revisar. |
| ***C. Generación de imagen con IA*** | Un render por receta (Imagen / Flux / DALL·E). 100% cobertura, estilo consistente, sin problema de matching. | Estética "foto IA"; coste; revisar términos de uso comercial. |
| ***D. Híbrido*** | Fuente de recetas (B) primero -> stock verificado por visión (A) -> IA (C) como último recurso. | Más piezas que mantener. |
| ***E. Aceptar cobertura menor + placeholder excelente*** | Si solo ~40-50% consigue foto buena, invertir en el estado sin-foto (lo cubre la épica de rediseño). | No resuelve el "se ve a medias" del todo. |

## Recomendación

Empezar por ***A (verificación por visión)**** como ganancia inmediata: convierte el pipeline de "trae mucho, revisa a mano" en "trae y se auto-filtra", y sube la calidad de lo aplicado a casi el 100%. En paralelo, spike corto de ****B (Spoonacular)**** y ****C (IA)*** para decidir cómo cerrar la cobertura hasta 90%+. Elegir entre D y E con datos del spike.

## Entregable

- Pipeline nuevo o reformado con verificación automática (sin QA manual por tanda).
- Decisión documentada sobre fuente(s) para llegar a 90%+ de cobertura.
- Corrida completa sobre el catálogo restante.

Relacionado con FRESCO-31 (continuación del trabajo de cobertura) y con la épica de rediseño visual (tarjeta "Cobertura de fotos + placeholder").

---

## Fields

### Clasificación

0|i002iu:zzi

### customfield_10000

{}

---

## Metadata

- **Created:** 9/5/2026
- **Updated:** 9/6/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** calidad, fotos, pipeline

---

_Synced from Jira by sync-jira-issues_
