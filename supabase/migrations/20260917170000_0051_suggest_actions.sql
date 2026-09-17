-- =============================================================================
-- AIGMS — 0051 — Propositions d'actions pour un cas d'usage
-- =============================================================================
-- Retenir des contrôles dit ce qu'on doit maîtriser ; il reste à le faire.
-- Cette fonction transforme les ÉCARTS que la plateforme connaît déjà en
-- actions à retenir — avec, pour chacune, d'où elle vient (la source), à qui
-- elle revient (un responsable pressenti, jamais imposé), et si elle retient le
-- gate PRODUCTION.
--
-- Les écarts lus :
--   * contrôle affecté, pas encore opérant           -> le rendre opérant
--   * risque élevé ou critique sans traitement       -> décider du traitement
--   * preuve échue ou proche de l'échéance           -> la renouveler
--   * évaluation d'impact requise, absente/en cours  -> la conduire
--   * supervision humaine non approuvée              -> la décrire
--   * fournisseur sans revue close                   -> clore la revue
--   * revue du cas d'usage passée                    -> la conduire
--   * incident significatif ouvert sans CAPA         -> ouvrir la CAPA
--
-- Une action déjà ouverte sur la même source n'est pas reproposée : on ne
-- double pas ce qui est en cours.
--
-- Le responsable pressenti vient, dans l'ordre : du responsable déjà porté par
-- l'objet (contrôle, risque, preuve) ; sinon de la première personne déclarée
-- sur l'organisation avec le rôle que le contrôle-type pressent ; sinon du
-- propriétaire du cas d'usage. C'est une suggestion : le formulaire la montre,
-- l'utilisateur la change ou la confirme — désigner reste un acte humain.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Trois aides, parce que PL/pgSQL n'a pas de fonctions imbriquées
-- -----------------------------------------------------------------------------

-- Le responsable pressenti pour un role, tel que le controle-type le nomme.
create or replace function app.person_for_role(p_organization_id uuid, p_role_label text)
returns uuid
language plpgsql stable
set search_path = app, public, pg_catalog
as $$
declare v_role app.app_role; v_id uuid;
begin
  v_role := case
    when p_role_label ilike '%governance officer%' or p_role_label ilike 'AIGO%' then 'governance_officer'
    when p_role_label ilike '%risque%' then 'risk_owner'
    when p_role_label ilike '%porteur%' then 'system_owner'
    when p_role_label ilike '%auditeur%' then 'auditor'
    when p_role_label ilike '%direction%' then 'executive_viewer'
    else null end;
  if v_role is null then return null; end if;
  select ra.user_id into v_id from public.role_assignment ra
   where ra.organization_id = p_organization_id and ra.role = v_role
     and (ra.valid_until is null or ra.valid_until > now())
   order by ra.valid_from limit 1;
  return v_id;
end;
$$;

-- Une action deja ouverte sur la meme source : on ne double pas.
create or replace function app.action_already_open(p_use_case_id uuid, p_source app.action_source, p_source_id uuid)
returns boolean
language sql stable
set search_path = app, public, pg_catalog
as $$
  select exists (select 1 from public.action a
                  where a.use_case_id = p_use_case_id and a.source = p_source and a.source_id = p_source_id
                    and a.status not in ('done', 'cancelled'));
$$;

create or replace function app.action_proposal(
  p_key text, p_title text, p_description text, p_source app.action_source,
  p_source_id uuid, p_owner uuid, p_days integer, p_blocking boolean, p_reason text
)
returns jsonb
language sql stable
set search_path = app, public, pg_catalog
as $$
  select jsonb_build_object(
    'key', p_key, 'title', p_title, 'description', p_description,
    'source', p_source, 'source_id', p_source_id,
    'suggested_owner_id', p_owner,
    'suggested_owner', (select coalesce(nullif(btrim(up.full_name), ''), up.email) from public.user_profile up where up.id = p_owner),
    'due_in_days', p_days, 'is_blocking', p_blocking, 'reason', p_reason);
$$;

create or replace function app.suggest_actions(p_use_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uc   public.ai_use_case;
  v_org  public.organization;
  v_out  jsonb := '[]'::jsonb;
  v_gate jsonb;
  r      record;

begin
  select * into v_uc from public.ai_use_case where id = p_use_case_id;
  if v_uc.id is null then
    return jsonb_build_object('available', false, 'reason', 'Cas d’usage introuvable.');
  end if;
  select * into v_org from public.organization where id = v_uc.organization_id;
  if not app.has_tenant_access(v_org.tenant_id) then
    return jsonb_build_object('available', false, 'reason', 'Hors de votre périmètre.');
  end if;

  -- 1. Controles affectes, pas encore operants.
  for r in
    select c.id, c.code, c.name, c.status, c.owner_user_id, c.is_mandatory, cc.owner_role
    from public.control_applicability ca
    join public.control c on c.id = ca.control_id
    left join public.catalog_control cc on cc.id = c.catalog_control_id
    where ca.use_case_id = v_uc.id and ca.status = 'applicable' and c.status <> 'operating'
    order by c.is_mandatory desc, c.code
  loop
    if not app.action_already_open(v_uc.id, 'control', r.id) then
      v_out := v_out || app.action_proposal(
        'control:' || r.id,
        format('Rendre opérant %s — %s', r.code, r.name),
        format('Le contrôle est affecté à ce cas d’usage mais son état est « %s ». Le mettre en œuvre, le tester, puis le déclarer opérant.', r.status),
        'control', r.id,
        coalesce(r.owner_user_id, app.person_for_role(v_org.id, r.owner_role), v_uc.owner_user_id),
        30, r.is_mandatory,
        case when r.is_mandatory then 'Contrôle obligatoire : le gate PRODUCTION l’exige opérant.' else 'Contrôle affecté, non opérant.' end);
    end if;
  end loop;

  -- 2. Risques eleves ou critiques sans traitement ni acceptation.
  for r in
    select rk.id, rk.business_ref, rk.title, rk.owner_user_id,
           coalesce(rk.residual_level, rk.inherent_level) as level
    from public.risk rk
    where rk.use_case_id = v_uc.id
      and coalesce(rk.residual_level, rk.inherent_level) in ('high', 'critical')
      and rk.status not in ('accepted', 'mitigated', 'closed')
      -- Meme predicat que le gate PRODUCTION : un traitement compte quand il
      -- est mis en oeuvre ou verifie, pas quand il est planifie.
      and not exists (select 1 from public.risk_treatment t where t.risk_id = rk.id and t.status in ('implemented', 'verified'))
    order by rk.business_ref
  loop
    if not app.action_already_open(v_uc.id, 'risk', r.id) then
      v_out := v_out || app.action_proposal(
        'risk:' || r.id,
        format('Décider du traitement de %s — %s', r.business_ref, r.title),
        'Décider et mettre en œuvre le traitement — réduire par un contrôle nommé, transférer, éviter — ou accepter formellement, avec justification et date de revue. Un traitement planifié ne compte pas encore.',
        'risk', r.id,
        coalesce(r.owner_user_id, app.person_for_role(v_org.id, 'Responsable du risque'), v_uc.owner_user_id),
        15, true,
        format('Risque %s ouvert : le gate PRODUCTION refuse tant qu’il n’est ni traité ni accepté.', r.level));
    end if;
  end loop;

  -- 3. Preuves echues ou proches de l'echeance sur les controles affectes.
  for r in
    select distinct e.id, e.business_ref, e.title, e.valid_until, e.owner_user_id,
           app.evidence_freshness(e.valid_until) as freshness, c.code as control_code
    from public.control_applicability ca
    join public.control c on c.id = ca.control_id
    join public.control_evidence ce on ce.control_id = c.id
    join public.evidence e on e.id = ce.evidence_id
    where ca.use_case_id = v_uc.id and ca.status = 'applicable'
      and app.evidence_freshness(e.valid_until) in ('expired', 'expiring')
    order by e.valid_until
  loop
    if not app.action_already_open(v_uc.id, 'control', r.id) then
      v_out := v_out || app.action_proposal(
        'evidence:' || r.id,
        format('Renouveler la preuve %s — %s', r.business_ref, r.title),
        format('Elle démontre %s et %s le %s. Déposer la pièce à jour et la rattacher.', r.control_code,
               case when r.freshness = 'expired' then 'est échue depuis' else 'arrive à échéance' end,
               to_char(r.valid_until, 'DD/MM/YYYY')),
        'control', r.id,
        coalesce(r.owner_user_id, v_uc.owner_user_id),
        case when r.freshness = 'expired' then 7 else 21 end, false,
        case when r.freshness = 'expired' then 'Preuve échue : le contrôle ne compte plus comme couvert.' else 'Preuve proche de l’échéance.' end);
    end if;
  end loop;

  -- 4. Le gate PRODUCTION : ce qui manque encore, hors ce qui precede.
  v_gate := app.evaluate_gate(v_uc.id, 'PRODUCTION');
  for r in select * from jsonb_to_recordset(coalesce(v_gate -> 'checks', '[]'::jsonb)) as x(code text, label text, detail text, satisfied boolean)
  loop
    continue when r.satisfied;
    if r.code = 'IMPACT_ASSESSMENT' and not app.action_already_open(v_uc.id, 'impact_finding', v_uc.id) then
      v_out := v_out || app.action_proposal('gate:impact', 'Conduire l’évaluation d’impact', r.detail, 'impact_finding', v_uc.id,
        coalesce(app.person_for_role(v_org.id, 'AI Governance Officer'), v_uc.accountable_user_id), 30, true, 'Précondition du gate PRODUCTION.');
    elsif r.code = 'HUMAN_OVERSIGHT' and not app.action_already_open(v_uc.id, 'manual', v_uc.id) then
      v_out := v_out || app.action_proposal('gate:oversight', 'Décrire et faire approuver la supervision humaine', r.detail, 'manual', v_uc.id,
        coalesce(v_uc.accountable_user_id, v_uc.owner_user_id), 21, true, 'Précondition du gate PRODUCTION.');
    elsif r.code = 'VENDOR_REVIEW' then
      -- Une action par fournisseur sans revue close.
      declare v record;
      begin
        for v in
          select vd.id, vd.name from public.use_case_vendor_link l join public.vendor vd on vd.id = l.vendor_id
          where l.use_case_id = v_uc.id and vd.review_status not in ('approved', 'approved_with_conditions')
        loop
          if not app.action_already_open(v_uc.id, 'manual', v.id) then
            v_out := v_out || app.action_proposal('vendor:' || v.id, format('Clore la revue tiers de %s', v.name),
              'Conduire la revue — sécurité, données, localisation, conditions — et consigner son résultat sur la fiche du fournisseur.',
              'manual', v.id, coalesce(app.person_for_role(v_org.id, 'AI Governance Officer'), v_uc.owner_user_id), 30, true,
              'Précondition du gate PRODUCTION : chaque tiers impliqué a une revue close.');
          end if;
        end loop;
      end;
    end if;
  end loop;

  -- 5. Revue du cas d'usage passee.
  if v_uc.next_review_at is not null and v_uc.next_review_at < current_date and not app.action_already_open(v_uc.id, 'management_review', v_uc.id) then
    v_out := v_out || app.action_proposal('review', 'Conduire la revue du cas d’usage',
      format('La revue était attendue le %s : indicateurs, incidents, risques, écarts — et conclure.', to_char(v_uc.next_review_at, 'DD/MM/YYYY')),
      'management_review', v_uc.id, coalesce(v_uc.accountable_user_id, v_uc.owner_user_id), 14, false,
      'Revue en retard : un usage qu’on ne revoit plus n’est plus gouverné.');
  end if;

  -- 6. Incidents significatifs ouverts sans CAPA.
  for r in
    select i.id, i.business_ref, i.title, i.owner_user_id
    from public.incident i
    where i.use_case_id = v_uc.id and i.status <> 'CLOSED'
      and (i.severity in ('S1', 'S2') or i.kind = 'non_conformity' or i.is_recurrence)
      and not exists (select 1 from public.capa c where c.incident_id = i.id)
  loop
    if not app.action_already_open(v_uc.id, 'incident', r.id) then
      v_out := v_out || app.action_proposal('incident:' || r.id, format('Ouvrir la CAPA de %s — %s', r.business_ref, r.title),
        'Correction, analyse de cause, action corrective, puis test d’efficacité vérifié : sans CAPA close, l’incident ne se clôt pas.',
        'incident', r.id, coalesce(r.owner_user_id, v_uc.owner_user_id), 14, false,
        'Incident significatif sans CAPA.');
    end if;
  end loop;

  return jsonb_build_object('available', true, 'proposals', v_out);
end;
$$;

comment on function app.suggest_actions is
  'Actions à proposer pour un cas d''usage, dérivées des écarts connus : contrôles non opérants, risques non traités, preuves à renouveler, préconditions du gate, revue passée, incidents sans CAPA. Un responsable est pressenti, jamais imposé.';

create or replace function public.suggest_actions(p_use_case_id uuid)
returns jsonb language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select app.suggest_actions(p_use_case_id); $$;

grant execute on function public.suggest_actions(uuid) to authenticated;
