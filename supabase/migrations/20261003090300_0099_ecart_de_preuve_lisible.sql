-- 0099 — L'écart de preuve se lit depuis l'application.
--
-- `app.control_evidence_gap` (0097) n'est pas exposée : PostgREST ne sert que
-- le schéma `public`. Le formulaire de décision doit pouvoir l'annoncer AVANT
-- la soumission — sinon l'officer découvre l'écart dans le message d'erreur de
-- la base, ce qui est le plus mauvais moment pour l'apprendre.
--
-- `security invoker` : la fonction interne est déjà bornée par
-- `app.has_tenant_access` sur ses lectures, et l'enrobage n'élargit rien.

create or replace function public.control_evidence_gap(p_use_case_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select case
    when exists (
      select 1 from public.ai_use_case u
      join public.organization o on o.id = u.organization_id
      where u.id = p_use_case_id and app.has_tenant_access(o.tenant_id))
    then app.control_evidence_gap(p_use_case_id)
    else '[]'::jsonb
  end;
$$;

comment on function public.control_evidence_gap is
  'Les contrôles applicables qu''aucune preuve validée et fraîche ne démontre, pour l''écran qui prépare la décision (0099).';

revoke all on function public.control_evidence_gap(uuid) from public, anon;
grant execute on function public.control_evidence_gap(uuid) to authenticated;
