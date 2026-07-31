-- FRESCO-22 (FR-5.5): separate the Pro-tier, history-informed learning
-- explanation from the food-safety `advertencias` array (FR-2.10/FR-8.2),
-- which shared the same flat string[] with no discriminator (see FRESCO-21
-- for the full trace of why that conflation existed).

alter table public.meal_plans
  add column explicacion_aprendizaje text;

comment on column public.meal_plans.explicacion_aprendizaje is
  'FR-5.5: 2-3 first-person-plural sentences explaining a Pro-tier, history-informed menu adjustment. NULL when the user is Free, or Pro with no real history yet (first week) -- never a generic placeholder. Kept separate from advertencias (FR-2.10/FR-8.2 safety warnings) so the two render in distinct UI components (FRESCO-22).';
