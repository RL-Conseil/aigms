-- =============================================================================
-- AIGMS — 0036 — Marque du tenant (revente en marque blanche)
-- =============================================================================
-- AIGMS se revend. Un cabinet qui pilote un portefeuille de clients veut que
-- ses clients voient SA marque, pas celle de l'editeur — et l'editeur veut que
-- ce changement soit un reglage, pas un fork.
--
-- La marque se pose au niveau du TENANT, pas de l'organisation : c'est le
-- cabinet qui revend, pas son client. Une organisation garde son propre logo
-- (migration 0035) pour ses documents remis ; les deux ne servent pas la meme
-- chose et ne doivent pas se confondre.
--
-- CE QUI RESTE. La mention de l'editeur (« Designed by Caritis ») se retire
-- quand le tenant pose sa marque : c'est le principe meme de la marque blanche.
-- Elle reste en revanche sur la mire de connexion tant qu'aucun domaine propre
-- n'y conduit — avant authentification, on ne sait pas quel tenant se presente.
-- =============================================================================

alter table public.tenant
  add column brand_label   text not null default 'AIGMS',
  add column brand_tagline text default 'Designed by Caritis',
  add column logo_path     text,
  add column logo_updated_at timestamptz;

comment on column public.tenant.brand_label is
  'Nom porte par l''en-tete de l''application. « AIGMS » par defaut ; un tenant qui revend y met le sien.';
comment on column public.tenant.brand_tagline is
  'Mention secondaire a cote du nom. NULL la supprime — c''est le principe de la marque blanche.';
comment on column public.tenant.logo_path is
  'Chemin du logo dans le bucket prive `branding`, sous <tenant_id>/plateforme/. Jamais une URL.';

alter table public.tenant
  add constraint tenant_brand_label_not_blank check (btrim(brand_label) <> '');

-- -----------------------------------------------------------------------------
-- Le chemin du logo ne se choisit pas librement
-- -----------------------------------------------------------------------------
-- Meme regle qu'ailleurs (migrations 0028, 0035) : le prefixe est derive, pas
-- accepte tel quel. Un tenant ne peut pas pointer le logo d'un autre.
create or replace function app.guard_tenant_logo()
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

  v_prefix := new.id::text || '/plateforme/';

  if left(new.logo_path, length(v_prefix)) <> v_prefix then
    raise exception 'Le logo de la plateforme doit être déposé sous %', v_prefix
      using errcode = 'check_violation';
  end if;

  if new.logo_path is distinct from coalesce(old.logo_path, '') then
    new.logo_updated_at := now();
  end if;

  return new;
end;
$$;

create trigger tenant_guard_logo
  before insert or update on public.tenant
  for each row execute function app.guard_tenant_logo();

-- -----------------------------------------------------------------------------
-- La marque du tenant courant
-- -----------------------------------------------------------------------------
-- Lue a chaque affichage de l'en-tete : une seule fonction, pour que la marque
-- ne se calcule pas differemment selon l'ecran.
create or replace function app.tenant_branding()
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select jsonb_build_object(
    'tenant_id', t.id,
    'name',      t.name,
    'label',     t.brand_label,
    'tagline',   t.brand_tagline,
    'logo_path', t.logo_path
  )
  from public.tenant t
  join public.membership m on m.tenant_id = t.id
  where m.user_id = app.current_user_id()
    and m.status = 'active'
  limit 1;
$$;

comment on function app.tenant_branding is
  'Marque portee par l''en-tete pour l''utilisateur courant. SECURITY INVOKER : la RLS decide de ce qui est visible.';

create or replace function public.tenant_branding()
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select app.tenant_branding();
$$;

grant execute on function public.tenant_branding() to authenticated;

-- -----------------------------------------------------------------------------
-- Qui peut changer la marque
-- -----------------------------------------------------------------------------
-- La policy d'ecriture sur `tenant` existe deja (0005) et reserve la
-- modification a l'administration de la plateforme. Rien a ajouter : changer la
-- marque, c'est modifier le tenant.
