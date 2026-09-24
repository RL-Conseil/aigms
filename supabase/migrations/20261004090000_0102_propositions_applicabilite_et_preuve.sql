-- =============================================================================
-- AIGMS — 0102 — Deux écarts de plus deviennent des actions proposables
-- =============================================================================
-- `app.suggest_actions` (0051) dérive six familles d'écarts. Deux manquaient,
-- et ce sont celles que l'officer découvre le plus tard.
--
--   7. L'APPLICABILITÉ INDÉTERMINÉE. `control_applicability.status` vaut
--      `to_determine` PAR DÉFAUT (0009) : retenir vingt contrôles proposés sans
--      statuer les laisse tous indéterminés. Le gate ne bloque que sur les
--      obligatoires ; les autres ne se voient nulle part.
--
--      Une proposition PAR CONTRÔLE noierait la liste — vingt lignes qui disent
--      la même chose. D'où UNE SEULE action groupée par cas d'usage, qui se
--      ferme d'elle-même quand il ne reste rien. Bloquante seulement si des
--      obligatoires sont concernés : c'est exactement ce que le gate exige déjà.
--
--   8. LE CONTRÔLE APPLICABLE SANS AUCUNE PREUVE. Le cas 3 couvre la preuve
--      échue ou proche de l'échéance ; jamais la preuve ABSENTE. Un contrôle
--      déclaré opérant que rien ne démontre passait donc entre les mailles —
--      c'est le constat d'audit le plus banal, et 0097 l'a rendu visible au
--      gate sans le rendre actionnable.
--
--      Une par contrôle, non bloquante, et PLAFONNÉE À CINQ : au-delà, ce n'est
--      plus une action mais un chantier, et trente propositions feraient
--      abandonner la liste. Les obligatoires d'abord.
-- =============================================================================

do $$
declare v_def text; v_avant text;
begin
  v_def   := pg_get_functiondef('app.suggest_actions(uuid)'::regprocedure);
  v_avant := v_def;

  v_def := replace(v_def,
    '  return jsonb_build_object(''available'', true, ''proposals'', v_out);',
$new$  -- 7. Applicabilité indéterminée : UNE action, pas une par contrôle.
  select count(*), count(*) filter (where c.is_mandatory)
    into v_undecided, v_undecided_mandatory
  from public.control_applicability ca
  join public.control c on c.id = ca.control_id
  where ca.use_case_id = v_uc.id and ca.status = 'to_determine';

  if v_undecided > 0 and not app.action_already_open(v_uc.id, 'manual', v_uc.id) then
    v_out := v_out || app.action_proposal(
      'applicability',
      format('Statuer l''applicabilité de %s contrôle(s)', v_undecided),
      format('%s contrôle(s) affecté(s) à ce cas d''usage restent « à déterminer »%s. Un contrôle sans décision n''est ni tenu ni écarté : il ne se prouve pas et ne se justifie pas.',
             v_undecided,
             case when v_undecided_mandatory > 0
                  then format(', dont %s obligatoire(s) que le jalon PRODUCTION exige statué(s)', v_undecided_mandatory)
                  else '' end),
      'manual', v_uc.id,
      coalesce(app.person_for_role(v_org.id, 'AI Governance Officer'), v_uc.owner_user_id),
      21, v_undecided_mandatory > 0,
      case when v_undecided_mandatory > 0
           then 'Contrôles obligatoires sans décision : le jalon PRODUCTION est retenu.'
           else 'Applicabilité non statuée.' end);
  end if;

  -- 8. Contrôle applicable qu'aucune preuve ne démontre (0097). Plafonné : au
  --    delà de cinq, c'est un chantier, pas une action.
  for r in
    select c.id, c.code, c.name, c.owner_user_id, c.is_mandatory, cc.owner_role
    from public.control_applicability ca
    join public.control c on c.id = ca.control_id
    left join public.catalog_control cc on cc.id = c.catalog_control_id
    where ca.use_case_id = v_uc.id and ca.status = 'applicable'
      and not exists (
        select 1 from public.control_evidence ce
        join public.evidence e on e.id = ce.evidence_id
        where ce.control_id = c.id
          and e.validation_status = 'validated'
          and app.evidence_freshness(e.valid_until) <> 'expired')
    order by c.is_mandatory desc, c.code
    limit 5
  loop
    if not app.action_already_open(v_uc.id, 'control', r.id) then
      v_out := v_out || app.action_proposal(
        'unevidenced:' || r.id,
        format('Produire la preuve de %s — %s', r.code, r.name),
        'Le contrôle est applicable et rien ne le démontre : aucune preuve validée et non échue ne lui est rattachée. Déposer la pièce, ou rattacher celle qui existe déjà.',
        'control', r.id,
        coalesce(r.owner_user_id, app.person_for_role(v_org.id, r.owner_role), v_uc.owner_user_id),
        30, false,
        case when r.is_mandatory
             then 'Contrôle obligatoire sans preuve : rien ne l''atteste devant un auditeur.'
             else 'Contrôle applicable sans preuve.' end);
    end if;
  end loop;

  return jsonb_build_object('available', true, 'proposals', v_out);$new$);

  -- Les deux compteurs du cas 7.
  v_def := replace(v_def,
    '  v_gate jsonb;',
$new$  v_gate jsonb;
  v_undecided           integer;
  v_undecided_mandatory integer;$new$);

  if v_def = v_avant
     or position('''applicability''' in v_def) = 0
     or position('''unevidenced:''' in v_def) = 0
     or position('v_undecided_mandatory integer;' in v_def) = 0 then
    raise exception 'Réécriture de suggest_actions incomplète : le texte attendu n''a pas été trouvé.';
  end if;

  execute v_def;
end;
$$;

comment on function app.suggest_actions is
  'Les écarts d''un cas d''usage, en actions proposables : contrôles non opérants, risques non traités, preuves échues, manques du gate, revue passée, incidents sans CAPA, applicabilité indéterminée et contrôles sans preuve (0102).';
