-- =============================================================================
-- AIGMS — 0038 — Administration d'une organisation
-- =============================================================================
-- Deux règles, toutes deux côté base.
--
-- 1. MODIFIER UNE ORGANISATION RELÈVE DE L'ADMINISTRATION SEULE. Son nom, son
--    rôle vis-à-vis de l'IA, l'identité que portent ses documents : rien de
--    cela n'est un acte de gouvernance, et un rôle de gouvernance n'a pas à
--    renommer son client ni à requalifier son rôle — ce dernier recalcule le
--    régime de preuve exigé par toute la Déclaration d'Applicabilité.
--
-- 2. UNE ORGANISATION NE SE SUPPRIME PAS, ELLE S'ARCHIVE. Supprimer une
--    organisation emporterait par cascade ses usages, ses risques, ses
--    décisions, ses preuves et leur journal : exactement ce qu'un système de
--    gouvernance existe pour conserver. Le statut `archived` dit qu'elle n'est
--    plus suivie ; il ne fait rien disparaître.
--
-- Les deux vivent en base, pas dans l'écran : aucun bouton ne propose ni
-- l'un ni l'autre, mais un appel direct à l'API n'en proposerait pas moins.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Mise à jour : administration seule
-- -----------------------------------------------------------------------------
-- La policy de 0017 laissait les rôles de gouvernance « mettre à jour les
-- données de contexte de leur client ». Il n'en reste aucune : le rôle
-- vis-à-vis de l'IA et l'identité documentaire sont des réglages
-- d'administration, et l'organisation courante vit sur le profil (0032).
drop policy if exists organization_update on public.organization;
create policy organization_update on public.organization
  for update to authenticated
  using (app.has_tenant_role(tenant_id, app.roles_administer()))
  with check (app.has_tenant_role(tenant_id, app.roles_administer()));

-- -----------------------------------------------------------------------------
-- 2. Suppression : refusée
-- -----------------------------------------------------------------------------

create or replace function app.forbid_organization_delete()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  raise exception 'Une organisation ne se supprime pas : elle s''archive (statut « archived »), pour que ses décisions et ses preuves restent lisibles.'
    using errcode = 'check_violation';
end;
$$;

create trigger organization_never_deleted
  before delete on public.organization
  for each row execute function app.forbid_organization_delete();

comment on trigger organization_never_deleted on public.organization is
  'Refuse toute suppression, quel que soit le rôle. L''archivage est le seul retrait admis.';
