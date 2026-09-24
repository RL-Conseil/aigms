-- 0101 — Se prononcer, c'est aussi déclarer avoir lu.
--
-- 0055 borne ce que le Comité de direction peut toucher quand il arbitre : le
-- verdict, son auteur, sa date, ses conditions, sa motivation, ses échéances.
-- Tout le reste lui est refusé — « il se prononce, il ne réécrit pas ».
--
-- 0098 ajoute deux colonnes qui appartiennent à ce même acte : la prise de
-- connaissance de l'écart de preuve et son auteur. Sans les inscrire ici,
-- l'approbation d'une décision qui porte un écart devient impossible pour
-- celui-là même à qui on la demande — le garde refuse, et le message parle
-- d'une réécriture qui n'a pas eu lieu.
--
-- Découvert par le test RACI, qui a refusé l'approbation du Comité de
-- direction après 0098.

do $$
declare v_def text; v_avant text;
begin
  v_def   := pg_get_functiondef('app.guard_decision_arbitration()'::regprocedure);
  v_avant := v_def;

  v_def := replace(v_def,
    '    v_old.updated_at := null;       v_new.updated_at := null;',
$new$    v_old.updated_at := null;       v_new.updated_at := null;
    -- La prise de connaissance de l'écart de preuve est un acte de celui qui
    -- se prononce, pas une réécriture du dossier (0098).
    v_old.evidence_gap_acknowledged_at := null; v_new.evidence_gap_acknowledged_at := null;
    v_old.evidence_gap_acknowledged_by := null; v_new.evidence_gap_acknowledged_by := null;$new$);

  if v_def = v_avant or position('evidence_gap_acknowledged_at := null' in v_def) = 0 then
    raise exception 'Réécriture de guard_decision_arbitration incomplète : le texte attendu n''a pas été trouvé.';
  end if;

  execute v_def;
end;
$$;

comment on function app.guard_decision_arbitration is
  'Qui peut se prononcer, et sur quoi. L''arbitre ne touche que le verdict et ce qui en fait partie — y compris la prise de connaissance de l''écart de preuve (0101).';
