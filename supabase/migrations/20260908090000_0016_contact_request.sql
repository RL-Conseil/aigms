-- =============================================================================
-- AIGMS — 0016 — Demandes de contact
-- =============================================================================
-- Cette table est la SEULE surface publique d'AIGMS. Elle constitue une
-- exception délibérée à la règle « anon ne dispose d'aucun droit » posée en
-- migration 0005 : le formulaire de la page publique doit pouvoir écrire sans
-- session. L'exception est bornée :
--
--   * INSERT uniquement — anon ne lit jamais, ne modifie jamais, n'efface
--     jamais ; il ne peut donc pas relire ce que d'autres ont soumis ;
--   * aucune donnée de gouvernance n'y transite : ce sont des coordonnées
--     professionnelles laissées volontairement par un visiteur ;
--   * la table ne porte pas de tenant_id — une demande entrante n'appartient à
--     aucun client — et sa lecture est réservée à l'administration plateforme.
-- =============================================================================

-- Ces deux types vivent dans `public`, contrairement à tous les autres
-- énumérés du produit. Raison : référencer un type défini dans `app` exige
-- USAGE sur ce schéma, et le rôle anonyme ne doit pas l'obtenir pour la seule
-- commodité d'un formulaire. La surface publique reste ainsi confinée à
-- `public`.
create type public.contact_request_status as enum ('new', 'contacted', 'qualified', 'archived', 'spam');

create type public.contact_profile as enum (
  'direction', 'dsi_rssi_dpo', 'metier', 'conseil_msp_integrateur', 'autre'
);

create table public.contact_request (
  id             uuid primary key default gen_random_uuid(),

  full_name      text not null check (btrim(full_name) <> '' and length(full_name) <= 120),
  email          text not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and length(email) <= 254),
  organization   text not null check (btrim(organization) <> '' and length(organization) <= 160),
  phone          text check (phone is null or length(phone) <= 40),
  profile        public.contact_profile not null default 'autre',
  message        text check (message is null or length(message) <= 2000),

  status         public.contact_request_status not null default 'new',
  handled_by     uuid references public.user_profile (id) on delete set null,
  handled_at     timestamptz,
  internal_note  text,

  created_at     timestamptz not null default now(),
  -- Jour de dépôt, figé à l'insertion : `created_at::date` dépend du fuseau de
  -- la session et ne peut donc pas servir de clé d'index.
  created_on     date not null default (now() at time zone 'UTC')::date,
  updated_at     timestamptz not null default now()
);

comment on table public.contact_request is
  'Demandes de rappel laissées depuis la page publique. Seule table acceptant une écriture anonyme ; jamais lue par anon.';
comment on column public.contact_request.internal_note is
  'Note de qualification interne. Jamais exposée au demandeur.';

create index contact_request_status_idx on public.contact_request (status, created_at desc);

-- Garde-fou anti-flood : une même adresse ne peut déposer qu'une demande par
-- jour. Ce n'est pas une limitation de débit complète — un attaquant faisant
-- varier l'adresse passe outre — mais cela suffit à écarter le double clic et
-- la soumission répétée, sans dépendre d'une infrastructure supplémentaire.
create unique index contact_request_daily_email_idx
  on public.contact_request (lower(email), created_on);

create trigger contact_request_touch_updated_at
  before update on public.contact_request
  for each row execute function app.touch_updated_at();

alter table public.contact_request enable row level security;
alter table public.contact_request force  row level security;

-- Écriture publique, strictement limitée à l'insertion d'une demande neuve.
create policy contact_request_public_insert on public.contact_request
  for insert to anon, authenticated
  with check (
    status = 'new'
    and created_on = (now() at time zone 'UTC')::date
    and handled_by is null
    and handled_at is null
    and internal_note is null
  );

-- Lecture et suivi : administration plateforme uniquement.
create policy contact_request_admin_select on public.contact_request
  for select to authenticated
  using (app.is_platform_admin());

create policy contact_request_admin_update on public.contact_request
  for update to authenticated
  using (app.is_platform_admin())
  with check (app.is_platform_admin());

revoke all    on public.contact_request from anon, authenticated;
grant  insert on public.contact_request to anon;
grant  select, insert, update on public.contact_request to authenticated;
