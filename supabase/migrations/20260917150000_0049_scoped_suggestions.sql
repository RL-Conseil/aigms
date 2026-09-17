-- =============================================================================
-- AIGMS — 0049 — Portée des contrôles-types et propositions par cas d'usage
-- =============================================================================
-- Deux défauts de la migration 0048, constatés à l'usage : la même liste
-- revenait pour tout cas d'usage.
--
-- 1. « Politique de gouvernance », « Audit interne » ne sont pas des contrôles
--    d'un cas d'usage : ils relèvent du système de management, une fois par
--    organisation. Un contrôle-type porte désormais une PORTÉE — organisation
--    ou cas d'usage — et le panneau d'un cas d'usage ne propose que la seconde.
--
-- 2. 104 contrôles sur 120 étaient « obligatoires par défaut » ; un obligatoire
--    se propose toujours. Dans la portée cas d'usage, 24 le restent — le noyau
--    que tout usage porte — et 45 deviennent conditionnels, déclenchés par des
--    FAITS plus riches : classification réglementaire, nature des actifs
--    (agent, modèle propre, jeu de données), statut, en plus des faits déjà lus.
-- =============================================================================

create type app.control_scope as enum ('organization', 'use_case');

alter table public.catalog_control
  add column scope app.control_scope not null default 'use_case';

comment on column public.catalog_control.scope is
  'organization : se tient une fois pour toute l''organisation, jamais affecté à un cas d''usage. use_case : s''affecte à un cas d''usage.';

-- Le contenu d'une version publiée est gelé ; la portée et l'applicabilité par
-- défaut sont des métadonnées de proposition, on lève la garde pour les poser.
alter table public.catalog_control disable trigger catalog_control_guard_published;

update public.catalog_control cc set scope = 'organization'
from public.catalog_version v join public.catalog_framework f on f.id = v.framework_id
where cc.version_id = v.id and f.tenant_id is null and f.code = 'AIGMS-CF'
  and cc.control_code in (
    'AIGMS-GOV-001','AIGMS-GOV-002','AIGMS-GOV-003','AIGMS-GOV-004','AIGMS-GOV-006','AIGMS-GOV-007',
    'AIGMS-GOV-008','AIGMS-GOV-009','AIGMS-GOV-010','AIGMS-GOV-011','AIGMS-GOV-012',
    'AIGMS-INV-001','AIGMS-INV-008',
    'AIGMS-RSK-001','AIGMS-RSK-006','AIGMS-RSK-010','AIGMS-RSK-011',
    'AIGMS-DAT-002','AIGMS-DAT-003','AIGMS-DAT-010','AIGMS-DAT-011',
    'AIGMS-SEC-001','AIGMS-SEC-002','AIGMS-SEC-004','AIGMS-SEC-005',
    'AIGMS-SUP-001','AIGMS-SUP-004','AIGMS-SUP-007','AIGMS-SUP-008',
    'AIGMS-HUM-007','AIGMS-HUM-008',
    'AIGMS-OPS-001','AIGMS-OPS-002','AIGMS-OPS-006','AIGMS-OPS-008','AIGMS-OPS-011','AIGMS-OPS-012',
    'AIGMS-MON-001',
    'AIGMS-INC-001','AIGMS-INC-002','AIGMS-INC-003','AIGMS-INC-004','AIGMS-INC-007',
    'AIGMS-CMP-001','AIGMS-CMP-002','AIGMS-CMP-003','AIGMS-CMP-004','AIGMS-CMP-005','AIGMS-CMP-006','AIGMS-CMP-007','AIGMS-CMP-008'
  );

-- Dans la portée cas d'usage, seul le noyau reste obligatoire.
update public.catalog_control cc
   set applicability = jsonb_set(coalesce(applicability, '{}'::jsonb), '{default}', to_jsonb(
     case when cc.control_code in (
       'AIGMS-GOV-005','AIGMS-INV-002','AIGMS-INV-003','AIGMS-INV-004','AIGMS-INV-005','AIGMS-INV-006',
       'AIGMS-USE-001','AIGMS-USE-002','AIGMS-USE-006','AIGMS-USE-007','AIGMS-USE-008','AIGMS-USE-009','AIGMS-USE-010',
       'AIGMS-RSK-002','AIGMS-RSK-005','AIGMS-RSK-007','AIGMS-RSK-009',
       'AIGMS-DAT-001','AIGMS-HUM-001','AIGMS-HUM-006','AIGMS-SEC-006','AIGMS-MON-008','AIGMS-INC-005','AIGMS-INC-006'
     ) then 'mandatory' else 'conditional' end))
from public.catalog_version v join public.catalog_framework f on f.id = v.framework_id
where cc.version_id = v.id and f.tenant_id is null and f.code = 'AIGMS-CF' and cc.scope = 'use_case';

alter table public.catalog_control enable trigger catalog_control_guard_published;

-- -----------------------------------------------------------------------------
-- Des faits plus riches
-- -----------------------------------------------------------------------------
alter type app.suggestion_condition add value if not exists 'high_risk_potential';
alter type app.suggestion_condition add value if not exists 'privacy_impact';
alter type app.suggestion_condition add value if not exists 'security_impact';
alter type app.suggestion_condition add value if not exists 'gpai_dependency';
alter type app.suggestion_condition add value if not exists 'transparency_obligations';
alter type app.suggestion_condition add value if not exists 'asset_agent';
alter type app.suggestion_condition add value if not exists 'asset_own_model';
alter type app.suggestion_condition add value if not exists 'asset_dataset';
alter type app.suggestion_condition add value if not exists 'in_service';
alter type app.suggestion_condition add value if not exists 'external_persons';
