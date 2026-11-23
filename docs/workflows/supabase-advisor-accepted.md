# Supabase security advisor: accepted warnings

FRESCO-1277 (audit 10, finding F7). The Supabase security advisor of the hosted project reports warnings that are all intentional. Without a record, every audit and every agent that reads the advisor investigates them again. This page says which families are accepted and why, and gives for each one a read-only query whose result is empty while the reason still holds.

How to use it:

1. Read the advisor (the read-only Supabase MCP `get_advisors` with type `security`, or the Security Advisor in the dashboard).
2. A finding of a family below is accepted only while its check query returns **no rows**. A row is a regression: investigate it.
3. A finding of a family that is not below is new: investigate, then either fix it or add its family here with the reason and a check.

The page lists families and invariants, never the current count or the table names, because those change with every migration (the advisor and the queries are the source of truth). The queries are read-only and run through `execute_sql`; they touch no data.

## `authenticated_security_definer_function_executable` (WARN)

**Accepted because** every `SECURITY DEFINER` function in `public` that a signed-in user can call filters by `auth.uid()` in its body, and `anon` cannot execute it. The function is the access path on purpose (the table is not directly writable for that operation), and `auth.uid()` is what decides whose rows it touches; the rule for writing such a function is `.agents/skills/sprint-development/references/rpc-authorization.md`.

```sql
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and has_function_privilege('authenticated', p.oid, 'execute')
  and (pg_get_functiondef(p.oid) !~ 'auth\.uid\(\)' or has_function_privilege('anon', p.oid, 'execute'));
```

## `auth_allow_anonymous_sign_ins` (WARN)

**Accepted because** a guest (ADR-0003) signs in anonymously and gets the `authenticated` role with an `is_anonymous` claim, so the advisor flags every policy `TO authenticated`. Those policies are either own-row (`auth.uid()` in the check or the filter) or `SELECT`-only on shared catalog tables (supermarket data and the ingredient-to-product match), which hold no personal data. The two `cron` tables it also lists belong to the `pg_cron` extension; `anon` and `authenticated` have no `USAGE` on the `cron` schema, so the API roles cannot reach them.

```sql
-- policies TO authenticated that are neither own-row nor a SELECT on the shared catalog tables
select tablename || '.' || policyname as policy
from pg_policies
where schemaname = 'public' and roles::text = '{authenticated}'
  and ((cmd <> 'SELECT' and coalesce(qual, '') !~ 'auth\.uid\(\)' and coalesce(with_check, '') !~ 'auth\.uid\(\)')
    or (cmd = 'SELECT' and coalesce(qual, '') !~ 'auth\.uid\(\)'
        and tablename not like 'supermarket\_%' and tablename <> 'ingredient_product_match'));

-- the cron schema stays unreachable for the API roles (both must be false)
select has_schema_privilege('anon', 'cron', 'usage') as anon_usage,
       has_schema_privilege('authenticated', 'cron', 'usage') as authenticated_usage;
```

## `auth_leaked_password_protection` (WARN)

**Accepted because** the hosted feature belongs to the Supabase Pro plan and the project is on the Free plan (ADR-0020). The app reproduces the protection with the Pwned Passwords range API (k-anonymity, only five hash characters leave the browser) in `lib/validation/pwned-password.ts`. It fails open on purpose, as a hygiene nudge. **Revisit** when the project moves to Pro: enable the hosted feature and decide whether the client check stays.

## `rls_enabled_no_policy` (INFO)

**Accepted because** these are tables only the `service_role` touches (rate limits, the Stripe webhook ledger, the waitlist, account erasures, the supermarket price history and similar). RLS with no policy denies every other role, which is what is wanted; the invariant is that neither `anon` nor `authenticated` holds any privilege on them.

```sql
select c.relname
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
  and (has_table_privilege('anon', c.oid, 'select,insert,update,delete')
    or has_table_privilege('authenticated', c.oid, 'select,insert,update,delete'));
```

## Related

- `docs/workflows/hosted-auth-settings.md`: the weekly check of the hosted Auth settings.
- `.context/ADR/ADR-0020-single-supabase-project-until-pro.md`: why the project is on the Free plan.
- `.agents/project.yaml` → `git_strategy.policy.accepted_divergences`: the same pattern for the host's branch rules.
