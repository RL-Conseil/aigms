-- =============================================================================
-- AIGMS — 0035 — Identité de l'organisation et documents imprimables
-- =============================================================================
-- Une déclaration d'applicabilité qui sort de l'outil doit pouvoir être remise
-- telle quelle : elle porte le nom légal de l'organisation, son adresse, son
-- identifiant d'immatriculation, son logo, et la mention de confidentialité
-- sous laquelle elle circule. Rien de tout cela n'existait — l'organisation ne
-- connaissait d'elle-même qu'un nom d'usage, un secteur et un pays.
--
-- Ces informations ne gouvernent rien : aucun gate ne les lit, aucun risque
-- n'en dépend. Ce sont des informations d'en-tête. Elles sont néanmoins
-- journalisées comme le reste (migration 0033) : changer le nom légal qui
-- figure sur un document remis à un auditeur n'est pas anodin.
--
-- LE LOGO. Il vit dans un bucket privé, pas dans une colonne : un fichier
-- binaire dans une table se réplique dans chaque sauvegarde et se relit mal.
-- La colonne porte le chemin. La lecture passe par une URL signée courte,
-- produite côté serveur — un logo client n'a pas à être servi publiquement à
-- qui devine son URL.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Identité postale et légale
-- -----------------------------------------------------------------------------
alter table public.organization
  add column address_line1        text,
  add column address_line2        text,
  add column postal_code          text,
  add column city                 text,
  add column registration_number  text,
  add column vat_number           text,
  add column website              text,
  add column contact_name         text,
  add column contact_email        text,
  add column contact_phone        text,
  add column logo_path            text,
  add column logo_updated_at      timestamptz,
  add column confidentiality_label text not null default 'Confidentiel',
  add column document_footer_note text;

comment on column public.organization.confidentiality_label is
  'Mention portée en pied de chaque document imprimé. « Confidentiel » par defaut : un registre d''usages d''IA et une declaration d''applicabilite ne circulent pas librement.';
comment on column public.organization.logo_path is
  'Chemin du logo dans le bucket prive `branding`. Jamais une URL : la lecture passe par une URL signee courte produite cote serveur.';
comment on column public.organization.document_footer_note is
  'Mention libre ajoutee au pied de page des documents imprimes (reference de contrat, diffusion restreinte, etc.).';

-- Une mention de confidentialité vide n'aurait pas de sens : le pied de page
-- existe pour dire sous quel régime le document circule.
alter table public.organization
  add constraint organization_confidentiality_not_blank
  check (btrim(confidentiality_label) <> '');

-- -----------------------------------------------------------------------------
-- Le bucket des logos
-- -----------------------------------------------------------------------------
-- Prive. Chemin impose : <tenant_id>/<organization_id>/<nom>. Le prefixe est
-- ce qui rend l'isolation verifiable — la policy lit le tenant dans le premier
-- segment, jamais dans une colonne que l'appelant pourrait choisir.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'branding',
  'branding',
  false,
  2 * 1024 * 1024,
  array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
on conflict (id) do nothing;

-- Lecture : appartenir au tenant suffit. Contrairement aux preuves, un logo
-- n'est pas une piece d'audit — mais il reste la marque d'un client, et
-- l'administrateur plateforme n'a pas besoin de le telecharger.
create policy branding_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'branding'
    and app.tenant_role((storage.foldername(name))[1]::uuid) is not null
  );

-- Ecriture : reservee a qui administre la configuration du tenant.
create policy branding_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'branding'
    and app.has_tenant_role((storage.foldername(name))[1]::uuid, app.roles_administer())
  );

create policy branding_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'branding'
    and app.has_tenant_role((storage.foldername(name))[1]::uuid, app.roles_administer())
  );

create policy branding_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'branding'
    and app.has_tenant_role((storage.foldername(name))[1]::uuid, app.roles_administer())
  );

-- -----------------------------------------------------------------------------
-- Le chemin du logo ne se choisit pas librement
-- -----------------------------------------------------------------------------
-- Meme regle que pour les preuves (migration 0028) : le prefixe est derive,
-- jamais accepte tel quel. Une organisation ne peut pas pointer le logo d'une
-- autre, ni sortir du bucket.
create or replace function app.guard_organization_logo()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_prefix text;
begin
  if new.logo_path is null then
    new.logo_updated_at := null;
    return new;
  end if;

  v_prefix := new.tenant_id::text || '/' || new.id::text || '/';

  if left(new.logo_path, length(v_prefix)) <> v_prefix then
    raise exception 'Le logo doit être déposé sous %', v_prefix
      using errcode = 'check_violation';
  end if;

  if new.logo_path is distinct from coalesce(old.logo_path, '') then
    new.logo_updated_at := now();
  end if;

  return new;
end;
$$;

create trigger organization_guard_logo
  before insert or update on public.organization
  for each row execute function app.guard_organization_logo();

-- -----------------------------------------------------------------------------
-- L'en-tête d'un document
-- -----------------------------------------------------------------------------
-- Une seule lecture pour les deux vues imprimables, afin que le registre et la
-- déclaration d'applicabilité ne divergent jamais sur l'identité qu'ils
-- portent.
create or replace function app.document_identity(p_organization_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select jsonb_build_object(
    'organization_id',       o.id,
    'business_ref',          o.business_ref,
    'name',                  o.name,
    'legal_name',            coalesce(o.legal_name, o.name),
    'sector',                o.sector,
    'address_line1',         o.address_line1,
    'address_line2',         o.address_line2,
    'postal_code',           o.postal_code,
    'city',                  o.city,
    'country_code',          o.country_code,
    'registration_number',   o.registration_number,
    'vat_number',            o.vat_number,
    'website',               o.website,
    'contact_name',          o.contact_name,
    'contact_email',         o.contact_email,
    'contact_phone',         o.contact_phone,
    'logo_path',             o.logo_path,
    'confidentiality_label', o.confidentiality_label,
    'footer_note',           o.document_footer_note,
    'tenant_name',           t.name
  )
  from public.organization o
  join public.tenant t on t.id = o.tenant_id
  where o.id = p_organization_id;
$$;

comment on function app.document_identity is
  'En-tête et pied de page des documents imprimables. Une seule lecture pour le registre et la déclaration d''applicabilité : les deux ne peuvent pas diverger sur l''identité qu''ils portent.';

create or replace function public.document_identity(p_organization_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select app.document_identity(p_organization_id);
$$;

grant execute on function public.document_identity(uuid) to authenticated;
