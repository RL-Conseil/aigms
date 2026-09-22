-- =============================================================================
-- AIGMS — 0084 — Ce qui expire prévient avant d'expirer
-- =============================================================================
-- Cinq échéances se lisaient sur un écran et n'alertaient personne :
--
--   1. une PREUVE validée qui approche de son échéance — et qui, échue, fait
--      cesser son contrôle de compter dans la couverture ;
--   2. une PREUVE déposée qui attend sa validation — le valideur ne le savait
--      pas ;
--   3. la REVUE d'un cas d'usage, dont la date passe sans que le Porteur en
--      soit averti ;
--   4. la REVUE d'un FOURNISSEUR, alors qu'elle est une précondition de
--      production ;
--   5. la revue d'une ÉTUDE D'IMPACT.
--
-- Les rappels se posent aussi sur le jeu de démonstration : ce sont des
-- alertes, pas des actes de gouvernance — rien ne se contourne en les posant.
--
-- Aucune tâche planifiée : `app.notify` accepte une date d'échéance, et
-- `my_notifications` ne rend que ce qui est dû. Un rappel se pose à l'avance
-- et apparaît le jour venu. Changer la date repose le rappel ; solder l'objet
-- le retire.
-- =============================================================================

-- Qui valide une preuve dans cette organisation : l'AI Governance Officer
-- d'abord, l'Expert métier ensuite (RACI, 0055).
create or replace function app.evidence_validator(p_organization_id uuid)
returns uuid
language sql stable
security definer
set search_path = app, public, pg_catalog
as $$
  select coalesce(
    app.person_for_role(p_organization_id, 'AI Governance Officer'),
    app.person_for_role(p_organization_id, 'Expert métier'));
$$;

-- -----------------------------------------------------------------------------
-- 1 et 2. Les preuves : à valider, bientôt échues, échues
-- -----------------------------------------------------------------------------
create or replace function app.notify_evidence()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_validator uuid;
  v_owner uuid;
  v_href text;
  v_controls text;
begin
  v_href := format('/admin/organizations/%s/preuves?preuve=%s', new.organization_id, new.id);
  v_validator := app.evidence_validator(new.organization_id);
  v_owner := coalesce(new.owner_user_id, v_validator);

  -- Les contrôles que la pièce démontre : c'est ce qui cesse de tenir.
  select string_agg(c.code, ', ' order by c.code) into v_controls
  from public.control_evidence ce join public.control c on c.id = ce.control_id
  where ce.evidence_id = new.id;

  -- Remplacée ou retirée : plus rien à rappeler.
  if new.superseded_by is not null or new.validation_status = 'rejected' then
    perform app.drop_pending_notifications(new.id,
      array['evidence_to_validate', 'evidence_expiring', 'evidence_expired']::app.notification_kind[]);
    return new;
  end if;

  -- 2. En attente : le valideur l'apprend, et cesse de l'apprendre une fois validée.
  if new.validation_status = 'pending' then
    perform app.notify(new.tenant_id, new.organization_id, v_validator, 'evidence_to_validate',
      format('Preuve à valider : %s', new.title),
      format('%s déposée par %s.%s Tant qu''elle n''est pas validée, elle ne fait tenir aucun contrôle.',
             new.business_ref, coalesce(app.person_name(new.owner_user_id), 'un contributeur'),
             case when v_controls is null then '' else format(' Elle démontre %s.', v_controls) end),
      v_href, 'evidence', new.id);
  else
    perform app.drop_pending_notifications(new.id, array['evidence_to_validate']::app.notification_kind[]);
  end if;

  -- 1. Validée avec une échéance : un rappel trente jours avant, un le jour même.
  if new.validation_status = 'validated' and new.valid_until is not null then
    if tg_op = 'INSERT'
       or old.valid_until is distinct from new.valid_until
       or old.validation_status is distinct from new.validation_status then
      perform app.notify(new.tenant_id, new.organization_id, v_owner, 'evidence_expiring',
        format('Preuve bientôt échue : %s', new.title),
        format('%s expire le %s.%s La renouveler avant, sans quoi ce qu''elle démontre cesse de compter.',
               new.business_ref, app.fr_date(new.valid_until),
               case when v_controls is null then '' else format(' Elle démontre %s.', v_controls) end),
        v_href, 'evidence', new.id,
        greatest(now(), (new.valid_until - interval '30 days')::timestamptz));
      perform app.notify(new.tenant_id, new.organization_id, v_owner, 'evidence_expired',
        format('Preuve échue : %s', new.title),
        format('%s a expiré le %s.%s Ce qu''elle démontrait ne compte plus dans la couverture.',
               new.business_ref, app.fr_date(new.valid_until),
               case when v_controls is null then '' else format(' Elle démontrait %s.', v_controls) end),
        v_href, 'evidence', new.id, new.valid_until::timestamptz);
      -- Échue, l'AI Governance Officer le sait aussi : la couverture est son
      -- affaire, et le propriétaire de la pièce a pu quitter l'organisation.
      if v_validator is not null and v_validator <> v_owner then
        perform app.notify(new.tenant_id, new.organization_id, v_validator, 'evidence_expired',
          format('Preuve échue : %s', new.title),
          format('%s (de %s) a expiré le %s.%s',
                 new.business_ref, coalesce(app.person_name(new.owner_user_id), 'sans propriétaire'),
                 app.fr_date(new.valid_until),
                 case when v_controls is null then ' La couverture en tient compte.' else format(' Elle démontrait %s.', v_controls) end),
          v_href, 'evidence', new.id, new.valid_until::timestamptz);
      end if;
    end if;
  else
    perform app.drop_pending_notifications(new.id,
      array['evidence_expiring', 'evidence_expired']::app.notification_kind[]);
  end if;

  return new;
end;
$$;

create trigger evidence_notify
  after insert or update of validation_status, valid_until, superseded_by, owner_user_id on public.evidence
  for each row execute function app.notify_evidence();

-- -----------------------------------------------------------------------------
-- 3. La revue d'un cas d'usage
-- -----------------------------------------------------------------------------
create or replace function app.notify_use_case_review()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare v_who uuid;
begin
  if new.status in ('RETIRED', 'REJECTED') or new.next_review_at is null then
    perform app.drop_pending_notifications(new.id, array['use_case_review_due']::app.notification_kind[]);
    return new;
  end if;
  if tg_op = 'UPDATE' and new.next_review_at is not distinct from old.next_review_at
     and new.status is not distinct from old.status then
    return new;
  end if;
  v_who := coalesce(new.owner_user_id, new.accountable_user_id,
                    app.person_for_role(new.organization_id, 'AI Governance Officer'));
  perform app.notify(new.tenant_id, new.organization_id, v_who, 'use_case_review_due',
    format('Revue attendue : %s', new.name),
    format('%s. La date de revue est atteinte : relire la criticité, la qualification, les risques et la supervision — puis reporter la prochaine date.',
           new.business_ref),
    format('/admin/use-cases/%s', new.id), 'ai_use_case', new.id, new.next_review_at::timestamptz);
  return new;
end;
$$;

create trigger ai_use_case_notify_review
  after insert or update of next_review_at, status, owner_user_id on public.ai_use_case
  for each row execute function app.notify_use_case_review();

-- -----------------------------------------------------------------------------
-- 4. La revue d'un fournisseur — précondition de production
-- -----------------------------------------------------------------------------
create or replace function app.notify_vendor_review()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare v_who uuid;
begin
  v_who := coalesce(app.person_for_role(new.organization_id, 'AI Governance Officer'),
                    app.person_for_role(new.organization_id, 'Expert métier'));
  if new.next_review_at is null then
    perform app.drop_pending_notifications(new.id, array['vendor_review_due']::app.notification_kind[]);
    return new;
  end if;
  if tg_op = 'UPDATE' and new.next_review_at is not distinct from old.next_review_at
     and new.review_status is not distinct from old.review_status then
    return new;
  end if;
  perform app.notify(new.tenant_id, new.organization_id, v_who, 'vendor_review_due',
    format('Revue fournisseur attendue : %s', new.name),
    format('%s. Reprendre la revue — DPA, sécurité, réversibilité, sous-traitants. Un tiers sans revue approuvée retient la mise en production des cas d''usage qui en dépendent.',
           new.business_ref),
    format('/admin/organizations/%s?inventaire=fournisseurs', new.organization_id), 'vendor', new.id,
    new.next_review_at::timestamptz);
  return new;
end;
$$;

create trigger vendor_notify_review
  after insert or update of next_review_at, review_status on public.vendor
  for each row execute function app.notify_vendor_review();

-- -----------------------------------------------------------------------------
-- 5. La revue d'une étude d'impact
-- -----------------------------------------------------------------------------
create or replace function app.notify_impact_review()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_who uuid;
  v_uc public.ai_use_case%rowtype;
begin
  if new.status = 'superseded' or new.next_review_at is null then
    perform app.drop_pending_notifications(new.id, array['impact_review_due']::app.notification_kind[]);
    return new;
  end if;
  if tg_op = 'UPDATE' and new.next_review_at is not distinct from old.next_review_at
     and new.status is not distinct from old.status then
    return new;
  end if;
  select * into v_uc from public.ai_use_case where id = new.use_case_id;
  v_who := coalesce(new.performed_by, app.person_for_role(new.organization_id, 'AI Governance Officer'));
  perform app.notify(new.tenant_id, new.organization_id, v_who, 'impact_review_due',
    format('Étude d''impact à revoir : %s', coalesce(v_uc.name, new.business_ref)),
    format('%s. La date de revue est atteinte : les effets sur les personnes ont-ils changé ? Un changement significatif la rouvre de lui-même.',
           new.business_ref),
    format('/admin/organizations/%s/etudes-impact/%s', new.organization_id, new.id), 'impact_assessment', new.id,
    new.next_review_at::timestamptz);
  return new;
end;
$$;

create trigger impact_assessment_notify_review
  after insert or update of next_review_at, status on public.impact_assessment
  for each row execute function app.notify_impact_review();
