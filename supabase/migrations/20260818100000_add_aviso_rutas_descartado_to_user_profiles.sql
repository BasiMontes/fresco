alter table public.user_profiles
  add column aviso_rutas_descartado boolean not null default false;

comment on column public.user_profiles.aviso_rutas_descartado is
  'FRESCO-225: whether the Centro de Avisos main-routes notice has been dismissed by this user.';
