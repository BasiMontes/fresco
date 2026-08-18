alter table public.user_profiles
  add column aviso_bienvenida_visto boolean not null default false;

comment on column public.user_profiles.aviso_bienvenida_visto is
  'FRESCO-224: whether the Centro de Avisos welcome notice has been shown to this user.';
