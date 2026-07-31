-- FR-8.2 / AC Scenario 4 (FRESCO-23): a slot the model correctly flagged as
-- having no safe recipe for the user's restrictions must still be persisted
-- (paired with its advertencia), not block the whole menu. `recipe_id` needs
-- to allow null to represent that slot; the FK's `on delete restrict` is
-- unaffected by this change.
alter table public.meal_plan_recipes alter column recipe_id drop not null;
