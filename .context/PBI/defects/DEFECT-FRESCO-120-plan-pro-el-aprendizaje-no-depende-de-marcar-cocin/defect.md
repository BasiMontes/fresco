# DEFECT: Plan Pro: el 'aprendizaje' no depende de marcar cocinado/descartado, ni es personal

**Jira Key:** [FRESCO-120](https://basiliomontescastano.atlassian.net/browse/FRESCO-120)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

Qué se observa

Dónde: supabase/migrations/20260725120100*create*fresco*core*tables.sql (función get*recent*recipe_ids), supabase/functions/generate-meal-plan/prompt.ts (buildLearningExplanation), supabase/functions/generate-meal-plan/menu-selector.ts (scoreRecipe)

Pasos para reproducir (verificado en vivo con PRO*TEST*USER_EMAIL):
1. Marcar varios slots del menú de la semana actual como "cocinado", varios como "descartado", dejar el resto sin tocar.
2. Generar el menú de la semana siguiente.
3. Consultar recipes.meta*aprendizaje / el explicacion*aprendizaje persistido y la lista de recetas excluidas del nuevo menú.

Esperado: el copy de FRESCO-103 promete que Pro "aprende de esos marcados" (cocinado/descartado) — el mecanismo debería depender de si el usuario marcó algo.

Observado: get*recent*recipe*ids excluye TODAS las recetas que aparecieron en el calendario en las últimas 2 semanas, sin filtrar por estado — un usuario Pro que nunca toca los botones de cocinado/descartado recibe exactamente el mismo beneficio de "no repetición" que uno que marca todo. Además, el texto persistido en meal*plans.explicacion*aprendizaje afirma "ya cocinaste" sobre recetas que en realidad se marcaron "descartada" (4 de 19 en la prueba en vivo), mezclando ambos estados como si fueran lo mismo. La única señal que sí reacciona a las marcas (recipes.veces*cocinada/veces*descartada/rating*promedio, vía trigger AFTER UPDATE) alimenta scoreRecipe() sin gate de isPro y son columnas agregadas GLOBALMENTE entre todos los usuarios, no personales — un Free también se beneficia de las marcas de un Pro.

Evidencia: query en vivo a meal*plans.explicacion*aprendizaje semana 2026-W33: "También evitamos 19 recetas que ya cocinaste en las últimas 2 semanas, para darte variedad" — 4 de esas 19 estaban marcadas descartada, no cocinada.

Por qué importa

Es el diferenciador de pago central de Plan Pro. Si el mecanismo real no depende de las marcas del usuario ni es personal/exclusivo Pro, se está vendiendo una funcionalidad que no existe — riesgo de negocio (reembolsos, confianza) además de defecto técnico.

Alcance

1. Decidir el diseño correcto: ¿get*recent*recipe_ids debería filtrar por estado (solo excluir cocinadas, o cocinadas+descartadas con distinto peso)?
2. Decidir si el scoring debe ser per-user (no agregado global) para que sea un beneficio Pro real, o si el "aprendizaje" se redefine conscientemente como agregado-global-pero-informado-por-tus-marcas (y se corrige el copy para no prometer personalización 1:1).
3. Corregir buildLearningExplanation para no decir "cocinaste" quand la razón real es "aparecio en el calendario" o "descartaste".

Cómo reproducir

1. Login con cuenta Pro.
2. Marcar 3 slots cocinado, 4 descartado, dejar 14 sin marcar en la semana actual.
3. Generar la semana siguiente.
4. Comparar qué recetas se excluyeron vs cuáles estaban realmente marcadas — todas las de esa semana se excluyen por igual, marcadas o no.


---

## Metadata

- **Created:** 8/8/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** major, qa-sweep-2026-08-08

---

_Synced from Jira by sync-jira-issues_
