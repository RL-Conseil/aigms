-- =============================================================================
-- AIGMS — 0073 — Le plan approuvé matérialise HUM-001 « Niveau de supervision »
-- =============================================================================
-- HUM-001 exige que le niveau de supervision humaine soit fixé, documenté et
-- approuvé pour chaque système d'IA. C'est exactement ce qu'est un plan de
-- supervision approuvé : le contrôle est porté implicitement par AIGMS, sans
-- jamais apparaître au registre. On le matérialise : à l'approbation du plan,
-- HUM-001 rejoint le registre de l'organisation s'il n'y est pas, devient
-- applicable au cas d'usage, et le plan approuvé — niveau, responsable,
-- autorité d'arrêt, date — se dépose comme sa preuve, déclarative, nominative,
-- à valider par quelqu'un d'autre.
-- =============================================================================

alter table public.human_oversight_plan
  add column if not exists level_control_id uuid references public.control (id) on delete set null,
  add column if not exists approval_evidence_id uuid references public.evidence (id) on delete set null;

create or replace function app.materialize_oversight_level()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uc public.ai_use_case%rowtype;
  v_control uuid;
  v_catalog uuid;
  v_evidence uuid;
  v_result jsonb;
begin
  if new.status <> 'approved' or (tg_op = 'UPDATE' and old.status = 'approved') then return new; end if;
  if current_setting('aigms.seed', true) = 'on' then return new; end if;
  select * into v_uc from public.ai_use_case where id = new.use_case_id;

  -- HUM-001 au registre de l'organisation : le contrôle instancié, sinon le
  -- contrôle-type publié le plus récent, instancié maintenant.
  select c.id into v_control from public.control c
   where c.organization_id = new.organization_id and c.code = 'AIGMS-HUM-001' limit 1;
  if v_control is null then
    select cc.id into v_catalog
      from public.catalog_control cc
      join public.catalog_version v on v.id = cc.version_id
      join public.catalog_framework f on f.id = v.framework_id
     where cc.control_code = 'AIGMS-HUM-001' and v.status = 'published' and f.tenant_id is null
     order by v.created_at desc limit 1;
    if v_catalog is not null then
      begin
        v_result := app.instantiate_catalog_control(new.organization_id, v_catalog, null, coalesce(new.accountable_user_id, new.approved_by));
        v_control := (v_result ->> 'control_id')::uuid;
      exception when others then
        v_control := null;
      end;
    end if;
  end if;
  if v_control is null then return new; end if;

  new.level_control_id := v_control;
  insert into public.control_applicability (tenant_id, use_case_id, control_id, status, justification)
  values (new.tenant_id, new.use_case_id, v_control, 'applicable',
          format('Niveau de supervision fixé et approuvé par le plan %s.', new.business_ref))
  on conflict (control_id, use_case_id) do update
    set status = 'applicable',
        justification = case when public.control_applicability.status = 'applicable'
                             then public.control_applicability.justification else excluded.justification end;

  -- Le plan approuvé est la preuve de HUM-001.
  insert into public.evidence (tenant_id, organization_id, title, evidence_type, source, owner_user_id, validation_status, valid_until)
  values (new.tenant_id, new.organization_id,
          format('Plan de supervision humaine %s — %s, approuvé le %s (niveau %s)',
                 new.business_ref, coalesce(v_uc.name, 'cas d''usage'), app.fr_date(current_date), new.autonomy_level::text),
          'declarative', format('Plan de supervision %s (AIGMS)', new.business_ref),
          coalesce(new.approved_by, app.current_user_id()), 'pending',
          coalesce(new.next_review_at, current_date + interval '12 months'))
  returning id into v_evidence;
  insert into public.control_evidence (tenant_id, control_id, evidence_id, linked_by)
  values (new.tenant_id, v_control, v_evidence, coalesce(new.approved_by, app.current_user_id()));
  new.approval_evidence_id := v_evidence;
  return new;
end;
$$;

create trigger human_oversight_plan_materialize_level before insert or update of status on public.human_oversight_plan
  for each row execute function app.materialize_oversight_level();
