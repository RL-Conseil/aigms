-- =============================================================================
-- AIGMS — Jeu de démonstration « IzarLink Demo »
-- =============================================================================
-- Ce seed ne pose pas les statuts directement : il rejoue le parcours réel en
-- se plaçant dans le contexte du governance officer (claim JWT `sub`), de sorte
-- que chaque transition traverse app.transition_use_case et ses gates. Si un
-- gate régresse, le seed échoue — c'est voulu.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Comptes de démonstration
-- -----------------------------------------------------------------------------
-- GoTrue lit les colonnes de jeton en `string` non nullable : elles doivent
-- valoir la chaine vide, sinon toute authentification echoue en 500.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at,
                        confirmation_token, recovery_token,
                        email_change_token_new, email_change,
                        email_change_token_current, phone_change,
                        phone_change_token, reauthentication_token)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'officer@rl-conseil.demo',
   extensions.crypt('Demo!Passw0rd', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Camille Rousset"}', now(), now(),
   '', '', '', '', '', '', '', ''),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'owner@izarlink.demo',
   extensions.crypt('Demo!Passw0rd', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Dominique Etchart"}', now(), now(),
   '', '', '', '', '', '', '', ''),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'risk@izarlink.demo',
   extensions.crypt('Demo!Passw0rd', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Sacha Belarbi"}', now(), now(),
   '', '', '', '', '', '', '', ''),
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'auditor@rl-conseil.demo',
   extensions.crypt('Demo!Passw0rd', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Noa Lasserre"}', now(), now(),
   '', '', '', '', '', '', '', ''),
  ('77777777-7777-4777-8777-777777777777', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'reviewer@izarlink.demo',
   extensions.crypt('Demo!Passw0rd', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Yann Cazaux"}', now(), now(),
   '', '', '', '', '', '', '', ''),
  ('66666666-6666-4666-8666-666666666666', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@rl-conseil.demo',
   extensions.crypt('Demo!Passw0rd', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Inès Duhamel"}', now(), now(),
   '', '', '', '', '', '', '', ''),
  -- Utilisateur d'un second tenant : sert aux tests d'isolation.
  ('55555555-5555-4555-8555-555555555555', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'officer@autre-cabinet.demo',
   extensions.crypt('Demo!Passw0rd', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Alex Moreau"}', now(), now(),
   '', '', '', '', '', '', '', '')
on conflict (id) do nothing;

-- GoTrue exige une identite de fournisseur pour la connexion par mot de passe.
insert into auth.identities (id, user_id, provider_id, provider, identity_data,
                             last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
from auth.users u
where u.email like '%.demo'
on conflict do nothing;

update public.user_profile set job_title = 'AI Governance Officer'
 where id = '11111111-1111-4111-8111-111111111111';
update public.user_profile set job_title = 'Responsable Supply Chain'
 where id = '22222222-2222-4222-8222-222222222222';
update public.user_profile set job_title = 'RSSI'
 where id = '33333333-3333-4333-8333-333333333333';
update public.user_profile set job_title = 'Auditeur interne'
 where id = '44444444-4444-4444-8444-444444444444';
update public.user_profile set job_title = 'Directeur des opérations'
 where id = '77777777-7777-4777-8777-777777777777';

-- Administration plateforme : accède au suivi des demandes de contact. Ce
-- privilège traverse les tenants, il est donc porté par un compte dédié et
-- jamais par un officer, dont l'étanchéité est vérifiée par les tests.
update public.user_profile
   set job_title = 'Administration plateforme', is_platform_admin = true
 where id = '66666666-6666-4666-8666-666666666666';

-- -----------------------------------------------------------------------------
-- Deux tenants : le second n'existe que pour prouver l'étanchéité
-- -----------------------------------------------------------------------------
insert into public.tenant (id, slug, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'rl-conseil', 'RL Conseil'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'autre-cabinet', 'Autre Cabinet')
on conflict (id) do nothing;

insert into public.membership (tenant_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'governance_officer'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'system_owner'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'risk_owner'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'auditor'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '77777777-7777-4777-8777-777777777777', 'reviewer'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '66666666-6666-4666-8666-666666666666', 'platform_admin'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '55555555-5555-4555-8555-555555555555', 'governance_officer')
on conflict do nothing;

insert into public.organization (id, tenant_id, name, legal_name, sector, country_code, headcount, status) values
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'IzarLink Demo', 'IzarLink SAS', 'Logistique et services numériques', 'FR', 240, 'active'),
  ('dddddddd-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002',
   'Client Concurrent', 'Concurrent SA', 'Industrie', 'FR', 90, 'active')
on conflict (id) do nothing;

insert into public.business_unit (id, tenant_id, organization_id, name) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'Direction des Opérations'),
  ('eeeeeeee-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'Direction des Ressources Humaines')
on conflict (id) do nothing;

insert into public.role_assignment (tenant_id, organization_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111111', 'governance_officer'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   '33333333-3333-4333-8333-333333333333', 'risk_owner'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   '44444444-4444-4444-8444-444444444444', 'auditor'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   '22222222-2222-4222-8222-222222222222', 'system_owner'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   '77777777-7777-4777-8777-777777777777', 'reviewer')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Catalogue de référentiels (plateforme)
-- -----------------------------------------------------------------------------
insert into public.framework (id, code, version, name, publisher, official_source, effective_from) values
  ('f0000000-0000-4000-8000-000000000002', 'EU_AI_ACT', '2024/1689',
   'Règlement (UE) 2024/1689 établissant des règles harmonisées concernant l''IA', 'Union européenne',
   'https://eur-lex.europa.eu/eli/reg/2024/1689/oj', '2024-08-01'),
  ('f0000000-0000-4000-8000-000000000003', 'ISO_IEC_42005', '2025',
   'Évaluation de l''impact des systèmes d''IA', 'ISO/IEC', 'https://www.iso.org/standard/44545.html', '2025-05-01'),
  ('f0000000-0000-4000-8000-000000000004', 'GDPR', '2016/679',
   'Règlement général sur la protection des données', 'Union européenne',
   'https://eur-lex.europa.eu/eli/reg/2016/679/oj', '2018-05-25')
on conflict (code, version) do nothing;

-- Exigences du CORPS des normes, distinctes de l'Annexe A d'ISO 42001 chargee
-- par la migration 0022. Le rattachement se fait par cle naturelle : les
-- referentiels peuvent etre poses par une migration ou par un import.
insert into public.requirement (framework_id, requirement_reference, title, internal_summary, status, effective_from, official_source)
select f.id, v.reference, v.title, v.summary, v.status::app.requirement_status, v.effective_from::date, v.source
from (values
  ('ISO_IEC_42001', '2023', '6.1.2', 'Appréciation des risques liés à l''IA',
   'Résumé interne : définir et appliquer un processus d''appréciation des risques IA, avec critères, responsabilités et réexamen périodique.',
   'requirement', '2023-12-01', 'ISO/IEC 42001:2023'),
  ('ISO_IEC_42001', '2023', '8.4', 'Évaluation d''impact des systèmes d''IA',
   'Résumé interne : conduire une évaluation d''impact des systèmes d''IA et la tenir à jour au cours du cycle de vie.',
   'requirement', '2023-12-01', 'ISO/IEC 42001:2023'),
  ('ISO_IEC_42001', '2023', '9.3', 'Revue de direction',
   'Résumé interne : revue périodique du SMIA par la direction, avec entrées, décisions et actions.',
   'requirement', '2023-12-01', 'ISO/IEC 42001:2023'),
  ('EU_AI_ACT', '2024/1689', 'Art. 14', 'Contrôle humain',
   'Résumé interne : les systèmes à haut risque sont conçus pour permettre une supervision humaine effective pendant leur utilisation.',
   'requirement', null, 'Règlement (UE) 2024/1689'),
  ('EU_AI_ACT', '2024/1689', 'Art. 50', 'Obligations de transparence',
   'Résumé interne : informer les personnes qu''elles interagissent avec un système d''IA et marquer les contenus générés, selon les cas.',
   'requirement', null, 'Règlement (UE) 2024/1689'),
  ('ISO_IEC_42005', '2025', '6.4', 'Parties prenantes et impacts',
   'Résumé interne : identifier les parties prenantes affectées et documenter les impacts sur les personnes, les groupes et la société.',
   'guidance', '2025-05-01', 'ISO/IEC 42005:2025'),
  ('GDPR', '2016/679', 'Art. 35', 'Analyse d''impact relative à la protection des données',
   'Résumé interne : réaliser une AIPD lorsque le traitement est susceptible d''engendrer un risque élevé pour les droits et libertés.',
   'requirement', '2018-05-25', 'Règlement (UE) 2016/679')
) as v(fw_code, fw_version, reference, title, summary, status, effective_from, source)
join public.framework f on f.code = v.fw_code and f.version = v.fw_version
on conflict (framework_id, requirement_reference) do nothing;

commit;

-- =============================================================================
-- Parcours de gouvernance joué sous l'identité du governance officer.
-- =============================================================================
begin;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- --- Cartographie des processus -----------------------------------------------
-- La gouvernance part de l'activité métier : on encadre un usage d'IA parce
-- qu'il sert un processus, pas l'inverse.
insert into public.process (id, tenant_id, organization_id, code, name, description, category, display_order, owner_user_id) values
  ('c1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'PIL', 'Piloter l''entreprise',
   'Direction, gouvernance, pilotage de la performance.', 'management', 10, '11111111-1111-4111-8111-111111111111'),
  ('c1000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'LIV', 'Livrer',
   'Préparation, planification et exécution des livraisons clients.', 'core', 20, '22222222-2222-4222-8222-222222222222'),
  ('c1000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'SUP', 'Servir le client',
   'Relation client, support et réclamations.', 'core', 30, '22222222-2222-4222-8222-222222222222'),
  ('c1000000-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'RH', 'Gérer les ressources humaines',
   'Recrutement, intégration, développement des compétences.', 'support', 40, '33333333-3333-4333-8333-333333333333');

insert into public.activity (id, tenant_id, organization_id, process_id, name, description, display_order, business_unit_id, owner_user_id) values
  ('c2000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003',
   'Traitement des demandes clients', 'Réception, qualification et réponse aux demandes de niveau 1.', 10,
   'eeeeeeee-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222'),
  ('c2000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003',
   'Gestion des réclamations', 'Traitement des réclamations et des gestes commerciaux.', 20,
   'eeeeeeee-0000-4000-8000-000000000001', null),
  ('c2000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000004',
   'Présélection des candidatures', 'Réception et tri des candidatures avant entretien.', 10,
   'eeeeeeee-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333'),
  ('c2000000-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000004',
   'Intégration des nouveaux arrivants', 'Parcours d''accueil et montée en compétence.', 20,
   'eeeeeeee-0000-4000-8000-000000000002', null),
  ('c2000000-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002',
   'Planification des tournées', 'Ordonnancement quotidien des livraisons.', 10,
   'eeeeeeee-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222'),
  ('c2000000-0000-4000-8000-000000000006', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
   'Pilotage de la performance', 'Suivi des indicateurs et revues de direction.', 10,
   null, '11111111-1111-4111-8111-111111111111');

-- --- Fournisseurs -------------------------------------------------------------
insert into public.vendor (id, tenant_id, organization_id, name, is_model_provider, criticality,
                           country_code, dpa_signed, security_assessed, reversibility_documented,
                           review_status, reviewed_at, next_review_at, notes)
values
  ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'Nordic LLM Cloud', true, 'high', 'SE',
   true, true, true, 'approved', now() - interval '2 months', current_date + interval '10 months',
   'Fournisseur de modèle de langage, hébergement UE, sous-traitants déclarés.'),
  ('a1000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'TalentScreen Analytics', false, 'critical', 'US',
   false, false, false, 'in_progress', null, current_date + interval '1 month',
   'Éditeur de scoring de candidatures. DPA non signé, transfert hors UE à instruire.');

-- --- Actifs IA ----------------------------------------------------------------
insert into public.ai_asset (id, tenant_id, organization_id, kind, name, description, vendor_id, version, contains_personal_data, hosting_location)
values
  ('a2000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'ai_model', 'nordic-llm-instruct', 'Modèle de langage généraliste hébergé en UE.',
   'a1000000-0000-4000-8000-000000000001', '3.2', false, 'Suède (UE)'),
  ('a2000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'dataset', 'Historique tickets support 2023-2026',
   'Tickets clients anonymisés servant de base documentaire.', null, '2026.1', false, 'France'),
  ('a2000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'ai_system', 'Assistant support client', 'Assistant conversationnel interne.',
   'a1000000-0000-4000-8000-000000000001', '1.0', false, 'France'),
  ('a2000000-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'ai_system', 'Scoring de candidatures',
   'Classement automatisé des candidatures reçues.', 'a1000000-0000-4000-8000-000000000002', '2.4', true, 'États-Unis'),
  ('a2000000-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'ai_agent', 'Agent de planification tournées',
   'Agent optimisant les tournées de livraison.', null, '0.9', false, 'France');

-- --- Contrôles (8) ------------------------------------------------------------
insert into public.control (id, tenant_id, organization_id, code, name, objective, owner_user_id, status, is_mandatory, frequency, last_tested_at, next_test_at)
values
  ('a3000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'CTL-01', 'Registre des cas d''usage IA tenu à jour',
   'Garantir que tout usage d''IA est déclaré, qualifié et rattaché à un responsable.',
   '11111111-1111-4111-8111-111111111111', 'operating', true, 'Trimestrielle', current_date - interval '18 days', current_date + interval '2 months'),
  ('a3000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'CTL-02', 'Supervision humaine documentée',
   'Assurer qu''un responsable humain peut interrompre le système et connaît ses déclencheurs d''intervention.',
   '11111111-1111-4111-8111-111111111111', 'operating', true, 'Semestrielle', current_date - interval '42 days', current_date + interval '4 months'),
  ('a3000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'CTL-03', 'Information des utilisateurs sur l''usage d''IA',
   'Informer les personnes qu''elles interagissent avec un système d''IA.',
   '22222222-2222-4222-8222-222222222222', 'implemented', true, 'Annuelle', current_date - interval '96 days', current_date + interval '8 months'),
  ('a3000000-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'CTL-04', 'Revue de sécurité des fournisseurs IA',
   'Évaluer la sécurité, la localisation des données et la réversibilité avant contractualisation.',
   '33333333-3333-4333-8333-333333333333', 'operating', true, 'Annuelle', current_date - interval '61 days', current_date + interval '6 months'),
  ('a3000000-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'CTL-05', 'Journalisation des interactions IA',
   'Conserver une trace exploitable des sollicitations et réponses du système.',
   '33333333-3333-4333-8333-333333333333', 'implemented', false, 'Continue', current_date - interval '9 days', current_date + interval '3 months'),
  ('a3000000-0000-4000-8000-000000000006', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'CTL-06', 'Test de biais avant mise en service',
   'Détecter les écarts de traitement entre groupes avant déploiement.',
   '11111111-1111-4111-8111-111111111111', 'proposed', false, 'À chaque version', null, null),
  ('a3000000-0000-4000-8000-000000000007', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'CTL-07', 'Formation et littératie IA des utilisateurs',
   'Assurer que les utilisateurs comprennent les limites du système qu''ils exploitent.',
   '22222222-2222-4222-8222-222222222222', 'implemented', false, 'Annuelle', current_date - interval '210 days', current_date + interval '5 months'),
  ('a3000000-0000-4000-8000-000000000008', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'CTL-08', 'Revue périodique des décisions de gouvernance',
   'Réexaminer les décisions arrivées à échéance de revue.',
   '11111111-1111-4111-8111-111111111111', 'operating', false, 'Trimestrielle', current_date - interval '27 days', current_date + interval '1 month');

insert into public.control_requirement_map (tenant_id, control_id, requirement_id, coverage_note, mapped_by)
select 'aaaaaaaa-0000-4000-8000-000000000001', c.id, r.id, m.note, '11111111-1111-4111-8111-111111111111'
from (values
  ('CTL-01', 'ISO_IEC_42001', '6.1.2', 'Le registre alimente l''appréciation des risques.'),
  ('CTL-02', 'EU_AI_ACT',     'Art. 14', 'Couvre l''exigence de contrôle humain effectif.'),
  ('CTL-02', 'ISO_IEC_42001', '8.4',   'Contribue à l''évaluation d''impact.'),
  ('CTL-03', 'EU_AI_ACT',     'Art. 50', 'Couvre l''information des personnes.'),
  ('CTL-08', 'ISO_IEC_42001', '9.3',   'Alimente la revue de direction.'),
  -- Annexe A d'ISO/IEC 42001
  ('CTL-01', 'ISO_IEC_42001', 'A.4.2',   'Le registre documente les ressources de chaque système.'),
  ('CTL-01', 'ISO_IEC_42001', 'A.9.4',   'Il porte la finalité déclarée de chaque usage.'),
  ('CTL-02', 'ISO_IEC_42001', 'A.9.2',   'La supervision encadre l''emploi quotidien du système.'),
  ('CTL-02', 'ISO_IEC_42001', 'A.3.2',   'Elle nomme un responsable et une autorité d''arrêt.'),
  ('CTL-03', 'ISO_IEC_42001', 'A.8.2',   'L''information des utilisateurs relève de la documentation du système.'),
  ('CTL-04', 'ISO_IEC_42001', 'A.10.3',  'La revue fournisseur porte les exigences contractuelles.'),
  ('CTL-04', 'ISO_IEC_42001', 'A.10.2',  'Elle répartit les responsabilités entre les parties.'),
  ('CTL-05', 'ISO_IEC_42001', 'A.6.2.8', 'La journalisation permet l''analyse a posteriori.'),
  ('CTL-06', 'ISO_IEC_42001', 'A.6.2.4', 'Le test de biais fait partie de la validation avant service.'),
  ('CTL-06', 'ISO_IEC_42001', 'A.5.4',   'Il éclaire les impacts sur les personnes et les groupes.'),
  ('CTL-07', 'ISO_IEC_42001', 'A.4.6',   'La formation entretient les compétences requises.'),
  ('CTL-08', 'ISO_IEC_42001', 'A.2.4',   'La revue périodique des décisions nourrit le réexamen de la politique.')
) as m(control_code, fw_code, req_ref, note)
join public.control c on c.code = m.control_code and c.organization_id = 'cccccccc-0000-4000-8000-000000000001'
join public.framework f on f.code = m.fw_code
join public.requirement r on r.framework_id = f.id and r.requirement_reference = m.req_ref;

-- --- Preuves (5) --------------------------------------------------------------
insert into public.evidence (id, tenant_id, organization_id, title, evidence_type, source, external_url,
                             version, owner_user_id, collected_at, valid_until, validation_status, validated_by, validated_at)
values
  ('a4000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'Extraction du registre des cas d''usage IA', 'document', 'AIGMS', 'https://demo.local/evidence/registre.pdf',
   '2026-09', '11111111-1111-4111-8111-111111111111', now() - interval '10 days', current_date + interval '6 months',
   'validated', '11111111-1111-4111-8111-111111111111', now() - interval '9 days'),
  ('a4000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'Procédure d''interruption de l''assistant support', 'document', 'Intranet IzarLink',
   'https://demo.local/evidence/procedure-stop.pdf', '1.2', '22222222-2222-4222-8222-222222222222',
   now() - interval '1 month', current_date + interval '11 months', 'validated',
   '11111111-1111-4111-8111-111111111111', now() - interval '25 days'),
  ('a4000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'Bandeau d''information « réponse générée par IA »', 'screenshot', 'Recette applicative',
   'https://demo.local/evidence/bandeau.png', null, '22222222-2222-4222-8222-222222222222',
   now() - interval '3 months', current_date + interval '20 days', 'validated',
   '11111111-1111-4111-8111-111111111111', now() - interval '80 days'),
  ('a4000000-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'Rapport de revue sécurité Nordic LLM Cloud', 'document', 'RSSI IzarLink',
   'https://demo.local/evidence/revue-nordic.pdf', '2026', '33333333-3333-4333-8333-333333333333',
   now() - interval '2 months', current_date + interval '10 months', 'validated',
   '33333333-3333-4333-8333-333333333333', now() - interval '55 days'),
  ('a4000000-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'Attestation de formation littératie IA', 'attestation', 'Service formation',
   'https://demo.local/evidence/attestation-formation.pdf', '2026-S1', '22222222-2222-4222-8222-222222222222', now() - interval '8 months',
   current_date - interval '5 days', 'validated', '11111111-1111-4111-8111-111111111111', now() - interval '7 months');

insert into public.control_evidence (tenant_id, control_id, evidence_id, linked_by) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000003', 'a4000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000004', 'a4000000-0000-4000-8000-000000000004', '33333333-3333-4333-8333-333333333333'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000007', 'a4000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111');

commit;

-- =============================================================================
-- Cas d'usage 1 — Assistant support client : parcours complet jusqu'en production
-- =============================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

insert into public.ai_use_case (
  id, tenant_id, organization_id, business_unit_id, activity_id, name, purpose, business_process,
  expected_benefit, owner_user_id, accountable_user_id, users_description, affected_persons,
  data_description, involves_personal_data, autonomy_level, decision_impact, criticality,
  created_by, next_review_at)
values (
  'b1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
  'cccccccc-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000001',
  'Assistant support client',
  'Proposer aux conseillers une réponse rédigée à partir de l''historique des tickets, que le conseiller valide avant envoi.',
  'Traitement des demandes clients niveau 1',
  'Réduction du délai de première réponse et homogénéité des réponses.',
  '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222',
  'Conseillers du support client (12 personnes).',
  'Clients professionnels sollicitant le support.',
  'Tickets historiques anonymisés, aucune donnée personnelle de client final.',
  false, 'L1',
  'Aucune décision automatisée : le conseiller valide chaque réponse avant envoi.',
  'moderate', '11111111-1111-4111-8111-111111111111', current_date + interval '6 months');

insert into public.use_case_asset_link (tenant_id, use_case_id, asset_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000003'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002');

insert into public.use_case_vendor_link (tenant_id, use_case_id, vendor_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001');

-- DRAFT -> TRIAGE
select app.transition_use_case('b1000000-0000-4000-8000-000000000001', 'TRIAGE',
  'Fiche d''intake complète, criticité à qualifier.');

insert into public.assessment (id, tenant_id, organization_id, use_case_id, kind, status,
                               framework_code, framework_version, performed_by, completed_at)
values ('b2000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
        'cccccccc-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
        'triage', 'completed', 'ISO_IEC_42001', '2023', '11111111-1111-4111-8111-111111111111', now());

insert into public.assessment_answer (tenant_id, assessment_id, question_code, question_label, answer_value, justification, answered_by) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'TRI-01',
   'Le système prend-il une décision produisant des effets juridiques ou significatifs ?',
   '"non"'::jsonb, 'Le conseiller valide chaque réponse : aucune décision automatisée.', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'TRI-02',
   'Des données à caractère personnel sont-elles traitées ?',
   '"non"'::jsonb, 'Corpus de tickets anonymisé avant indexation.', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'TRI-03',
   'Quel est le niveau d''autonomie du système ?',
   '"L1"'::jsonb, 'Le système propose, l''humain dispose.', '11111111-1111-4111-8111-111111111111');

-- TRIAGE -> ASSESSMENT
select app.transition_use_case('b1000000-0000-4000-8000-000000000001', 'ASSESSMENT',
  'Triage réalisé : criticité modérée.');

insert into public.regulatory_classification (
  tenant_id, organization_id, use_case_id, assessment_id, framework_code, framework_version,
  organization_role, flags, rationale, legal_review_level, legal_review_completed,
  legal_reviewer_id, legal_review_at, classified_by, next_review_at)
values (
  'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001',
  'EU_AI_ACT', '2024/1689', 'deployer',
  array['transparency_obligations', 'gpai_dependency']::app.classification_flag[],
  'IzarLink déploie un système fondé sur un modèle généraliste tiers pour un usage interne d''assistance à la rédaction. Aucun usage relevant des pratiques interdites ni des cas listés comme à haut risque n''a été identifié. Les obligations de transparence vis-à-vis des personnes en interaction sont retenues.',
  'internal_review', true, '11111111-1111-4111-8111-111111111111', now(),
  '11111111-1111-4111-8111-111111111111', current_date + interval '12 months');

insert into public.risk (id, tenant_id, organization_id, use_case_id, title, scenario, category,
                         inherent_likelihood, inherent_impact, residual_likelihood, residual_impact,
                         owner_user_id, status, next_review_at, created_by)
values
  ('b3000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
   'Réponse erronée transmise au client',
   'Le modèle produit une réponse plausible mais fausse ; le conseiller la valide sans vérification et le client agit sur une information incorrecte.',
   'accuracy_robustness', 4, 4, 2, 3, '22222222-2222-4222-8222-222222222222',
   'mitigated', current_date + interval '6 months', '11111111-1111-4111-8111-111111111111'),
  ('b3000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
   'Fuite d''information interne vers le fournisseur de modèle',
   'Un conseiller colle un extrait de contrat confidentiel dans la sollicitation ; la donnée quitte le périmètre maîtrisé.',
   'security', 3, 4, 2, 3, '33333333-3333-4333-8333-333333333333',
   'mitigated', current_date + interval '4 months', '11111111-1111-4111-8111-111111111111'),
  ('b3000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
   'Dépendance au fournisseur de modèle',
   'Le fournisseur interrompt le service ou modifie unilatéralement ses conditions ; le support perd son outil sans solution de repli.',
   'third_party', 3, 3, 2, 3, '11111111-1111-4111-8111-111111111111',
   'analysed', current_date + interval '12 months', '11111111-1111-4111-8111-111111111111');

-- L'acceptation est un acte distinct, porté par le risk owner.


update public.risk
   set status = 'accepted',
       accepted_by = '33333333-3333-4333-8333-333333333333',
       accepted_at = now(),
       acceptance_rationale = 'Risque accepté pour douze mois : un mode dégradé manuel existe et la réversibilité contractuelle est documentée. Réexamen à la revue annuelle du fournisseur.',
       acceptance_review_at = current_date + interval '12 months'
 where id = 'b3000000-0000-4000-8000-000000000003';

insert into public.risk_treatment (tenant_id, risk_id, strategy, description, owner_user_id, due_date, status, effectiveness_note) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'reduce',
   'Validation obligatoire par le conseiller avant envoi, mention systématique des sources utilisées, campagne de sensibilisation aux limites du modèle.',
   '22222222-2222-4222-8222-222222222222', current_date - interval '1 month', 'verified',
   'Contrôle par sondage sur 50 réponses : aucun envoi non validé constaté.'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000002', 'reduce',
   'Filtrage des données sensibles en amont de l''envoi, clause contractuelle de non-réentraînement, journalisation des sollicitations.',
   '33333333-3333-4333-8333-333333333333', current_date - interval '2 months', 'verified',
   'Test de filtrage rejoué en recette : motifs sensibles bloqués.');

insert into public.impact_assessment (id, tenant_id, organization_id, use_case_id, scope_description,
                                      methodology, lifecycle_phase, status, dpia_required, conclusion,
                                      performed_by, approved_by, completed_at, next_review_at)
values ('b4000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
        'cccccccc-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
        'Effets de l''assistance à la rédaction sur les clients destinataires des réponses et sur les conseillers qui l''utilisent.',
        'ISO/IEC 42005', 'Avant mise en service', 'completed', false,
        'Les impacts identifiés sont limités et couverts par la validation humaine systématique et l''information des clients. Aucun impact grave sur les droits fondamentaux n''est retenu. Réexamen prévu à six mois ou à tout changement significatif.',
        '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111',
        now(), current_date + interval '6 months');

insert into public.impact_stakeholder (id, tenant_id, impact_assessment_id, label, is_vulnerable_group, estimated_population, consulted, consultation_method) values
  ('b5000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001',
   'Clients professionnels destinataires des réponses', false, 'Environ 1 800 comptes actifs', false, null),
  ('b5000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001',
   'Conseillers du support client', false, '12 personnes', true, 'Atelier de cadrage et test utilisateur sur deux semaines');

insert into public.impact_finding (tenant_id, impact_assessment_id, stakeholder_id, domain, description,
                                   is_adverse, severity, likelihood, mitigation, residual_severity, linked_risk_id, owner_user_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001',
   'consumer_protection', 'Un client pourrait recevoir une information erronée présentée avec assurance et prendre une décision commerciale sur cette base.',
   true, 'significant', 'possible',
   'Validation humaine obligatoire avant envoi, mention des sources, procédure de rectification sous 24 heures.',
   'limited', 'b3000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000002',
   'employment_working_conditions', 'Les conseillers pourraient accorder une confiance excessive aux propositions et perdre en vigilance.',
   true, 'limited', 'likely',
   'Formation aux limites du modèle, indicateur de taux de modification des propositions suivi mensuellement.',
   'negligible', null, '22222222-2222-4222-8222-222222222222'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000002',
   'employment_working_conditions', 'Réduction du temps passé sur les demandes répétitives, au profit des cas complexes.',
   false, 'limited', 'likely', null, null, null, '22222222-2222-4222-8222-222222222222');

insert into public.human_oversight_plan (id, tenant_id, organization_id, use_case_id, autonomy_level,
  accountable_user_id, required_competence, monitoring_cadence, intervention_triggers,
  override_procedure, stop_authority_user_id, stop_procedure, expected_evidence,
  status, approved_by, approved_at, next_review_at)
values ('b6000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
  'cccccccc-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'L1',
  '22222222-2222-4222-8222-222222222222',
  'Connaissance des offres IzarLink, formation aux limites des modèles de langage, habilitation support niveau 1.',
  'Revue hebdomadaire d''un échantillon de 20 réponses ; tableau de bord mensuel du taux de modification.',
  'Deux réclamations clients liées à une réponse générée sur un mois ; taux de modification inférieur à 10 % (signe de validation automatique) ; indisponibilité du fournisseur supérieure à 4 heures.',
  'Le conseiller modifie ou écarte librement la proposition ; aucune réponse n''est envoyée sans son action explicite.',
  '22222222-2222-4222-8222-222222222222',
  'Le responsable support désactive l''assistant depuis la console d''administration ; le support bascule en mode manuel documenté.',
  'Échantillons de revue hebdomadaire, journal des interventions, tableau de bord mensuel.',
  'approved', '11111111-1111-4111-8111-111111111111', now(), current_date + interval '6 months');

insert into public.control_applicability (tenant_id, control_id, use_case_id, status, justification, decided_by, decided_at)
select 'aaaaaaaa-0000-4000-8000-000000000001', c.id, 'b1000000-0000-4000-8000-000000000001',
       case when c.code = 'CTL-06' then 'not_applicable'::app.control_applicability_status
            else 'applicable'::app.control_applicability_status end,
       case when c.code = 'CTL-06' then 'Le système ne produit ni classement ni décision sur des personnes : le test de biais n''a pas d''objet ici.'
            else null end,
       '11111111-1111-4111-8111-111111111111', now()
from public.control c
where c.organization_id = 'cccccccc-0000-4000-8000-000000000001';

-- ASSESSMENT -> REVIEW
select app.transition_use_case('b1000000-0000-4000-8000-000000000001', 'REVIEW',
  'Classification, risques, AIIA et supervision instruits.');

-- Décision 1 : autorisation du cas d'usage
insert into public.governance_decision (id, tenant_id, organization_id, use_case_id, decision_type,
  subject, context, options_considered, decision_statement, rationale, status, submitted_by, submitted_at, effective_from)
values ('b7000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
  'cccccccc-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'use_case_authorization',
  'Autorisation de l''assistant support client',
  'Le support niveau 1 traite 400 demandes par semaine avec un délai de première réponse de 6 heures.',
  'Statu quo ; recrutement de deux conseillers ; assistance à la rédaction avec validation humaine.',
  'L''usage est autorisé en configuration L1, avec validation humaine systématique avant envoi.',
  'Les risques identifiés sont traités ou acceptés, l''évaluation d''impact ne retient aucun impact grave, et la supervision humaine est documentée et approuvée.',
  'draft', '11111111-1111-4111-8111-111111111111', now(), current_date);

update public.governance_decision
   set status = 'approved',
       approver_user_id = '33333333-3333-4333-8333-333333333333',
       approved_at = now(),
       review_due_at = current_date + interval '12 months'
 where id = 'b7000000-0000-4000-8000-000000000001';

-- REVIEW -> APPROVED
select app.transition_use_case('b1000000-0000-4000-8000-000000000001', 'APPROVED',
  'Décision d''autorisation approuvée.');

-- Décision 2 : GO production
insert into public.governance_decision (id, tenant_id, organization_id, use_case_id, decision_type,
  subject, context, options_considered, decision_statement, conditions, rationale,
  status, submitted_by, submitted_at, effective_from)
values ('b7000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
  'cccccccc-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'go_production',
  'Mise en production de l''assistant support client',
  'Pilote conduit sur six semaines auprès de quatre conseillers.',
  'Prolonger le pilote ; généraliser ; abandonner.',
  'La mise en production est autorisée pour l''ensemble de l''équipe support niveau 1.',
  'Maintien de la validation humaine ; revue hebdomadaire d''échantillon pendant trois mois ; réexamen à six mois.',
  'Le pilote montre un taux de modification des propositions de 34 %, aucune réclamation client liée à une réponse générée, et les contrôles obligatoires sont opérants.',
  'draft', '11111111-1111-4111-8111-111111111111', now(), current_date);

update public.governance_decision
   set status = 'approved_with_conditions',
       approver_user_id = '33333333-3333-4333-8333-333333333333',
       approved_at = now(),
       review_due_at = current_date + interval '6 months'
 where id = 'b7000000-0000-4000-8000-000000000002';

insert into public.decision_link (tenant_id, decision_id, target_type, target_id, note) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000002', 'risk', 'b3000000-0000-4000-8000-000000000001', 'Risque de réponse erronée : traitement vérifié.'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000002', 'impact_assessment', 'b4000000-0000-4000-8000-000000000001', 'AIIA terminée et approuvée.'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000002', 'evidence', 'a4000000-0000-4000-8000-000000000002', 'Procédure d''interruption.');

-- APPROVED -> PILOT -> PRODUCTION
insert into public.governance_decision (tenant_id, organization_id, use_case_id, decision_type,
  subject, decision_statement, rationale, status, submitted_by, submitted_at,
  approver_user_id, approved_at, effective_from, review_due_at)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001', 'pilot_approval',
  'Autorisation de pilote — assistant support client',
  'Un pilote de six semaines est autorisé auprès de quatre conseillers volontaires.',
  'Périmètre restreint, réversible, sans exposition directe au client sans validation humaine.',
  'approved', '11111111-1111-4111-8111-111111111111', now() - interval '2 months',
  '33333333-3333-4333-8333-333333333333', now() - interval '2 months',
  current_date - interval '2 months', current_date + interval '4 months');

select app.transition_use_case('b1000000-0000-4000-8000-000000000001', 'PILOT', 'Pilote autorisé.');
select app.transition_use_case('b1000000-0000-4000-8000-000000000001', 'PRODUCTION',
  'Gate production évalué : toutes les préconditions sont satisfaites.');

commit;

-- =============================================================================
-- Cas d'usage 2 — Scoring de candidatures : bloqué au gate production
-- =============================================================================
-- Sert de démonstration inverse : la revue fournisseur n'est pas close et une
-- action bloquante reste ouverte. Le gate refuse la mise en production et le
-- refus est journalisé.
-- =============================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

insert into public.ai_use_case (
  id, tenant_id, organization_id, business_unit_id, activity_id, name, purpose, business_process,
  expected_benefit, owner_user_id, accountable_user_id, users_description, affected_persons,
  data_description, involves_personal_data, involves_vulnerable_persons, autonomy_level,
  decision_impact, criticality, created_by, next_review_at)
values (
  'b1000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
  'cccccccc-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000002',
  'c2000000-0000-4000-8000-000000000003',
  'Scoring de candidatures',
  'Classer les candidatures reçues par adéquation au poste afin d''orienter la présélection des recruteurs.',
  'Recrutement — présélection',
  'Réduction du délai de présélection sur les postes à fort volume de candidatures.',
  '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222',
  'Équipe recrutement (4 personnes).',
  'Candidats à l''embauche, y compris candidats en situation de handicap ou en reconversion.',
  'CV, lettres de motivation, historique de candidatures. Données à caractère personnel.',
  true, true, 'L2',
  'Le score oriente la présélection : un candidat mal classé a une probabilité réduite d''être examiné.',
  'high', '11111111-1111-4111-8111-111111111111', current_date + interval '3 months');

insert into public.use_case_asset_link (tenant_id, use_case_id, asset_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000004');
insert into public.use_case_vendor_link (tenant_id, use_case_id, vendor_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002');

select app.transition_use_case('b1000000-0000-4000-8000-000000000002', 'TRIAGE', 'Intake complet.');
select app.transition_use_case('b1000000-0000-4000-8000-000000000002', 'ASSESSMENT', 'Criticité haute retenue.');

insert into public.regulatory_classification (
  tenant_id, organization_id, use_case_id, framework_code, framework_version,
  organization_role, flags, rationale, legal_review_level, legal_review_completed,
  legal_reviewer_id, legal_review_at, classified_by, next_review_at)
values (
  'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000002', 'EU_AI_ACT', '2024/1689', 'deployer',
  array['high_risk_potential', 'privacy_impact', 'transparency_obligations']::app.classification_flag[],
  'Système utilisé dans le contexte de l''emploi pour filtrer des candidatures : un examen approfondi de son rattachement aux cas listés comme à haut risque est requis, avec les obligations correspondantes pour le déployeur. Traitement de données à caractère personnel de candidats.',
  'external_counsel_required', true, '11111111-1111-4111-8111-111111111111', now(),
  '11111111-1111-4111-8111-111111111111', current_date + interval '6 months');

insert into public.risk (id, tenant_id, organization_id, use_case_id, title, scenario, category,
                         inherent_likelihood, inherent_impact, residual_likelihood, residual_impact,
                         owner_user_id, status, next_review_at, created_by)
values
  ('b3000000-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002',
   'Discrimination indirecte à l''embauche',
   'Le modèle, entraîné sur l''historique des recrutements, reproduit un biais défavorable aux candidats en reconversion ou aux parcours atypiques.',
   'bias_discrimination', 4, 5, 3, 5, '33333333-3333-4333-8333-333333333333',
   'treatment_in_progress', current_date + interval '2 months', '11111111-1111-4111-8111-111111111111'),
  ('b3000000-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002',
   'Transfert de données de candidats hors UE sans encadrement',
   'Les CV sont traités par un éditeur établi aux États-Unis sans DPA signé ni garanties de transfert documentées.',
   'privacy', 4, 4, 4, 4, '33333333-3333-4333-8333-333333333333',
   'identified', current_date + interval '1 month', '11111111-1111-4111-8111-111111111111');

insert into public.risk_treatment (tenant_id, risk_id, strategy, description, owner_user_id, due_date, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000004', 'reduce',
   'Test de biais par groupe avant mise en service, revue humaine systématique des candidatures écartées, suivi trimestriel des taux de sélection.',
   '33333333-3333-4333-8333-333333333333', current_date + interval '2 months', 'in_progress'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000005', 'reduce',
   'Signature du DPA, documentation des garanties de transfert, ou relocalisation du traitement en UE.',
   '33333333-3333-4333-8333-333333333333', current_date + interval '1 month', 'planned');

insert into public.impact_assessment (id, tenant_id, organization_id, use_case_id, scope_description,
  methodology, lifecycle_phase, status, dpia_required, dpia_reference, performed_by, next_review_at)
values ('b4000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
  'cccccccc-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002',
  'Effets du classement automatisé sur les candidats, en particulier sur les parcours atypiques et les personnes en situation de handicap.',
  'ISO/IEC 42005', 'Avant mise en service', 'in_progress', true, 'AIPD-RH-2026-03',
  '11111111-1111-4111-8111-111111111111', current_date + interval '3 months');

insert into public.impact_stakeholder (id, tenant_id, impact_assessment_id, label, is_vulnerable_group, estimated_population, consulted) values
  ('b5000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000002',
   'Candidats à l''embauche', false, 'Environ 2 400 candidatures par an', false),
  ('b5000000-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000002',
   'Candidats en situation de handicap ou en reconversion', true, 'Non quantifié', false);

insert into public.impact_finding (tenant_id, impact_assessment_id, stakeholder_id, domain, description,
  is_adverse, severity, likelihood, mitigation, linked_risk_id, owner_user_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000002', 'b5000000-0000-4000-8000-000000000004',
   'equality_non_discrimination', 'Un candidat au parcours atypique peut être systématiquement mal classé et ne jamais être examiné par un recruteur.',
   true, 'severe', 'possible',
   'Revue humaine obligatoire d''un échantillon de candidatures écartées, test de biais par groupe avant mise en service, voie de recours documentée pour le candidat.',
   'b3000000-0000-4000-8000-000000000004', '33333333-3333-4333-8333-333333333333');

insert into public.human_oversight_plan (tenant_id, organization_id, use_case_id, autonomy_level,
  accountable_user_id, required_competence, monitoring_cadence, intervention_triggers,
  override_procedure, stop_authority_user_id, stop_procedure, expected_evidence, status)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000002', 'L2', '22222222-2222-4222-8222-222222222222',
  'Formation à la non-discrimination à l''embauche et aux limites du scoring automatisé.',
  'Revue mensuelle des taux de sélection par groupe.',
  'Écart de taux de sélection supérieur à 10 points entre groupes ; réclamation d''un candidat ; dérive du score moyen.',
  'Le recruteur peut réexaminer toute candidature écartée et écarter le score.',
  '22222222-2222-4222-8222-222222222222',
  'La direction des ressources humaines suspend l''usage du score et bascule en présélection manuelle.',
  'Rapports mensuels de taux de sélection, journal des réexamens, résultats des tests de biais.',
  'submitted');

insert into public.control_applicability (tenant_id, control_id, use_case_id, status, decided_by, decided_at)
select 'aaaaaaaa-0000-4000-8000-000000000001', c.id, 'b1000000-0000-4000-8000-000000000002',
       'applicable', '11111111-1111-4111-8111-111111111111', now()
from public.control c
where c.organization_id = 'cccccccc-0000-4000-8000-000000000001' and c.is_mandatory;

select app.transition_use_case('b1000000-0000-4000-8000-000000000002', 'REVIEW',
  'Classification haut risque, risques et AIIA en cours.');

insert into public.governance_decision (id, tenant_id, organization_id, use_case_id, decision_type,
  subject, context, options_considered, decision_statement, conditions, rationale,
  status, submitted_by, submitted_at, approver_user_id, approved_at, effective_from, review_due_at)
values ('b7000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
  'cccccccc-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'use_case_authorization',
  'Autorisation encadrée du scoring de candidatures',
  'Le volume de candidatures sur les postes logistiques dépasse la capacité de présélection de l''équipe.',
  'Refus ; pilote encadré avec double lecture humaine ; déploiement direct.',
  'Un pilote est autorisé sur un poste unique, avec lecture humaine de la totalité des candidatures, score affiché à titre indicatif.',
  'Aucune candidature ne peut être écartée sur le seul score ; test de biais livré avant la fin du pilote ; DPA fournisseur signé avant toute extension.',
  'Le cas d''usage relève potentiellement du haut risque et le fournisseur n''est pas encore revu : seul un pilote strictement encadré et réversible est acceptable à ce stade.',
  'approved_with_conditions', '11111111-1111-4111-8111-111111111111', now(),
  '33333333-3333-4333-8333-333333333333', now(), current_date, current_date + interval '3 months');

select app.transition_use_case('b1000000-0000-4000-8000-000000000002', 'CONDITIONAL_APPROVAL',
  'Approbation sous conditions : pilote encadré uniquement.');

insert into public.governance_decision (tenant_id, organization_id, use_case_id, decision_type,
  subject, decision_statement, conditions, rationale, status, submitted_by, submitted_at,
  approver_user_id, approved_at, effective_from, review_due_at)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000002', 'pilot_approval',
  'Ouverture du pilote — scoring de candidatures',
  'Le pilote est ouvert sur un poste unique pour une durée de trois mois.',
  'Lecture humaine de la totalité des candidatures ; aucune candidature écartée sur le seul score ; arrêt immédiat en cas d''écart de sélection supérieur à 10 points entre groupes.',
  'Périmètre restreint et réversible, sous double lecture humaine.',
  'approved_with_conditions', '11111111-1111-4111-8111-111111111111', now(),
  '33333333-3333-4333-8333-333333333333', now(), current_date, current_date + interval '3 months');

select app.transition_use_case('b1000000-0000-4000-8000-000000000002', 'PILOT', 'Pilote encadré ouvert.');

-- Démonstration du refus : le gate production rejette la demande et journalise
-- le motif. La revue fournisseur est ouverte et deux actions bloquantes courent.
select app.transition_use_case('b1000000-0000-4000-8000-000000000002', 'PRODUCTION',
  'Demande de généralisation soumise par l''exploitation.');

commit;

-- =============================================================================
-- Cas d'usage 3 — Agent de planification des tournées : au stade du triage
-- =============================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

insert into public.ai_use_case (
  id, tenant_id, organization_id, business_unit_id, activity_id, name, purpose, business_process,
  expected_benefit, owner_user_id, accountable_user_id, users_description, affected_persons,
  data_description, involves_personal_data, autonomy_level, decision_impact, criticality, created_by)
values (
  'b1000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
  'cccccccc-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000005',
  'Agent de planification des tournées',
  'Proposer un ordonnancement des tournées de livraison tenant compte des créneaux clients et des contraintes de conduite.',
  'Planification logistique quotidienne',
  'Réduction des kilomètres parcourus et meilleure tenue des créneaux annoncés.',
  '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222',
  'Exploitants de la planification (3 personnes).',
  'Chauffeurs livreurs et clients destinataires.',
  'Adresses de livraison, créneaux, temps de conduite. Données de localisation de chauffeurs.',
  true, 'L2',
  'L''ordonnancement proposé structure la journée de travail des chauffeurs.',
  'moderate', '11111111-1111-4111-8111-111111111111');

insert into public.use_case_asset_link (tenant_id, use_case_id, asset_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000005');

select app.transition_use_case('b1000000-0000-4000-8000-000000000003', 'TRIAGE',
  'Déclaré par l''exploitation, qualification à conduire.');

commit;

-- =============================================================================
-- Changement significatif sur le cas d'usage en production
-- =============================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

insert into public.change_request (
  id, tenant_id, organization_id, use_case_id, title, description, change_types,
  increases_autonomy, new_autonomy_level, changes_purpose, changes_model, security_relevant,
  status, requested_by, planned_at)
values (
  'b8000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
  'cccccccc-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
  'Envoi automatique des réponses simples et montée de version du modèle',
  'L''exploitation demande que les réponses classées « simples » par le système soient envoyées sans validation du conseiller, et que le modèle passe en version 4.0. Le périmètre fonctionnel reste le support niveau 1.',
  array['AUTONOMY', 'MODEL']::app.change_type[],
  true, 'L3', false, true, false,
  'DRAFT', '22222222-2222-4222-8222-222222222222', current_date + interval '1 month');

select app.screen_change_request('b8000000-0000-4000-8000-000000000001');

-- Le responsable confirme le verdict du moteur : la recommandation ne vaut pas décision.
update public.reassessment
   set final_verdict = engine_verdict,
       status = 'confirmed',
       reviewed_by = '11111111-1111-4111-8111-111111111111',
       reviewed_at = now()
 where change_request_id = 'b8000000-0000-4000-8000-000000000001';

insert into public.governance_decision (tenant_id, organization_id, use_case_id, decision_type,
  subject, context, options_considered, decision_statement, conditions, rationale,
  status, submitted_by, submitted_at, approver_user_id, approved_at, effective_from, review_due_at)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001', 'significant_change',
  'Suite donnée au changement d''autonomie de l''assistant support',
  'Le passage en L3 supprime la validation humaine avant envoi, qui constituait la mesure de réduction principale du risque de réponse erronée.',
  'Refus ; acceptation en l''état ; réévaluation complète préalable.',
  'Le changement n''est pas autorisé en l''état. Une réévaluation complète est engagée : classification, risques, évaluation d''impact et plan de supervision sont rouverts.',
  'La montée de version du modèle peut être conduite séparément, à autonomie inchangée. Le retour en L1 reste la configuration en vigueur jusqu''à décision.',
  'La mesure de réduction du risque le plus significatif reposait sur la validation humaine systématique. La supprimer invalide l''évaluation d''impact approuvée.',
  'approved', '11111111-1111-4111-8111-111111111111', now(),
  '33333333-3333-4333-8333-333333333333', now(), current_date, current_date + interval '2 months');

update public.change_request set status = 'REVIEW' where id = 'b8000000-0000-4000-8000-000000000001';

commit;

-- =============================================================================
-- Incident, CAPA et actions
-- =============================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

insert into public.incident (id, tenant_id, organization_id, use_case_id, title, description,
  kind, severity, status, detected_at, reported_by, owner_user_id,
  containment_action, contained_at, root_cause)
values ('b9000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
  'cccccccc-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
  'Réponse contenant un tarif obsolète envoyée à trois clients',
  'L''assistant a produit une réponse citant une grille tarifaire retirée depuis six mois. Trois conseillers ont validé et envoyé la réponse sans vérifier le tarif.',
  'incident', 'S2', 'EFFECTIVENESS_REVIEW', now() - interval '20 days',
  '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222',
  'Retrait immédiat de la grille obsolète du corpus indexé et information des trois clients concernés dans la journée.',
  now() - interval '20 days',
  'Le corpus documentaire n''était pas purgé lors du retrait d''une grille tarifaire : aucune procédure ne rattachait la fin de validité d''un document à sa désindexation.');

insert into public.capa (tenant_id, incident_id, correction, cause_analysis, corrective_action,
  preventive_action, owner_user_id, due_date, status, effectiveness_test)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'b9000000-0000-4000-8000-000000000001',
  'Grille tarifaire obsolète retirée du corpus ; réponses rectifiées auprès des trois clients.',
  'Absence de procédure liant la fin de validité d''un document à sa désindexation du corpus. La revue de contenu était annuelle alors que les tarifs évoluent au semestre.',
  'Mise en place d''une revue trimestrielle du corpus avec date de validité obligatoire par document, et purge automatique à échéance.',
  'Extension de la date de validité obligatoire à l''ensemble des sources documentaires indexées, quel que soit le cas d''usage.',
  '22222222-2222-4222-8222-222222222222', current_date + interval '1 month', 'implemented',
  'Contrôle sur 30 réponses générées après purge : aucune référence à un document échu.');

insert into public.action (tenant_id, organization_id, use_case_id, title, description, source, source_id,
  owner_user_id, due_date, status, is_blocking) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000002',
   'Signer le DPA avec TalentScreen Analytics',
   'Sans DPA signé ni garanties de transfert documentées, l''extension du scoring de candidatures ne peut être envisagée.',
   'risk', 'b3000000-0000-4000-8000-000000000005', '33333333-3333-4333-8333-333333333333',
   current_date + interval '1 month', 'in_progress', true),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000002',
   'Livrer le test de biais par groupe',
   'Mesurer les écarts de taux de sélection entre groupes avant toute extension du pilote.',
   'impact_finding', null, '33333333-3333-4333-8333-333333333333',
   current_date + interval '2 months', 'open', true),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000001',
   'Renouveler l''attestation de formation littératie IA',
   'La preuve associée au contrôle CTL-07 est arrivée à échéance.',
   'control', 'a3000000-0000-4000-8000-000000000007', '22222222-2222-4222-8222-222222222222',
   current_date - interval '5 days', 'open', false);

commit;

-- =============================================================================
-- Contrôle de cohérence du jeu de démonstration
-- =============================================================================
-- Le seed rejoue le parcours réel : si un gate régresse, une transition attendue
-- n'aboutit pas et ce bloc fait échouer le seed plutôt que de laisser passer un
-- jeu de données silencieusement faux.
-- =============================================================================
do $$
declare
  v_status  app.use_case_status;
  v_count   integer;
  v_verdict app.reassessment_verdict;
begin
  select status into v_status from public.ai_use_case where business_ref = 'UC-2026-0001';
  if v_status <> 'PRODUCTION' then
    raise exception 'Seed : UC-2026-0001 devrait être en PRODUCTION, statut constaté %', v_status;
  end if;

  select status into v_status from public.ai_use_case where business_ref = 'UC-2026-0002';
  if v_status <> 'PILOT' then
    raise exception 'Seed : UC-2026-0002 devrait rester en PILOT (gate production refusé), statut constaté %', v_status;
  end if;

  select status into v_status from public.ai_use_case where business_ref = 'UC-2026-0003';
  if v_status <> 'TRIAGE' then
    raise exception 'Seed : UC-2026-0003 devrait être en TRIAGE, statut constaté %', v_status;
  end if;

  select count(*) into v_count from public.audit_log where action = 'gate_blocked';
  if v_count < 1 then
    raise exception 'Seed : le refus du gate production de UC-2026-0002 devrait être journalisé.';
  end if;

  select engine_verdict into v_verdict
  from public.reassessment r
  join public.change_request c on c.id = r.change_request_id
  where c.business_ref = 'CHG-2026-0001';

  if v_verdict <> 'FULL_REASSESSMENT' then
    raise exception 'Seed : la montée d''autonomie devrait déclencher FULL_REASSESSMENT, verdict constaté %', v_verdict;
  end if;

  select count(*) into v_count
  from public.impact_assessment
  where use_case_id = (select id from public.ai_use_case where business_ref = 'UC-2026-0001')
    and status = 'reopened';
  if v_count <> 1 then
    raise exception 'Seed : l''AIIA de UC-2026-0001 devrait être rouverte par la réévaluation complète.';
  end if;

  select count(*) into v_count
  from public.membership m
  where m.tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'
    and m.role = 'platform_admin';
  if v_count <> 1 then
    raise exception 'Seed : le tenant RL Conseil doit porter exactement un compte d''administration, % trouvé(s)', v_count;
  end if;

  select count(*) into v_count
  from public.role_assignment r
  where r.organization_id = 'cccccccc-0000-4000-8000-000000000001';
  if v_count < 5 then
    raise exception 'Seed : IzarLink devrait porter au moins cinq affectations de rôle, % trouvée(s)', v_count;
  end if;

  raise notice 'Seed AIGMS : parcours de gouvernance et répartition des rôles vérifiés.';
end;
$$;

-- =============================================================================
-- Demandes de contact déposées depuis la page publique
-- =============================================================================
insert into public.contact_request (full_name, email, organization, phone, profile, message, status, created_at, created_on) values
  ('Hélène Vasseur', 'h.vasseur@groupe-tramontane.example', 'Groupe Tramontane', '+33 5 59 00 00 12',
   'dsi_rssi_dpo',
   'Nous déployons un assistant de rédaction sur 300 postes et notre comité d''audit demande qui a autorisé quoi. Nous n''avons aucune trace formalisée.',
   'new', now() - interval '2 days', (now() - interval '2 days')::date),
  ('Marc Etcheverry', 'm.etcheverry@sud-ouest-hebergement.example', 'Sud-Ouest Hébergement', null,
   'conseil_msp_integrateur',
   'Hébergeur régional, une trentaine de clients PME. Nous cherchons un socle pour lancer une offre de gouvernance IA managée.',
   'contacted', now() - interval '9 days', (now() - interval '9 days')::date),
  ('Fatou Ndiaye', 'f.ndiaye@atelier-berthelot.example', 'Ateliers Berthelot', '+33 5 61 00 00 45',
   'direction',
   'Scoring de candidatures en test au service RH. Nous voulons savoir si nous sommes concernés par les obligations « haut risque » avant d''aller plus loin.',
   'qualified', now() - interval '21 days', (now() - interval '21 days')::date)
on conflict do nothing;
