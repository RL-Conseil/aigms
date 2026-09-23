-- 0093 — La disponibilité de toutes les organisations accessibles, en un appel.
--
-- `public.organization_readiness(uuid)` répond pour UNE organisation. La page
-- Comptes et rôles l'appelait une fois par organisation : sept allers-retours
-- pour sept clients, cinquante pour cinquante. Le portefeuille visé par
-- l'offre rend cela intenable, et c'est exactement ce que fait déjà
-- `attention_by_organization` pour les compteurs — une lecture, tout le
-- périmètre.
--
-- Rien de neuf dans le calcul : la fonction singulière reste la référence, et
-- celle-ci l'applique à ce que la personne peut voir. Même portée, même
-- `security invoker`, donc les mêmes refus.

create or replace function public.organizations_readiness()
returns table (organization_id uuid, readiness jsonb)
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select o.id,
         jsonb_build_object(
           'ready', app.organization_ready(o.id),
           'required', to_jsonb(app.required_governance_roles()),
           'held', to_jsonb(app.organization_held_roles(o.id)),
           'missing', to_jsonb(app.organization_missing_roles(o.id)),
           'people', (
             select count(distinct m.user_id)
             from public.membership m
             where m.tenant_id = o.tenant_id and m.status = 'active'
               and m.role <> 'platform_admin'
           )
         )
  from public.organization o
  where app.has_tenant_access(o.tenant_id);
$$;

comment on function public.organizations_readiness is
  'La disponibilité de chaque organisation accessible, en une lecture. Même calcul que organization_readiness, appliqué au périmètre entier (0093).';

revoke all on function public.organizations_readiness() from public, anon;
grant execute on function public.organizations_readiness() to authenticated;
