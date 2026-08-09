-- Reverts FRESCO-139's `source` column. The Food.com Kaggle recipe
-- migration (FRESCO-138) was abandoned before Stage 2 ever ran — the
-- column was always null on every row (no external-sourced recipe was
-- ever inserted). Dropping it rather than leaving a vestigial unused
-- column now that the feature it supported is gone. See FRESCO-138's
-- Jira comment for the reversion rationale.

alter table public.recipes
  drop column source;
