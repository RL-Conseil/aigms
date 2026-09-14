-- =============================================================================
-- AIGMS — 0032 — Organisation courante et organisations gérées
-- =============================================================================
-- Une personne peut se voir attribuer un rôle sur plusieurs organisations. Rien
-- ne disait laquelle elle regarde : l'application listait tout ce que la RLS
-- laissait voir, et l'utilisateur se replaçait de mémoire à chaque connexion.
--
-- Deux notions, distinctes :
--
--   * les organisations GÉRÉES — celles sur lesquelles l'administration a
--     attribué un rôle. C'est un fait de gouvernance, pas une préférence.
--
--   * l'organisation COURANTE — celle sur laquelle on travaille en ce moment.
--     C'est un choix de la personne, et il la suit d'un poste à l'autre : le
--     stocker dans un témoin de navigation le ferait varier selon l'endroit
--     d'où l'on se connecte, et « Mon organisation » n'aurait plus de contenu
--     stable à montrer.
--
-- Le choix est contraint : on ne peut se placer que sur une organisation qu'on
-- gère effectivement. Une préférence d'affichage n'ouvre aucun droit — la RLS
-- resterait de toute façon souveraine — mais laisser pointer vers une
-- organisation hors périmètre produirait des écrans vides et inexplicables.
-- =============================================================================

alter table public.user_profile
  add column current_organization_id uuid references public.organization (id) on delete set null;

comment on column public.user_profile.current_organization_id is
  'Organisation sur laquelle la personne travaille. Choix de la personne, contraint aux organisations qu''elle gere. N''ouvre aucun droit : la RLS reste souveraine.';

-- -----------------------------------------------------------------------------
-- Organisations gérées
-- -----------------------------------------------------------------------------
-- Un rôle de gouvernance ne voit que les organisations sur lesquelles un rôle
-- lui a été attribué. L'administration de plateforme, elle, voit toutes celles
-- de son tenant : c'est elle qui les crée, et elle ne peut pas attribuer un
-- rôle sur une organisation qu'elle ne verrait pas.
-- -----------------------------------------------------------------------------
create or replace function app.managed_organizations()
returns table (
  id            uuid,
  business_ref  text,
  name          text,
  legal_name    text,
  sector        text,
  country_code  char(2),
  headcount     integer,
  status        app.organization_status,
  ai_activity_profile app.ai_activity_profile,
  created_at    timestamptz,
  role          app.app_role
)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select
    o.id, o.business_ref, o.name, o.legal_name, o.sector, o.country_code,
    o.headcount, o.status, o.ai_activity_profile, o.created_at,
    (select ra.role
     from public.role_assignment ra
     where ra.organization_id = o.id
       and ra.user_id = app.current_user_id()
     limit 1)
  from public.organization o
  where app.has_tenant_access(o.tenant_id)
    and (
      exists (
        select 1 from public.role_assignment ra
        where ra.organization_id = o.id and ra.user_id = app.current_user_id()
      )
      or app.has_tenant_role(o.tenant_id, app.roles_administer())
    )
  order by o.name;
$$;

comment on function app.managed_organizations is
  'Organisations sur lesquelles la personne detient une attribution de role. L''administration de plateforme voit celles de son tenant : elle les cree, et ne peut attribuer un role sur ce qu''elle ne verrait pas.';

-- -----------------------------------------------------------------------------
-- Organisation courante
-- -----------------------------------------------------------------------------
-- Sans choix explicite et avec une seule organisation gérée, il n'y a rien à
-- choisir : on la rend. Forcer une sélection pour un cas sans alternative
-- serait une formalité vide.
-- -----------------------------------------------------------------------------
create or replace function app.current_organization()
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select coalesce(
    (select p.current_organization_id
     from public.user_profile p
     where p.id = app.current_user_id()
       and exists (
         select 1 from app.managed_organizations() m where m.id = p.current_organization_id
       )),
    (select m.id
     from app.managed_organizations() m
     where (select count(*) from app.managed_organizations()) = 1)
  );
$$;

comment on function app.current_organization is
  'Organisation sur laquelle la personne travaille : son choix s''il reste valide, sinon la seule qu''elle gere. Nul lorsqu''il y a un choix a faire, ou rien a montrer.';

-- -----------------------------------------------------------------------------
-- Garde-fou du choix
-- -----------------------------------------------------------------------------
create or replace function app.guard_current_organization()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if new.current_organization_id is null
     or new.current_organization_id is not distinct from old.current_organization_id then
    return new;
  end if;

  -- On ne se place que sur une organisation qu'on gere. Pointer ailleurs ne
  -- donnerait aucun droit, mais produirait des ecrans vides et inexplicables.
  if not exists (
    select 1 from app.managed_organizations() m where m.id = new.current_organization_id
  ) then
    raise exception 'Cette organisation ne fait pas partie de celles que vous gérez.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger user_profile_guard_current_organization
  before update on public.user_profile
  for each row execute function app.guard_current_organization();

-- -----------------------------------------------------------------------------
-- Surface d'API
-- -----------------------------------------------------------------------------
create or replace function public.managed_organizations()
returns table (
  id uuid, business_ref text, name text, legal_name text, sector text,
  country_code char(2), headcount integer, status app.organization_status,
  ai_activity_profile app.ai_activity_profile, created_at timestamptz, role app.app_role
)
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select * from app.managed_organizations(); $$;

create or replace function public.current_organization()
returns uuid
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select app.current_organization(); $$;

revoke all on function public.managed_organizations() from public, anon;
revoke all on function public.current_organization()  from public, anon;
grant execute on function public.managed_organizations() to authenticated;
grant execute on function public.current_organization()  to authenticated;
