-- =============================================================================
-- AIGMS — 0028 — Dépôt de preuves
-- =============================================================================
-- Le chemin du risque (0027) désigne le plus souvent la même rupture :
-- `no_evidence`. Jusqu'ici elle était irréparable depuis la plateforme — on
-- pouvait déclarer une preuve, pas la déposer. Ce dépôt ferme la boucle.
--
-- Trois règles portent tout le reste, et elles sont en base :
--
--   1. **Le chemin de stockage est dérivé, jamais saisi.** Il commence par
--      `<tenant>/<organisation>/`, et un garde-fou le vérifie. Sans cela, une
--      ligne de preuve pourrait pointer vers l'objet d'un autre client.
--
--   2. **Un fichier déposé porte son empreinte.** Sans `content_hash`, un
--      auditeur ne peut pas établir que le fichier qu'il télécharge est celui
--      qui a été validé.
--
--   3. **Une preuve validée est figée.** Son fichier ne se remplace pas ; on
--      dépose une nouvelle preuve et l'ancienne devient `superseded`. Une
--      preuve dont le contenu change après validation ne prouve plus rien.
--
-- Portabilité : la base ne stocke jamais d'URL, seulement un couple
-- (`storage_bucket`, `storage_path`). L'arborescence
-- `<tenant>/<organisation>/<preuve>/<fichier>` se transpose telle quelle sur
-- n'importe quel stockage compatible S3 — c'est ce qui rend un hébergement
-- IaaS possible sans reprise de données.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Le fichier, décrit dans la ligne de preuve
-- -----------------------------------------------------------------------------
alter table public.evidence
  add column storage_bucket   text,
  add column file_name        text,
  add column file_size_bytes  bigint check (file_size_bytes is null or file_size_bytes > 0),
  add column mime_type        text,
  add column superseded_by    uuid references public.evidence (id) on delete set null;

comment on column public.evidence.storage_bucket is
  'Compartiment de stockage. Couple avec storage_path pour designer l''objet sans jamais figer d''URL : le meme couple vaut sur Supabase Storage comme sur un stockage compatible S3.';
comment on column public.evidence.storage_path is
  'Chemin de l''objet, derive et non saisi : <tenant>/<organisation>/<preuve>/<fichier>. Verifie par app.guard_evidence_file.';
comment on column public.evidence.superseded_by is
  'Preuve qui remplace celle-ci. Une preuve validee ne se modifie pas : elle se remplace, et la trace des deux subsiste.';

alter table public.evidence
  add constraint evidence_file_requires_hash check (
    storage_path is null or btrim(coalesce(content_hash, '')) <> ''
  ),
  add constraint evidence_file_requires_bucket check (
    (storage_path is null) = (storage_bucket is null)
  );

create index evidence_org_freshness_idx
  on public.evidence (organization_id, validation_status, valid_until);

-- -----------------------------------------------------------------------------
-- Garde-fous du fichier
-- -----------------------------------------------------------------------------
create or replace function app.guard_evidence_file()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_expected_prefix text;
begin
  if new.storage_path is not null then
    v_expected_prefix := new.tenant_id || '/' || new.organization_id || '/';
    if left(new.storage_path, length(v_expected_prefix)) <> v_expected_prefix then
      raise exception 'Le chemin de stockage doit commencer par « % ». Il est dérivé, jamais saisi.', v_expected_prefix
        using errcode = 'check_violation';
    end if;
  end if;

  -- Une preuve validée est figée. La corriger reviendrait à changer, après
  -- coup, ce qu'un validateur nommé a déclaré avoir examiné.
  if tg_op = 'UPDATE' and old.validation_status = 'validated' then
    if new.storage_path is distinct from old.storage_path
       or new.content_hash is distinct from old.content_hash
       or new.file_size_bytes is distinct from old.file_size_bytes then
      raise exception 'Le fichier d''une preuve validée ne se remplace pas. Déposer une nouvelle preuve, celle-ci devenant « remplacée ».'
        using errcode = 'check_violation';
    end if;
  end if;

  -- La validation est un acte nominatif : on valide en son propre nom.
  --
  -- La regle porte sur l'ACTE — le passage a « validee » — et non sur la
  -- creation d'une ligne deja validee. Une reprise de donnees ou un import
  -- CONNECT porte legitimement une validation faite ailleurs, par quelqu'un
  -- d'autre ; c'est le journal qui dit alors qui l'a versee.
  if tg_op = 'UPDATE'
     and new.validation_status = 'validated'
     and old.validation_status is distinct from 'validated'
     and new.validated_by is distinct from app.current_user_id() then
    raise exception 'Une preuve se valide en son propre nom.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger evidence_guard_file before insert or update on public.evidence
  for each row execute function app.guard_evidence_file();

comment on function app.guard_evidence_file is
  'Chemin de stockage confine au tenant, fichier fige apres validation, validation nominative.';

-- -----------------------------------------------------------------------------
-- Journal
-- -----------------------------------------------------------------------------
create or replace function app.audit_evidence()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    perform app.log_audit(
      new.tenant_id, 'create', 'evidence', new.id, new.business_ref,
      case when new.storage_path is null
           then format('Preuve « %s » déclarée', new.title)
           else format('Preuve « %s » déposée (%s)', new.title, coalesce(new.file_name, 'fichier'))
      end,
      null, jsonb_build_object('validation_status', new.validation_status));
  elsif old.validation_status is distinct from new.validation_status
        and new.validation_status = 'validated' then
    perform app.log_audit(
      new.tenant_id, 'evidence_validated', 'evidence', new.id, new.business_ref,
      format('Preuve « %s » validée', new.title),
      jsonb_build_object('validation_status', old.validation_status),
      jsonb_build_object('validation_status', new.validation_status,
                         'content_hash', new.content_hash));
  end if;
  return new;
end;
$$;

create trigger evidence_audit after insert or update on public.evidence
  for each row execute function app.audit_evidence();

-- -----------------------------------------------------------------------------
-- Le compartiment et son isolation
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('evidence', 'evidence', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

-- Le tenant se lit dans le premier segment du chemin. Un chemin qui n'en porte
-- pas d'exploitable ne donne acces a rien : le cast echoue, la fonction rend
-- null, et null n'ouvre aucune politique.
create or replace function app.storage_tenant(p_path text)
returns uuid
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  return split_part(p_path, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

comment on function app.storage_tenant is
  'Tenant proprietaire d''un objet, lu dans le premier segment de son chemin. Rend null sur un chemin non conforme, ce qui n''ouvre aucune politique.';

grant execute on function app.storage_tenant(text) to authenticated, service_role;

-- La lecture d'un fichier de preuve exige une appartenance reelle au tenant.
-- `app.tenant_role` n'accorde rien a l'administrateur de plateforme : celui-ci
-- voit qu'une preuve existe, il ne telecharge pas le document d'un client.
create policy evidence_object_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidence'
    and app.tenant_role(app.storage_tenant(name)) is not null
  );

create policy evidence_object_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and app.has_tenant_role(app.storage_tenant(name), app.roles_contribute())
  );

create policy evidence_object_remove on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'evidence'
    and app.has_tenant_role(app.storage_tenant(name), app.roles_contribute())
  );

-- Aucune politique UPDATE : un objet ne se remplace pas sur place. C'est le
-- pendant, cote stockage, de l'immuabilite d'une preuve validee.

-- -----------------------------------------------------------------------------
-- Le registre des preuves
-- -----------------------------------------------------------------------------
create or replace function app.evidence_register(p_organization_id uuid)
returns table (
  id                uuid,
  business_ref      text,
  title             text,
  evidence_type     app.evidence_type,
  source            text,
  file_name         text,
  file_size_bytes   bigint,
  mime_type         text,
  storage_bucket    text,
  storage_path      text,
  external_url      text,
  content_hash      text,
  version           text,
  collected_at      timestamptz,
  valid_until       date,
  freshness         app.evidence_freshness,
  validation_status app.evidence_validation_status,
  owner_name        text,
  validated_by_name text,
  validated_at      timestamptz,
  superseded_by     uuid,
  control_count     integer,
  control_codes     text[]
)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select
    e.id, e.business_ref, e.title, e.evidence_type, e.source,
    e.file_name, e.file_size_bytes, e.mime_type,
    e.storage_bucket, e.storage_path, e.external_url, e.content_hash, e.version,
    e.collected_at, e.valid_until,
    app.evidence_freshness(e.valid_until),
    e.validation_status,
    coalesce(owner.full_name, owner.email),
    coalesce(validator.full_name, validator.email),
    e.validated_at,
    e.superseded_by,
    count(ce.control_id)::integer,
    coalesce(array_agg(c.code order by c.code) filter (where c.code is not null), array[]::text[])
  from public.evidence e
  join public.organization o on o.id = e.organization_id
  left join public.user_profile owner     on owner.id = e.owner_user_id
  left join public.user_profile validator on validator.id = e.validated_by
  left join public.control_evidence ce on ce.evidence_id = e.id
  left join public.control c on c.id = ce.control_id
  where e.organization_id = p_organization_id
    and app.has_tenant_access(o.tenant_id)
  group by e.id, e.business_ref, e.title, e.evidence_type, e.source,
           e.file_name, e.file_size_bytes, e.mime_type, e.storage_bucket,
           e.storage_path, e.external_url, e.content_hash, e.version,
           e.collected_at, e.valid_until, e.validation_status,
           owner.full_name, owner.email, validator.full_name, validator.email,
           e.validated_at, e.superseded_by
  order by e.collected_at desc;
$$;

comment on function app.evidence_register is
  'Registre des preuves d''une organisation : fraicheur, validation, controles adosses. Une seule lecture pour l''ecran.';

-- Contrôles auxquels une preuve peut être adossée, avec l'état de leur dossier.
create or replace function app.controls_awaiting_evidence(p_organization_id uuid)
returns table (
  id             uuid,
  code           text,
  name           text,
  status         app.control_status,
  is_mandatory   boolean,
  evidence_count integer,
  is_evidenced   boolean
)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select
    c.id, c.code, c.name, c.status, c.is_mandatory,
    count(ce.evidence_id)::integer,
    coalesce(bool_or(e.validation_status = 'validated'
                     and app.evidence_freshness(e.valid_until) <> 'expired'), false)
  from public.control c
  join public.organization o on o.id = c.organization_id
  left join public.control_evidence ce on ce.control_id = c.id
  left join public.evidence e on e.id = ce.evidence_id
  where c.organization_id = p_organization_id
    and app.has_tenant_access(o.tenant_id)
  group by c.id, c.code, c.name, c.status, c.is_mandatory
  order by (c.status = 'operating' and not coalesce(bool_or(
              e.validation_status = 'validated'
              and app.evidence_freshness(e.valid_until) <> 'expired'), false)) desc,
           c.is_mandatory desc, c.code;
$$;

comment on function app.controls_awaiting_evidence is
  'Controles d''une organisation, les plus demunis en tete : operants mais sans preuve valide.';

-- -----------------------------------------------------------------------------
-- Surface d'API
-- -----------------------------------------------------------------------------
create or replace function public.evidence_register(p_organization_id uuid)
returns table (
  id uuid, business_ref text, title text, evidence_type app.evidence_type, source text,
  file_name text, file_size_bytes bigint, mime_type text,
  storage_bucket text, storage_path text, external_url text, content_hash text, version text,
  collected_at timestamptz, valid_until date, freshness app.evidence_freshness,
  validation_status app.evidence_validation_status, owner_name text,
  validated_by_name text, validated_at timestamptz, superseded_by uuid,
  control_count integer, control_codes text[]
)
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select * from app.evidence_register(p_organization_id); $$;

create or replace function public.controls_awaiting_evidence(p_organization_id uuid)
returns table (
  id uuid, code text, name text, status app.control_status,
  is_mandatory boolean, evidence_count integer, is_evidenced boolean
)
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select * from app.controls_awaiting_evidence(p_organization_id); $$;

revoke all on function public.evidence_register(uuid)          from public, anon;
revoke all on function public.controls_awaiting_evidence(uuid) from public, anon;
grant execute on function public.evidence_register(uuid)          to authenticated;
grant execute on function public.controls_awaiting_evidence(uuid) to authenticated;
