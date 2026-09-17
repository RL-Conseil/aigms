-- =============================================================================
-- AIGMS — 0055 — Les « A » du RACI, appliqués par la base
-- =============================================================================
-- Le RACI des six rôles (0054, docs/admin/ROLES_ET_RACI.md) donnait deux
-- « A » que les droits ne portaient pas :
--
--   3. Validation des contrôles — A : Expert métier (DPO / RSSI) et Comité
--      des risques. Jusqu'ici, quiconque déposait une preuve pouvait la
--      valider, le Porteur de l'IA compris : il attestait de sa propre pièce.
--
--   4. Arbitrage IA critique — A : Comité de direction. Jusqu'ici, ce rôle
--      lisait sans jamais écrire, et n'importe quel relecteur approuvait une
--      mise en production critique.
--
-- Ce que la migration pose :
--
--   * `app.roles_validate_evidence()` — qui prononce la validité d'une preuve :
--     l'AI Governance Officer (il reste le pilote), l'Expert métier, le Comité
--     des risques. Le Porteur de l'IA dépose ; il ne valide plus. L'Expert et
--     le Comité, qui n'écrivent pas de preuve, obtiennent une politique de
--     mise à jour limitée à l'acte de validation : rien d'autre ne bouge.
--
--   * `app.roles_arbitrate()` — le Comité de direction. Il peut désormais se
--     prononcer sur une décision SOUMISE — approuver, sous conditions ou non,
--     rejeter — sans pouvoir en soumettre ni en réécrire une. Et l'arbitrage
--     critique lui REVIENT : une mise en production (`go_production`) d'un cas
--     d'usage de criticité élevée ou critique, et toute exception à une
--     politique (`policy_exception`), ne s'approuvent que par quelqu'un qui
--     tient ce rôle sur l'organisation.
--
-- Les deux règles portent sur l'ACTE — valider, approuver — fait par une
-- personne authentifiée. Une reprise de données ou un import CONNECT, sans
-- utilisateur, verse des décisions et des validations faites ailleurs ; le
-- journal dit alors qui les a versées.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ensembles de rôles
-- -----------------------------------------------------------------------------
create or replace function app.roles_validate_evidence()
returns app.app_role[]
language sql immutable set search_path = pg_catalog as $$
  select array['governance_officer', 'client_admin', 'reviewer', 'risk_owner']::app.app_role[];
$$;

comment on function app.roles_validate_evidence is
  'Rôles qui prononcent la validité d''une preuve (RACI, étape 3 : Expert métier et Comité des risques en « A », l''AI Governance Officer pilote). Le Porteur de l''IA dépose, il ne valide pas.';

create or replace function app.roles_arbitrate()
returns app.app_role[]
language sql immutable set search_path = pg_catalog as $$
  select array['executive_viewer']::app.app_role[];
$$;

comment on function app.roles_arbitrate is
  'Le Comité de direction : se prononce sur une décision soumise, et seul habilité à approuver une mise en production critique ou une exception à une politique (RACI, étape 4).';

grant execute on function app.roles_validate_evidence(), app.roles_arbitrate() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Validation des preuves
-- -----------------------------------------------------------------------------
-- L'Expert et le Comité des risques n'écrivent pas de preuve : une politique
-- de mise à jour leur ouvre la ligne, et le garde restreint ce qu'ils touchent.
create policy evidence_validate on public.evidence
  for update to authenticated
  using (app.has_tenant_role(tenant_id, app.roles_validate_evidence()))
  with check (app.has_tenant_role(tenant_id, app.roles_validate_evidence()));

create or replace function app.guard_evidence_file()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_expected_prefix text;
  v_old public.evidence%rowtype;
  v_new public.evidence%rowtype;
  v_validating boolean;
begin
  if new.storage_path is not null then
    v_expected_prefix := new.tenant_id || '/' || new.organization_id || '/';
    if left(new.storage_path, length(v_expected_prefix)) <> v_expected_prefix then
      raise exception 'Le chemin de stockage doit commencer par « % ». Il est dérivé, jamais saisi.', v_expected_prefix
        using errcode = 'check_violation';
    end if;
  end if;

  -- Une preuve validée est figée. La corriger reviendrait à changer, après
  -- coup, ce qu'un validateur nommé a déclaré avoir examiné.
  if tg_op = 'UPDATE' and old.validation_status = 'validated' then
    if new.storage_path is distinct from old.storage_path
       or new.content_hash is distinct from old.content_hash
       or new.file_size_bytes is distinct from old.file_size_bytes then
      raise exception 'Le fichier d''une preuve validée ne se remplace pas. Déposer une nouvelle preuve, celle-ci devenant « remplacée ».'
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'UPDATE' and app.current_user_id() is not null then
    -- L'acte de validation : le passage à « validée » ou « rejetée ».
    v_validating := new.validation_status in ('validated', 'rejected')
                    and old.validation_status is distinct from new.validation_status;

    if v_validating then
      -- La validation est un acte nominatif : on valide en son propre nom.
      if new.validation_status = 'validated'
         and new.validated_by is distinct from app.current_user_id() then
        raise exception 'Une preuve se valide en son propre nom.'
          using errcode = 'check_violation';
      end if;
      -- Et un acte réservé : le Porteur de l'IA dépose, il ne valide pas.
      if not app.has_tenant_role(new.tenant_id, app.roles_validate_evidence()) then
        raise exception 'La validité d''une preuve se prononce par l''AI Governance Officer, l''Expert métier ou le Comité des risques — pas par la personne qui la dépose.'
          using errcode = 'insufficient_privilege';
      end if;
    end if;

    -- Qui ne fait que valider ne touche à rien d'autre.
    if not app.has_tenant_role(new.tenant_id, app.roles_contribute()) then
      v_old := old; v_new := new;
      v_old.validation_status := null; v_new.validation_status := null;
      v_old.validated_by := null;      v_new.validated_by := null;
      v_old.validated_at := null;      v_new.validated_at := null;
      v_old.updated_at := null;        v_new.updated_at := null;
      if v_new is distinct from v_old then
        raise exception 'Ce rôle prononce la validité d''une preuve ; il ne la modifie pas.'
          using errcode = 'insufficient_privilege';
      end if;
    end if;
  end if;

  return new;
end;
$$;

comment on function app.guard_evidence_file is
  'Chemin de stockage confiné au tenant, fichier figé après validation, validation nominative et réservée aux rôles qui la prononcent (0055).';

-- -----------------------------------------------------------------------------
-- 4. Arbitrage des décisions
-- -----------------------------------------------------------------------------
-- Le Comité de direction se prononce ; il ne soumet ni ne réécrit.
create policy governance_decision_arbitrate on public.governance_decision
  for update to authenticated
  using (app.has_tenant_role(tenant_id, app.roles_arbitrate()))
  with check (app.has_tenant_role(tenant_id, app.roles_arbitrate()));

-- Les rôles d'une PERSONNE sur une organisation — pas de l'utilisateur
-- courant : l'approbateur nommé n'est pas toujours celui qui écrit.
create or replace function app.user_organization_roles(p_user_id uuid, p_organization_id uuid)
returns app.app_role[]
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select coalesce(
    (select array_agg(distinct r.role)
       from public.role_assignment r
      where r.organization_id = p_organization_id and r.user_id = p_user_id
        and r.valid_from <= now() and (r.valid_until is null or r.valid_until > now())),
    (select array[m.role]
       from public.organization o
       join public.membership m on m.tenant_id = o.tenant_id and m.user_id = p_user_id and m.status = 'active'
      where o.id = p_organization_id),
    array[]::app.app_role[]
  );
$$;

-- Une décision d'arbitrage critique : mise en production d'un cas d'usage
-- élevé ou critique, ou exception à une politique.
create or replace function app.decision_is_critical_arbitration(p_decision public.governance_decision)
returns boolean
language sql stable
set search_path = app, public, pg_catalog
as $$
  select p_decision.decision_type = 'policy_exception'
      or (p_decision.decision_type = 'go_production'
          and exists (select 1 from public.ai_use_case u
                       where u.id = p_decision.use_case_id
                         and u.criticality in ('high', 'critical')));
$$;

create or replace function app.guard_decision_arbitration()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_old public.governance_decision%rowtype;
  v_new public.governance_decision%rowtype;
  v_approving boolean;
begin
  if app.current_user_id() is null then return new; end if;

  v_approving := new.status in ('approved', 'approved_with_conditions')
                 and (tg_op = 'INSERT' or old.status not in ('approved', 'approved_with_conditions'));

  -- L'arbitrage critique revient au Comité de direction : l'approbateur le tient.
  if v_approving and app.decision_is_critical_arbitration(new)
     and not (app.user_organization_roles(new.approver_user_id, new.organization_id) && app.roles_arbitrate()) then
    raise exception 'Arbitrage IA critique : cette décision (%) s''approuve par le Comité de direction.', new.decision_type
      using errcode = 'insufficient_privilege';
  end if;

  -- Qui ne fait qu'arbitrer se prononce sur une décision soumise, et rien d'autre.
  if tg_op = 'UPDATE'
     and not app.has_tenant_role(new.tenant_id, app.roles_review()) then
    if old.status <> 'submitted'
       or new.status not in ('approved', 'approved_with_conditions', 'rejected') then
      raise exception 'Le Comité de direction se prononce sur une décision soumise : il ne la réécrit pas.'
        using errcode = 'insufficient_privilege';
    end if;
    v_old := old; v_new := new;
    v_old.status := null;           v_new.status := null;
    v_old.approver_user_id := null; v_new.approver_user_id := null;
    v_old.approved_at := null;      v_new.approved_at := null;
    v_old.conditions := null;       v_new.conditions := null;
    v_old.rationale := null;        v_new.rationale := null;
    v_old.effective_from := null;   v_new.effective_from := null;
    v_old.review_due_at := null;    v_new.review_due_at := null;
    v_old.updated_at := null;       v_new.updated_at := null;
    if v_new is distinct from v_old then
      raise exception 'Le Comité de direction se prononce sur une décision soumise : il ne la réécrit pas.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

comment on function app.guard_decision_arbitration is
  'RACI, étape 4 : une mise en production critique ou une exception s''approuve par le Comité de direction ; ce rôle ne fait que se prononcer sur une décision soumise.';

create trigger governance_decision_guard_arbitration
  before insert or update on public.governance_decision
  for each row execute function app.guard_decision_arbitration();

-- -----------------------------------------------------------------------------
-- Matrice des capacités : deux lignes de plus, calculées comme les autres
-- -----------------------------------------------------------------------------
create or replace function app.role_capabilities()
returns jsonb
language sql
stable
set search_path = app, public, pg_catalog
as $$
  with everyone as (
    select enum_range(null::app.app_role) as roles
  ),
  caps(display_order, "group", key, label, roles, note) as (
    values
      -- ---- Administration ------------------------------------------------
      (10, 'Administration', 'organizations',
       'Créer et administrer les organisations',
       app.roles_administer(),
       'Nom, rôle vis-à-vis de l''IA, identité des documents, logo. Aucune suppression : une organisation s''archive.'),
      (11, 'Administration', 'accounts',
       'Déclarer les comptes et attribuer les rôles',
       app.roles_administer(), null),
      (12, 'Administration', 'catalog',
       'Importer et publier un référentiel de contrôles',
       app.roles_administer(), null),
      (13, 'Administration', 'platform',
       'Régler la marque et les connecteurs',
       app.roles_administer(), null),

      -- ---- Registre ------------------------------------------------------
      (20, 'Registre', 'processes',
       'Cartographier les processus et leurs activités',
       app.roles_write_governance(), null),
      (21, 'Registre', 'use_cases',
       'Déclarer un usage d''IA, un actif',
       app.roles_contribute(), null),
      (22, 'Registre', 'vendors',
       'Déclarer un fournisseur et conduire sa revue',
       app.roles_write_governance(), null),
      (23, 'Registre', 'classification',
       'Qualifier et classifier au regard du règlement',
       app.roles_write_governance(), null),
      (24, 'Registre', 'transitions',
       'Faire franchir les étapes du cycle de vie (gates)',
       app.roles_write_governance(),
       'Le gate décide ; le rôle ne fait que demander.'),

      -- ---- Risques -------------------------------------------------------
      (30, 'Risques', 'risks',
       'Coter les risques, décider du traitement, porter une acceptation',
       app.roles_risk(), null),
      (31, 'Risques', 'impact',
       'Évaluer l''impact, planifier la supervision humaine',
       app.roles_write_governance(), null),

      -- ---- Contrôles et preuves -----------------------------------------
      (40, 'Contrôles et preuves', 'controls',
       'Définir les contrôles et statuer sur leur applicabilité',
       app.roles_write_governance(), null),
      (41, 'Contrôles et preuves', 'evidence',
       'Déposer une preuve et la rattacher',
       app.roles_contribute(), null),
      (42, 'Contrôles et preuves', 'evidence_validation',
       'Prononcer la validité d''une preuve',
       app.roles_validate_evidence(),
       'RACI, étape 3 : le Porteur de l''IA dépose, il ne valide pas. La validation reste nominative.'),
      (43, 'Contrôles et preuves', 'soa',
       'Établir la Déclaration d''Applicabilité',
       app.roles_write_governance(), null),

      -- ---- Décisions et suivi -------------------------------------------
      (50, 'Décisions et suivi', 'decisions',
       'Soumettre une décision et se prononcer',
       app.roles_review(),
       'Séparation des rôles : l''auteur d''une mise en production, d''une acceptation de risque ou d''une exception ne peut pas l''approuver, quel que soit son rôle.'),
      (51, 'Décisions et suivi', 'arbitration',
       'Arbitrer : se prononcer sur une décision soumise, approuver une mise en production critique ou une exception',
       app.roles_arbitrate(),
       'RACI, étape 4 : une mise en production d''un cas d''usage élevé ou critique, et toute exception à une politique, ne s''approuvent que par ce rôle. Il ne soumet pas.'),
      (52, 'Décisions et suivi', 'operations',
       'Ouvrir une action, un incident, une demande de changement',
       app.roles_contribute(), null),
      (53, 'Décisions et suivi', 'capa',
       'Conduire une action corrective (CAPA), réévaluer',
       app.roles_write_governance(), null),

      -- ---- Lecture -------------------------------------------------------
      (60, 'Lecture', 'read',
       'Consulter le périmètre : registre, risques, contrôles, preuves, décisions',
       (select roles from everyone), null),
      (61, 'Lecture', 'audit_log',
       'Lire le journal d''audit',
       array['platform_admin', 'governance_officer', 'client_admin', 'auditor']::app.app_role[],
       null)
  )
  select jsonb_agg(
           jsonb_build_object(
             'key',   key,
             'group', "group",
             'label', label,
             'note',  note,
             'roles', to_jsonb(roles)
           )
           order by display_order
         )
  from caps;
$$;
