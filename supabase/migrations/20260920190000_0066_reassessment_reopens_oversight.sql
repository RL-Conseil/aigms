-- =============================================================================
-- AIGMS — 0066 — Ce qu'une réévaluation rouvre, elle le rouvre vraiment
-- =============================================================================
-- La qualification d'un changement rouvrait la classification et l'évaluation
-- d'impact ; jamais le plan de supervision humaine — alors que c'est lui que
-- rouvrent une autonomie qui monte ou une population nouvelle. Quand le
-- périmètre de la réévaluation contient « oversight », le plan repasse en
-- brouillon, motivé, et son responsable est averti. Le gate Production, qui
-- exige un plan approuvé, tient alors jusqu'à révision.
-- =============================================================================

create or replace function app.reopen_oversight_on_reassessment()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_ch public.change_request%rowtype;
  v_plan public.human_oversight_plan%rowtype;
  v_uc public.ai_use_case%rowtype;
begin
  if coalesce(new.final_verdict, new.engine_verdict) = 'NO_REASSESSMENT' then return new; end if;
  if not ('oversight' = any (coalesce(new.scope, '{}'))) then return new; end if;
  select * into v_ch from public.change_request where id = new.change_request_id;
  select * into v_plan from public.human_oversight_plan where use_case_id = new.use_case_id;
  if v_plan.id is null or v_plan.status = 'draft' then return new; end if;
  select * into v_uc from public.ai_use_case where id = new.use_case_id;

  update public.human_oversight_plan
     set status = 'draft',
         approved_by = null,
         approved_at = null,
         expected_evidence = coalesce(expected_evidence, '') ||
           format(E'\n[À revoir — changement %s : %s]', coalesce(v_ch.business_ref, '?'), coalesce(v_ch.title, ''))
   where id = v_plan.id;

  perform app.notify(
    v_plan.tenant_id, v_plan.organization_id,
    coalesce(v_plan.accountable_user_id, v_uc.owner_user_id, v_uc.accountable_user_id, app.current_user_id()),
    'oversight_review',
    format('Plan de supervision à revoir : « %s »', v_uc.name),
    format('Le changement %s rouvre la supervision humaine (%s). Le plan repasse en brouillon : le réviser, puis le faire approuver — le gate Production l''exige.',
           coalesce(v_ch.business_ref, '?'), coalesce(v_ch.title, '')),
    format('/admin/use-cases/%s?onglet=supervision', new.use_case_id),
    'human_oversight_plan', v_plan.id
  );
  return new;
end;
$$;

create trigger reassessment_reopen_oversight after insert or update of final_verdict on public.reassessment
  for each row execute function app.reopen_oversight_on_reassessment();
