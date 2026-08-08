-- FRESCO-122: 228/1000 recipes had meta->>'dificultad' = 'alta', a value that
-- was never part of the DificultadReceta enum (muy_facil|facil|media|avanzada,
-- api/schemas/recipe.types.ts). Since `meta` is jsonb, not a typed Postgres
-- enum, this drift was invisible to TypeScript and rendered as a blank
-- difficulty label everywhere DIFICULTAD_LABELS was looked up.
update recipes
set meta = jsonb_set(meta, '{dificultad}', '"avanzada"')
where meta->>'dificultad' = 'alta';
