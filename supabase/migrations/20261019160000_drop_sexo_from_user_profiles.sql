-- FRESCO-1008 (audit 7b A7-PRIV-04): `user_profiles.sexo` was collected at onboarding
-- (FRESCO-132) as "signal for recommendations", but nothing reads it: no recipe, plan or
-- calculation uses it, and the privacy policy does not list it. Data minimisation (GDPR
-- art. 5.1.c): stop collecting it and delete what was collected. The column goes first,
-- then the enum type that only it used.

alter table public.user_profiles drop column sexo;
drop type public.sexo_usuario;
