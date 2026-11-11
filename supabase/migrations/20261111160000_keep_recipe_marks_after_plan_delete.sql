-- FRESCO-1184 (integral review C1): the "cocinada" and "descartada" marks of a week outlive that week.
--
-- The marks lived only in `meal_plan_recipes`, so deleting a week, or copying a menu over a week that already
-- has one (`copy_meal_plan_to_week` deletes the destination plan first), erased them in cascade. The recipes the
-- person had just marked could come back the next week, and the history lost weight, against the promise
-- "lo que marcas no vuelve a salir durante 2 semanas" (components/calendar/learning-bridge-card.tsx).
--
-- Decision (owner, 2026-11-11): keep the marks in a table of their own. Every plan that is about to be deleted
-- archives its decisive marks into `recipe_mark_history`, and the three functions that read marks read the live
-- ones and the archived ones. Nothing that writes marks changes: the live table stays the source of truth while
-- the week exists, and the history only receives rows at the moment a plan goes.
--
-- Account deletion: `meal_plans.user_id` cascades from `user_profiles`, so deleting an account deletes its plans
-- and would fire the archive for a person who is leaving. The trigger skips when the profile is already gone
-- (the cascade runs after the parent row was deleted), and the history's own FK on `user_profiles` removes
-- anything that could remain: the history never outlives the account (GDPR art. 17).

create table public.recipe_mark_history (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),

  user_id      uuid not null references public.user_profiles(id) on delete cascade,
  -- A deleted catalogue recipe has nothing left to exclude or score.
  recipe_id    uuid not null references public.recipes(id) on delete cascade,
  estado       public.estado_receta_menu not null check (estado in ('cocinada', 'descartada')),
  -- Monday of the week the mark was made in: the 2-week no-repeat window counts from it, like the live marks.
  fecha_inicio date not null
);

comment on table public.recipe_mark_history is
  'FRESCO-1184: the cocinada/descartada marks of weeks that were deleted or overwritten, archived by meal_plans_archive_marks. Read only through get_recent_recipe_marks, get_user_cooked_recipe_ids and get_user_recipe_engagement; closed to every client role.';

create index idx_recipe_mark_history_user_week on public.recipe_mark_history (user_id, fecha_inicio);
create index idx_recipe_mark_history_recipe_id on public.recipe_mark_history (recipe_id);

-- Closed to every client role: no policy, and no table privilege either. The definer functions below read it.
alter table public.recipe_mark_history enable row level security;
alter table public.recipe_mark_history force row level security;
revoke all on public.recipe_mark_history from public, anon, authenticated;
-- The service role has no default privileges on new tables in this project: read access lets support and the
-- integration tests see what was archived. It never writes it; only the trigger function does.
grant select on public.recipe_mark_history to service_role;

-- ── Archive before a plan is deleted ────────────────────────────────────────────────────────────────────────
create function public.archive_recipe_marks_before_plan_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Account deletion cascades through user_profiles: the profile row is already gone here, and so must the marks be.
  if not exists (select 1 from public.user_profiles where id = old.user_id) then
    return old;
  end if;

  insert into public.recipe_mark_history (user_id, recipe_id, estado, fecha_inicio)
  select old.user_id, mpr.recipe_id, mpr.estado, old.fecha_inicio
  from public.meal_plan_recipes mpr
  where mpr.meal_plan_id = old.id
    and mpr.estado in ('cocinada', 'descartada');

  return old;
end;
$$;

comment on function public.archive_recipe_marks_before_plan_delete() is
  'FRESCO-1184: trigger function of meal_plans_archive_marks. Never callable by a client; runs as the owner so it can write the closed history table whoever deletes the plan.';

-- A trigger function is not an RPC: nobody calls it by name.
revoke execute on function public.archive_recipe_marks_before_plan_delete() from public, anon, authenticated, service_role;

create trigger meal_plans_archive_marks
  before delete on public.meal_plans
  for each row execute function public.archive_recipe_marks_before_plan_delete();

-- ── The three readers see the live marks and the archived ones ─────────────────────────────────────────────
-- Same signatures, same ownership check (`p_user_id = auth.uid()`, ADR-0001), same grants (create or replace keeps them).

create or replace function public.get_recent_recipe_marks(
  p_user_id uuid,
  p_weeks   integer default 2
)
returns table(recipe_id uuid, estado public.estado_receta_menu) as $$
  -- A recipe can appear more than once in the window with different marks (cocinada one week, descartada
  -- another): collapse to the most decisive signal, descartada > cocinada > pendiente/sustituida.
  select distinct on (m.recipe_id)
    m.recipe_id,
    m.estado
  from (
    select mpr.recipe_id, mpr.estado
    from public.meal_plan_recipes mpr
    join public.meal_plans mp on mp.id = mpr.meal_plan_id
    where mp.user_id = p_user_id
      and mp.user_id = auth.uid()
      and mp.fecha_inicio >= current_date - (p_weeks * 7)
    union all
    select h.recipe_id, h.estado
    from public.recipe_mark_history h
    where h.user_id = p_user_id
      and h.user_id = auth.uid()
      and h.fecha_inicio >= current_date - (p_weeks * 7)
  ) m
  order by m.recipe_id,
    case m.estado
      when 'descartada' then 1
      when 'cocinada' then 2
      else 3
    end
$$ language sql stable security definer set search_path = public;

create or replace function public.get_user_cooked_recipe_ids(
  p_user_id uuid
)
returns uuid[] as $$
  select array_agg(distinct m.recipe_id)
  from (
    select mpr.recipe_id
    from public.meal_plan_recipes mpr
    join public.meal_plans mp on mp.id = mpr.meal_plan_id
    where mp.user_id = p_user_id
      and mp.user_id = auth.uid()
      and mpr.estado = 'cocinada'
    union all
    select h.recipe_id
    from public.recipe_mark_history h
    where h.user_id = p_user_id
      and h.user_id = auth.uid()
      and h.estado = 'cocinada'
  ) m
$$ language sql stable security definer set search_path = public;

create or replace function public.get_user_recipe_engagement(
  p_user_id uuid
)
returns table(
  recipe_id uuid,
  veces_cocinada_usuario integer,
  veces_descartada_usuario integer
) as $$
  select
    m.recipe_id,
    count(*) filter (where m.estado = 'cocinada')::integer as veces_cocinada_usuario,
    count(*) filter (where m.estado = 'descartada')::integer as veces_descartada_usuario
  from (
    select mpr.recipe_id, mpr.estado
    from public.meal_plan_recipes mpr
    join public.meal_plans mp on mp.id = mpr.meal_plan_id
    where mp.user_id = p_user_id
      and mp.user_id = auth.uid()
      and mpr.estado in ('cocinada', 'descartada')
    union all
    select h.recipe_id, h.estado
    from public.recipe_mark_history h
    where h.user_id = p_user_id
      and h.user_id = auth.uid()
  ) m
  group by m.recipe_id
$$ language sql stable security definer set search_path = public;
