-- =============================================================================
-- AIGMS — 0018 — Journalisation des actes d'administration
-- =============================================================================
-- Ouvrir un accès est un acte sensible : créer une organisation, rattacher un
-- compte, attribuer ou retirer un rôle. Ces actes doivent laisser une trace.
--
-- La trace est posée par des TRIGGERS et non par l'application. Une
-- journalisation applicative ne couvre que le chemin qu'elle emprunte : un
-- appel direct à l'API, un script ou une session psql y échapperaient. Le
-- trigger, lui, s'exécute quel que soit le chemin.
--
-- C'est aussi ce qui permet de ne pas exposer `app.log_audit` à l'API : la
-- fonction reste interne, et personne ne peut écrire dans le journal en
-- choisissant ce qu'il y consigne.
-- =============================================================================

create or replace function app.audit_administration()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_tenant   uuid;
  v_action   app.audit_action;
  v_entity   text := tg_table_name;
  v_id       uuid;
  v_ref      text;
  v_summary  text;
  v_before   jsonb;
  v_after    jsonb;
begin
  v_tenant := coalesce(
    case when tg_op = 'DELETE' then null else (to_jsonb(new) ->> 'tenant_id')::uuid end,
    case when tg_op = 'INSERT' then null else (to_jsonb(old) ->> 'tenant_id')::uuid end
  );

  if v_tenant is null then
    return coalesce(new, old);
  end if;

  v_action := case tg_op
    when 'INSERT' then case when tg_table_name = 'organization' then 'create'
                            else 'access_granted' end
    when 'UPDATE' then case when tg_table_name = 'organization' then 'update'
                            else 'access_granted' end
    when 'DELETE' then 'access_revoked'
  end::app.audit_action;

  if tg_table_name = 'organization' then
    v_id      := coalesce(new.id, old.id);
    v_ref     := coalesce(new.business_ref, old.business_ref);
    v_summary := case tg_op
      when 'INSERT' then format('Organisation « %s » créée', new.name)
      when 'UPDATE' then format('Organisation « %s » modifiée', new.name)
      else format('Organisation « %s » supprimée', old.name)
    end;
    v_before := case when tg_op = 'INSERT' then null
                     else jsonb_build_object('name', old.name, 'status', old.status) end;
    v_after  := case when tg_op = 'DELETE' then null
                     else jsonb_build_object('name', new.name, 'status', new.status) end;

  elsif tg_table_name = 'membership' then
    v_id      := coalesce((to_jsonb(new) ->> 'user_id')::uuid, (to_jsonb(old) ->> 'user_id')::uuid);
    v_ref     := (select p.email from public.user_profile p where p.id = v_id);
    v_summary := case tg_op
      when 'INSERT' then format('Compte rattaché au portefeuille avec le rôle %s', new.role)
      when 'UPDATE' then format('Rôle porté de %s à %s', old.role, new.role)
      else format('Rattachement au portefeuille retiré (rôle %s)', old.role)
    end;
    v_before := case when tg_op = 'INSERT' then null
                     else jsonb_build_object('role', old.role, 'status', old.status) end;
    v_after  := case when tg_op = 'DELETE' then null
                     else jsonb_build_object('role', new.role, 'status', new.status) end;

  else -- role_assignment
    v_id      := coalesce((to_jsonb(new) ->> 'user_id')::uuid, (to_jsonb(old) ->> 'user_id')::uuid);
    v_ref     := (select p.email from public.user_profile p where p.id = v_id);
    v_summary := case tg_op
      when 'INSERT' then format('Rôle %s attribué sur une organisation', new.role)
      when 'UPDATE' then format('Rôle sur organisation porté de %s à %s', old.role, new.role)
      else format('Rôle %s retiré sur une organisation', old.role)
    end;
    v_before := case when tg_op = 'INSERT' then null
                     else jsonb_build_object('role', old.role, 'organization_id', old.organization_id) end;
    v_after  := case when tg_op = 'DELETE' then null
                     else jsonb_build_object('role', new.role, 'organization_id', new.organization_id) end;
  end if;

  perform app.log_audit(
    v_tenant, v_action, v_entity, v_id, v_ref, v_summary, v_before, v_after,
    jsonb_build_object('operation', tg_op)
  );

  return coalesce(new, old);
end;
$$;

comment on function app.audit_administration is
  'Journalise les actes d''administration — organisations, rattachements, attributions de rôle — quel que soit le chemin d''accès emprunté.';

create trigger organization_audit
  after insert or update or delete on public.organization
  for each row execute function app.audit_administration();

create trigger membership_audit
  after insert or update or delete on public.membership
  for each row execute function app.audit_administration();

create trigger role_assignment_audit
  after insert or update or delete on public.role_assignment
  for each row execute function app.audit_administration();
