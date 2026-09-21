-- =============================================================================
-- AIGMS — 0071 — Un plan de supervision par cas d'usage, tout court
-- =============================================================================
-- L'index d'unicité sur le plan était partiel (limité à quatre statuts qui
-- sont… tous les statuts). Une écriture « créer ou remplacer » (ON CONFLICT
-- sur use_case_id) ne peut pas s'appuyer sur un index partiel : « there is
-- no unique or exclusion constraint matching the ON CONFLICT specification ».
-- Un plan par cas d'usage, sans condition.
-- =============================================================================
drop index if exists public.human_oversight_plan_active_idx;
alter table public.human_oversight_plan
  add constraint human_oversight_plan_use_case_key unique (use_case_id);
