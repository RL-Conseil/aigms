-- =============================================================================
-- AIGMS — 0034 — La personne appelée à se prononcer
-- =============================================================================
-- Une décision soumise n'était adressée à personne : elle attendait qu'un rôle
-- habilité la trouve dans le registre. Sur une organisation qui en compte
-- plusieurs, cela revient à ne la confier à personne.
--
-- `expected_approver_user_id` désigne QUI est appelé à trancher. C'est une
-- adresse, pas un droit : elle n'autorise rien, ne remplace pas la RLS, et ne
-- dispense pas de la séparation des rôles.
--
-- CE QUE CETTE COLONNE N'EST PAS, et pourquoi c'est important : elle ne permet
-- pas de consigner une approbation au nom d'un tiers. `approver_user_id` reste
-- renseigné par celui qui se prononce, et `app.guard_decision_approval` refuse
-- toujours que l'auteur approuve une mise en production, une acceptation de
-- risque ou une exception. Laisser choisir l'approbateur dans une liste
-- reviendrait à laisser quiconque enregistrer l'accord d'un autre — ce qui
-- viderait le registre de sa valeur.
-- =============================================================================

alter table public.governance_decision
  add column expected_approver_user_id uuid references public.user_profile (id) on delete set null;

comment on column public.governance_decision.expected_approver_user_id is
  'Personne appelee a se prononcer. Une adresse, pas un droit : elle n''autorise rien et ne dispense pas de la separation des roles. L''approbation reste enregistree au nom de celui qui la prononce.';

create index governance_decision_expected_approver_idx
  on public.governance_decision (expected_approver_user_id)
  where expected_approver_user_id is not null;

-- Le destinataire pressenti ne peut pas etre l'auteur sur les decisions ou la
-- separation s'applique : l'adresser a soi-meme serait annoncer un refus.
create or replace function app.guard_expected_approver()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if new.expected_approver_user_id is not null
     and new.decision_type in ('go_production', 'risk_acceptance', 'policy_exception')
     and new.expected_approver_user_id = coalesce(new.submitted_by, app.current_user_id()) then
    raise exception 'Sur ce type de décision, l''auteur ne peut pas être la personne appelée à se prononcer.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger governance_decision_guard_expected_approver
  before insert or update on public.governance_decision
  for each row execute function app.guard_expected_approver();
