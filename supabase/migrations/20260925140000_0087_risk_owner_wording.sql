-- =============================================================================
-- AIGMS — 0087 — Qui répond d'un risque : le dire pour ce que c'est
-- =============================================================================
-- « Responsable du risque » se confondait avec le responsable du traitement,
-- qui existe à part et qui exécute. Celui-ci ne fait pas : il RÉPOND. Lui
-- seul peut accepter le risque (`app.guard_risk_acceptance`, 0058), et sur un
-- risque élevé ou critique une décision d'acceptation approuvée s'y ajoute
-- (0059) — la direction tranche là où cela l'engage, sans porter tous les
-- risques du registre.
--
-- Rien ne change dans les règles : seuls les mots que la personne lit.
-- =============================================================================

do $$
declare v text;
begin
  select pg_get_functiondef('app.notify_risk_owner()'::regprocedure) into v;
  v := replace(v,
    $x$format('Vous êtes responsable du risque %s', new.business_ref)$x$,
    $x$format('Vous répondez du risque %s', new.business_ref)$x$);
  v := replace(v,
    $x$format('« %s » — %s. Vous en portez le traitement ou l''acceptation.%s'$x$,
    $x$format('« %s » — %s. Vous seul pouvez l''accepter ; qui exécute la mesure se désigne au traitement.%s'$x$);
  execute v;
end $$;

comment on column public.risk.owner_user_id is
  'Qui répond du risque : la personne ayant l''autorité de le gérer (ISO 31000). Elle seule peut l''accepter. Distincte du responsable du traitement, qui exécute la mesure.';
