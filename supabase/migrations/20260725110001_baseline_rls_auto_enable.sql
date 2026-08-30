-- ─────────────────────────────────────────────────────────────────────────────
-- FRESCO-310 — Baseline: reconstruct the pre-migration `public.rls_auto_enable()`
-- event-trigger function.
--
-- WHY THIS EXISTS
-- Like `public.recipes` (see 20260725110000), this function was created on the
-- production project by the hand-run `schema_supabase.sql`, before the tracked
-- migration history began. `20260801010000_harden_security_definer_functions.sql`
-- does `revoke execute on function public.rls_auto_enable() from ...`, which
-- fails with `function public.rls_auto_enable() does not exist` on a fresh
-- database — blocking `supabase db reset`.
--
-- The function is an event-trigger callback that auto-enables RLS on any new
-- table created in `public`. Every table-creating migration in this repo also
-- enables RLS explicitly, so the event trigger is belt-and-braces, not a
-- dependency — but it is reproduced here (function + event trigger) to match the
-- production database exactly. The body swallows every exception, so it can
-- never fail a later migration.
--
-- PRODUCTION: registered as already-applied, never run there:
--   supabase migration repair --status applied 20260725110001
-- Idempotent (OR REPLACE / catalog guard) — safe to re-run anywhere.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null
       and cmd.schema_name in ('public')
       and cmd.schema_name not in ('pg_catalog', 'information_schema')
       and cmd.schema_name not like 'pg_toast%'
       and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'rls_auto_enable') then
    create event trigger rls_auto_enable
      on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
  end if;
end $$;
