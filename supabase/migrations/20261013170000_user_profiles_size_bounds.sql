-- FRESCO-914 (definitive audit C-10): `user_profiles` had no size or cardinality limit on what the
-- client writes. Anonymous sign-in is free and unattended (ADR-0003), so a guest could store
-- megabytes in one row, and `get_filtered_recipes` unnests `ingredientes_odiados` once per recipe,
-- so a huge array multiplies the cost of every catalogue read.
--
-- Same pattern as FRESCO-799 (20261005073630_client_write_quotas...): CHECKs on the logical size of
-- the columns the client can write. Measured read-only on the linked project before writing this
-- (3 profiles): at most 4 allergens, 1 disliked ingredient, 0 favourites, a 11-character name, empty
-- free-text fields and a 298-byte `planning_selection`, so every constraint is added validated.
--
-- The audit proposed "30 elements of 60 characters". It is applied as a TOTAL cap on the joined text
-- (30 elements, 2400 bytes: 60 characters of up to 4 bytes, plus separators), like `recetas_propias`
-- in FRESCO-799, which needs no helper function and bounds the cost the same way. The free-text
-- columns get 500 characters: the audit names the fields but gives no value, so that one is a choice.
-- `cocinas_favoritas` is an enum array that can repeat a value, so it gets the same 30-element cap.

alter table public.user_profiles
  add constraint user_profiles_lists_bounds
    check (
      cardinality(alergenos) <= 30
      and octet_length(array_to_string(alergenos, ' ')) <= 2400
      and cardinality(ingredientes_odiados) <= 30
      and octet_length(array_to_string(ingredientes_odiados, ' ')) <= 2400
      and cardinality(ingredientes_favoritos) <= 30
      and octet_length(array_to_string(ingredientes_favoritos, ' ')) <= 2400
      and cardinality(cocinas_favoritas) <= 30
    ),
  add constraint user_profiles_text_bounds
    check (
      char_length(nombre) <= 80
      and char_length(dieta_texto_libre) <= 500
      and char_length(alergenos_texto_libre) <= 500
      and char_length(ingredientes_odiados_texto_libre) <= 500
      and char_length(cocinas_texto_libre) <= 500
    ),
  add constraint user_profiles_planning_selection_bounds
    check (jsonb_typeof(planning_selection) = 'object' and octet_length(planning_selection::text) <= 4096);
