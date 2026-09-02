-- FRESCO-382 (audit-4 A4-M4): `user_profiles.num_personas` / `adultos` /
-- `ninos` only had lower-bound CHECKs (`> 0`, `>= 0`, `adultos <= num_personas`
-- from 20260725120100). Nothing capped the top end, so a client writing
-- directly through RLS (`.update()`) could persist e.g. `num_personas = 20000`
-- (fits `smallint`, passes `> 0`). `generate-shopping-list` scales every
-- ingredient quantity by that value -> an unusable list.
--
-- Add upper-bound CHECKs mirroring the onboarding client cap
-- (`HOUSEHOLD_FIELD_MAX = 10` in `lib/validation/onboarding.ts`). All existing
-- rows are within range (max observed 2/2/0), so the constraints validate
-- without a data fix. `generate-shopping-list` also clamps defensively.

alter table public.user_profiles
  add constraint check_num_personas_max check (num_personas <= 10),
  add constraint check_adultos_max     check (adultos <= 10),
  add constraint check_ninos_max       check (ninos <= 10);
