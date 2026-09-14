-- =============================================================================
-- AIGMS — 0033 — Le journal couvre tout
-- =============================================================================
-- Sept tables etaient journalisees : les preuves, les decisions de
-- Declaration, les connecteurs et les actes d'administration. Tout le reste ne
-- l'etait pas — un controle cree, un risque modifie, un traitement supprime ne
-- laissaient aucune trace.
--
-- La suppression est le cas le plus grave. Les politiques d'ecriture couvrent
-- `for all`, DELETE compris : un objet de gouvernance pouvait disparaitre sans
-- qu'on sache qui l'avait retire, ni ce qu'il contenait. C'est precisement ce
-- qu'un dossier d'audit doit pouvoir reconstituer.
--
-- Le declencheur est GENERIQUE et pose par une boucle declarative, comme les
-- politiques RLS de la migration 0014 : chaque table de la liste recoit
-- exactement le meme contrat, et une table oubliee se voit en lisant la liste.
--
-- Ce que le journal NE couvre pas, et pourquoi :
--   * `audit_log` et `governance_event` — ce sont les journaux eux-memes ;
--   * `connector_sync_run` — sortie machine d'une synchronisation, deja tracee
--     par nature ; la journaliser reviendrait a journaliser un journal.
-- =============================================================================

create or replace function app.audit_business()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_row     jsonb;
  v_tenant  uuid;
  v_action  app.audit_action;
  v_id      uuid;
  v_ref     text;
  v_label   text;
  v_before  jsonb;
  v_after   jsonb;
begin
  if tg_op = 'DELETE' then
    v_row    := to_jsonb(old);
    v_action := 'delete';
    v_before := v_row;
  elsif tg_op = 'UPDATE' then
    v_row    := to_jsonb(new);
    v_action := 'update';
    v_before := to_jsonb(old);
    v_after  := v_row;
  else
    v_row    := to_jsonb(new);
    v_action := 'create';
    v_after  := v_row;
  end if;

  v_tenant := (v_row ->> 'tenant_id')::uuid;
  if v_tenant is null then
    return coalesce(new, old);
  end if;

  v_id  := (v_row ->> 'id')::uuid;
  v_ref := coalesce(v_row ->> 'business_ref', v_row ->> 'code');

  -- L'intitule le plus parlant que porte la ligne. Un journal qui ne rend que
  -- des identifiants oblige a rouvrir la base pour se souvenir de quoi il
  -- parlait — et apres une suppression, la ligne n'est plus la.
  v_label := coalesce(
    v_row ->> 'name', v_row ->> 'title', v_row ->> 'subject',
    v_row ->> 'code', v_row ->> 'business_ref', v_id::text);

  perform app.log_audit(
    v_tenant,
    v_action,
    tg_table_name,
    v_id,
    v_ref,
    format('%s %s « %s »',
      tg_table_name,
      case tg_op when 'INSERT' then 'créé' when 'UPDATE' then 'modifié' else 'supprimé' end,
      v_label),
    v_before,
    v_after);

  return coalesce(new, old);
end;
$$;

comment on function app.audit_business is
  'Journalisation generique d''une table metier : creation, modification, suppression. L''etat complet est conserve avant et apres, de sorte qu''une suppression reste reconstituable.';

-- -----------------------------------------------------------------------------
-- Pose declarative
-- -----------------------------------------------------------------------------
do $$
declare
  -- Tables metier non encore couvertes. Celles qui le sont deja portent un
  -- declencheur specifique, avec des libelles adaptes : evidence,
  -- governance_connector, membership, organization, role_assignment,
  -- soa_decision.
  v_tables text[] := array[
    'action', 'activity', 'ai_asset', 'ai_use_case', 'assessment',
    'assessment_answer', 'business_unit', 'capa', 'catalog_import_job',
    'change_request', 'control', 'control_applicability', 'control_evidence',
    'control_requirement_map', 'decision_link', 'governance_decision',
    'human_oversight_plan', 'impact_assessment', 'impact_finding',
    'impact_stakeholder', 'incident', 'process', 'reassessment',
    'regulatory_classification', 'risk', 'risk_treatment',
    'use_case_asset_link', 'use_case_vendor_link', 'vendor'
  ];
  v_table text;
begin
  foreach v_table in array v_tables loop
    execute format(
      'drop trigger if exists %I_audit on public.%I', v_table, v_table);
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function app.audit_business()',
      v_table, v_table);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Vérification de couverture
-- -----------------------------------------------------------------------------
-- Une liste declarative se perime des qu'une table apparait sans y etre
-- ajoutee. Cette fonction nomme les manquantes : un test la lit, et la
-- prochaine table oubliee fera echouer la suite plutot que de passer inapercue.
create or replace function app.audit_coverage_gaps()
returns table (table_name text)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    -- Seules les tables portant un tenant relevent d'un dossier de gouvernance.
    and exists (
      select 1 from information_schema.columns col
      where col.table_schema = 'public' and col.table_name = c.relname
        and col.column_name = 'tenant_id'
    )
    -- Les journaux eux-memes, et la sortie machine d'une synchronisation.
    and c.relname not in ('audit_log', 'governance_event', 'connector_sync_run')
    and not exists (
      select 1 from pg_trigger t
      where t.tgrelid = c.oid
        and not t.tgisinternal
        and t.tgname like '%\_audit'
    )
  order by 1;
$$;

comment on function app.audit_coverage_gaps is
  'Tables portant un tenant et depourvues de declencheur d''audit. Doit rester vide : un test le verifie.';

grant execute on function app.audit_coverage_gaps() to authenticated, service_role;
