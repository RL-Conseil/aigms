-- =============================================================================
-- AIGMS — 0097 — L'écart de preuve s'assume, il ne bloque pas
-- =============================================================================
-- CONSTAT. La plateforme sait depuis 0072 ce qu'est un contrôle tenu :
-- opérant ET prouvé par une preuve validée non échue (`app.control_is_held`).
-- Le graphe des contrôles s'en sert pour sa couleur, la carte de couverture
-- aussi. Mais le gate PRODUCTION, lui, n'exige AUCUNE preuve : il vérifie que
-- l'applicabilité est statuée pour les contrôles obligatoires, jamais qu'un
-- contrôle applicable soit prouvé. Un contrôle déclaré opérant sans aucune
-- preuve passe entre toutes les mailles — c'est le constat d'audit le plus
-- banal qui soit.
--
-- DÉCISION (voie douce, ADR-0032). Le manque devient une VÉRIFICATION
-- D'AVERTISSEMENT : elle figure au détail du gate, elle ne le fait jamais
-- échouer. Rendre le gate bloquant du jour au lendemain rendrait non conformes
-- tous les cas d'usage déjà en production ; ce n'est pas une décision de
-- migration.
--
-- Ce que l'avertissement engage, en revanche, est ferme :
--
--   1. à la SOUMISSION d'une décision de mise en production, l'écart est FIGÉ
--      sur la décision — les contrôles nommés, pas un compteur. Une preuve
--      déposée ensuite ne réécrit pas ce que l'approbateur a lu ;
--   2. l'officer DOIT dire ce qu'il en est — remédiation en cours, pièce non
--      présentée par l'organisation. Un écart sans explication ne part pas ;
--   3. la personne appelée à se prononcer reçoit l'écart NOMMÉ, par alerte et
--      par courriel ; l'AI Governance Officer est en copie ;
--   4. l'approbation exige une PRISE DE CONNAISSANCE explicite. Refusée en
--      base, pas seulement à l'écran.
--
-- Par défaut, la personne appelée à se prononcer sur une mise en production est
-- l'Administrateur client (`client_admin`) — le DSI côté client — à défaut le
-- Comité de direction.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. L'écart : les contrôles applicables que rien ne prouve
-- -----------------------------------------------------------------------------
create or replace function app.control_evidence_gap(p_use_case_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'control_id', c.id, 'code', c.code, 'name', c.name,
           'status', c.status, 'is_mandatory', c.is_mandatory
         ) order by c.is_mandatory desc, c.code), '[]'::jsonb)
  from public.control_applicability ca
  join public.control c on c.id = ca.control_id
  where ca.use_case_id = p_use_case_id
    and ca.status = 'applicable'
    and not exists (
      select 1 from public.control_evidence ce
      join public.evidence e on e.id = ce.evidence_id
      where ce.control_id = c.id
        and e.validation_status = 'validated'
        and app.evidence_freshness(e.valid_until) <> 'expired');
$$;

comment on function app.control_evidence_gap is
  'Les contrôles applicables à ce cas d''usage qu''aucune preuve validée et fraîche ne démontre. Nommés, pas comptés (0097).';

-- -----------------------------------------------------------------------------
-- 2. Le gate : une vérification qui avertit sans bloquer
-- -----------------------------------------------------------------------------
-- Réécrite par substitution : ce qui change est court, et le reste doit rester
-- identique au caractère près.
do $$
declare
  v_def   text;
  v_avant text;
begin
  v_def   := pg_get_functiondef('app.evaluate_production_gate(uuid)'::regprocedure);
  v_avant := v_def;

  -- a. La variable qui porte l'écart.
  v_def := replace(v_def,
    '  v_satisfied     boolean := true;',
    '  v_satisfied     boolean := true;' || chr(10) || '  v_gap           jsonb;');

  -- b. La vérification d'avertissement, juste avant la synthèse.
  v_def := replace(v_def, '  -- Synthèse ---',
$new$  -- Preuve des contrôles applicables : on avertit, on ne bloque pas (0097).
  v_gap := app.control_evidence_gap(p_use_case_id);

  v_checks := v_checks || jsonb_build_object(
    'code', 'CONTROLS_EVIDENCED',
    'label', 'Chaque contrôle applicable est démontré par une preuve validée',
    'severity', 'warning',
    'satisfied', jsonb_array_length(v_gap) = 0,
    'detail', case when jsonb_array_length(v_gap) = 0
                   then 'Tous les contrôles applicables sont prouvés.'
                   else format('%s contrôle(s) applicable(s) sans preuve validée : %s. La mise en production reste possible — la personne appelée à se prononcer en est avertie et doit l''assumer.',
                               jsonb_array_length(v_gap),
                               (select string_agg(g ->> 'code', ', ' order by g ->> 'code')
                                  from jsonb_array_elements(v_gap) g)) end,
    'gap', v_gap
  );

  -- Synthèse ---$new$);

  -- c. La synthèse ne compte que les vérifications bloquantes. `coalesce`
  --    laisse les huit existantes bloquantes sans les réécrire.
  v_def := replace(v_def,
$old$  select bool_and((c ->> 'satisfied')::boolean) into v_satisfied
  from jsonb_array_elements(v_checks) c;$old$,
$new$  select bool_and((c ->> 'satisfied')::boolean) into v_satisfied
  from jsonb_array_elements(v_checks) c
  where coalesce(c ->> 'severity', 'blocking') = 'blocking';$new$);

  -- Une substitution muette produirait une fonction inchangée, et personne ne
  -- s'en apercevrait avant l'audit.
  if v_def = v_avant
     or position('CONTROLS_EVIDENCED' in v_def) = 0
     or position('v_gap           jsonb;' in v_def) = 0
     or position('''severity'', ''blocking''' in v_def) = 0 then
    raise exception 'Réécriture du gate de production incomplète : le texte attendu n''a pas été trouvé.';
  end if;

  execute v_def;
end;
$$;

comment on function app.evaluate_production_gate is
  'Les préconditions de mise en production. Une vérification peut AVERTIR sans bloquer : la synthèse ne compte que les bloquantes (0097).';
