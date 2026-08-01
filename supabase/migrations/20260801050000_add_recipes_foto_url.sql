-- Real recipe photography (Unsplash API, free tier) — P1 deferral from
-- master-implementation-plan.md resolved without budget: stock photos
-- matched by category keyword, not the founder shooting/curating originals.
alter table public.recipes add column if not exists foto_url text;
