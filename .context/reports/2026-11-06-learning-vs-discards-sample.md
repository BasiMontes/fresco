# FRESCO-1026: does learning from marks reduce discards? Sample check, 2026-11-06

**Verdict: the sample does not exist yet, so the question cannot be answered.** The ticket stays deferred. This report records the numbers, the sample the analysis needs and the query to rerun it, so the day there are users nobody has to rebuild any of it.

## The question

In Free, the "cocinado" and "descartado" marks are stored but not applied to the menu (`components/calendar/learning-bridge-card.tsx`). In Pro they are (`supabase/functions/generate-meal-plan/index.ts`, `get_recent_recipe_marks`, `engagement.cocinada` and `engagement.descartada` in `menu-selector.ts`). The ticket proposes using that difference as a control group: compare the discard rate of the week after a mark between Pro and Free users.

## What the production database holds today (read-only, aggregates only)

Queried on 2026-11-06 through the Supabase MCP, joining `meal_plan_recipes`, `meal_plans`, `user_profiles` and `auth.users`. Test accounts are the `@test.local`, `hola.frescoapp+…` and `example.com` addresses, plus anonymous guests.

| Group | Profiles | Of them, real and registered | Users with marks | User-weeks with marks | Cocinadas | Descartadas |
|---|---|---|---|---|---|---|
| Free | 7 | 0 | 3 (all test accounts) | 5 | 19 | 5 |
| Pro | 0 | 0 | 0 | 0 | 0 | 0 |

There are no Pro users and no real users. The only marks come from test accounts that exercise the app, so even the 5 of 24 (21 %) discard rate among them says nothing about real behaviour.

## What a conclusive analysis needs

A rough power estimate, to be replaced by real numbers once there is a baseline:

- Test: two proportions, alpha 0.05, power 0.8. Assumed baseline discard rate 20 % and a reduction to 15 % (a 25 % relative drop) as the smallest effect worth acting on. The 20 % is a placeholder, not data.
- Without clustering that is about 900 marks per group.
- Marks are clustered by user. With about 10 marks per user-week and an intra-user correlation of 0.1 the design effect is about 1.9, which gives about 1,700 marks per group, or about 170 user-weeks per group.
- In practice: about 40 to 45 Pro users and 40 to 45 Free users marking recipes for 4 weeks each.

## A design caveat to decide before collecting

Free against Pro is **not randomised**. People who pay differ from people who do not, so a difference in discards could come from who they are and not from the learning. Two cleaner options, to be chosen when the data exists:

1. Randomise inside Pro with a feature flag that switches the learning off for half of the Pro users.
2. Read only the within-user change in Pro (the discard rate before and after the learning had a mark to use).

## Query to rerun it (aggregates only, no personal data)

```sql
select up.plan::text as plan,
       count(distinct mp.user_id) as users_with_marks,
       count(distinct (mp.user_id, mp.semana_iso)) as user_weeks,
       count(*) filter (where mpr.estado = 'cocinada') as cocinadas,
       count(*) filter (where mpr.estado = 'descartada') as descartadas
from public.meal_plan_recipes mpr
join public.meal_plans mp on mp.id = mpr.meal_plan_id
join public.user_profiles up on up.id = mp.user_id
left join auth.users u on u.id = mp.user_id
where mpr.estado in ('cocinada', 'descartada')
  and coalesce(u.email, '') not like '%@test.local'
  and coalesce(u.email, '') not like 'hola.frescoapp+%'
  and coalesce(u.email, '') not like '%example.com'
  and coalesce(u.is_anonymous, false) = false
group by 1 order by 1;
```

The PostHog events named in the ticket (`menu_generation_completed`, `recipe_marked_cooked`, `recipe_marked_discarded`) give the same counts per week once real users exist; the database query is enough to know when the sample is there.

## Decision recorded

- The moat is **not demonstrated**: there is no data, not a negative result.
- The descriptions on the landing say what the engine does (marked recipes do not come back, cooked ones gain weight, each menu carries a note), and `landing-claims.test.ts` ties each of those lines to code. **Three lines go further and promise an outcome that this analysis cannot yet support:** "Cada semana mejora contigo" (`components/landing/how-it-works.tsx`), the "Te acierta más" title of the Semana 4 node (`components/landing/learns-pro.tsx`) and "Fresco aprende de ti. Cada semana mejor que la anterior." (`components/landing/pricing.tsx`). They mean "better menus for you", which is exactly what the premortem of 2026-10-20 found unproven. Not changed today: rewording public copy is the owner's call. Options: keep them as product intent, or say what happens instead of how well ("Cada semana usa lo que marcas").
- Resume FRESCO-1026 when the query above shows at least about 40 Pro and 40 Free users with marks over 4 weeks. The pilot of FRESCO-1030 is the natural source.
