# AIGMS — Modèle de tenancy et de RLS

Version 1.0 — 7 septembre 2026

## 1. Frontière d'isolation

`tenant` est la frontière. Un tenant est un cabinet, un MSP ou une DSI
externalisée qui pilote un portefeuille de clients. Chaque client est une
`organization`, découpée en `business_unit`.

```
tenant ──┬── membership ──── user_profile
         └── organization ──┬── business_unit
                            ├── role_assignment
                            └── objets de gouvernance (use case, risk, …)
```

**Toute table métier porte `tenant_id`.** Ce n'est pas redondant avec la chaîne
de clés étrangères : cela permet à chaque politique de tester une seule colonne,
ce qui rend les 70 politiques lisibles et vérifiables une à une. Le trigger
`app.assert_tenant_consistency` garantit qu'une ligne ne peut pas porter un
`tenant_id` différent de celui de son organisation.

## 2. Rôles

| Rôle | Dénomination | Portée | Écrit |
|---|---|---|---|
| `platform_admin` | Administration de la plateforme | plateforme | organisations, comptes, attributions de rôle, référentiels. **Aucun objet de gouvernance** — voir [ADR-0008](../adr/ADR-0008-account-provisioning.md) |
| `governance_officer` | AI Governance Officer | tenant | objets de gouvernance |
| `client_admin` | Administrateur client | tenant | objets de gouvernance |
| `system_owner` | Porteur de l'IA | organisation | cas d'usage, évaluations, preuves (dépôt, pas validation — 0055), actions |
| `risk_owner` | Comité des risques | organisation | risques et traitements ; validation des preuves (0055) |
| `reviewer` | Expert métier (DPO / RSSI) | organisation | décisions ; validation des preuves (0055) |
| `auditor` | Auditeur | organisation | rien — lecture seule, journal d'audit inclus |
| `executive_viewer` | Comité de direction | organisation | se prononce sur une décision soumise ; seul à approuver une mise en production critique ou une exception (0055). Rien d'autre |

Les dénominations sont fixées le 18 septembre 2026 (migration 0054) ; elles
s'appliquent aux comptes déjà attribués comme aux futurs. Le RACI de ces six
rôles est décrit dans [ROLES_ET_RACI.md](../admin/ROLES_ET_RACI.md).

L'administration de la plateforme **ouvre les accès ; elle ne gouverne pas**.
`has_tenant_role` et `has_organization_role` ne court-circuitent pas sur ce
privilège : un administrateur n'obtient un rôle de gouvernance que si quelqu'un
le lui attribue explicitement. Le seul privilège transverse conservé est la
lecture, par `has_tenant_access` — un exploitant doit pouvoir constater l'état
d'un portefeuille pour l'administrer.

`app.assignable_roles()` borne ce qu'un administrateur peut attribuer : ni
`platform_admin`, ni `client_admin`. Un trigger le vérifie, quel que soit le
chemin d'accès.

`membership.role` porte le rôle par défaut sur le tenant ; `role_assignment` le
raffine par organisation, avec `valid_until` pour la délégation temporaire.

## 2 bis. La seule exception : `contact_request`

`anon` ne dispose d'aucun droit — sauf l'insertion dans `contact_request`, la
table alimentée par le formulaire de la page publique. L'exception est bornée à
l'insertion d'une ligne neuve, sans lecture ni modification possible, sur une
table qui ne porte aucune donnée de gouvernance. Voir
[ADR-0007](../adr/ADR-0007-public-surface.md) et les neuf tests de
`tests/rls/contact-request.test.ts`.

## 3. Contrat de politique

Chaque table métier reçoit deux politiques, générées par une boucle déclarative
dans la migration `0014` — une boucle plutôt que 52 politiques recopiées, pour
qu'aucune table ne puisse être oubliée ni dériver :

```sql
-- Lecture : appartenance active au tenant.
using (app.has_tenant_access(tenant_id))

-- Écriture : rôle habilité, verifie en USING et en WITH CHECK.
using      (app.has_tenant_role(tenant_id, app.<ensemble_de_roles>()))
with check (app.has_tenant_role(tenant_id, app.<ensemble_de_roles>()))
```

`WITH CHECK` n'est pas décoratif : sans lui, un `UPDATE` pourrait déplacer une
ligne vers un autre tenant. Le test
« une ligne ne peut pas être déplacée vers un autre tenant » couvre ce cas.

## 4. Fonctions d'habilitation

Toutes en `SECURITY DEFINER`, dans `app` :

| Fonction | Rôle |
|---|---|
| `current_user_id()` | claim `sub` du JWT, `NULL` si anonyme |
| `is_platform_admin()` | privilège plateforme |
| `has_tenant_access(tenant)` | appartenance active — prédicat central |
| `tenant_role(tenant)` | rôle par défaut sur le tenant |
| `has_tenant_role(tenant, roles)` | l'un des rôles attendus |
| `organization_roles(org)` | rôles effectifs sur une organisation |
| `has_organization_role(org, roles)` | l'un des rôles attendus sur l'organisation |

Le `SECURITY DEFINER` est indispensable : une politique sur `membership` qui
lirait `membership` provoquerait une récursion infinie. Il impose en contrepartie
que **chaque fonction métier revérifie l'habilitation** — ce que font
`transition_use_case`, `screen_change_request`, `log_audit` et `emit_event`.

## 5. Cas particuliers

| Table | Règle |
|---|---|
| `tenant` | création réservée au `platform_admin` ; pas de `DELETE`, archivage seul |
| `user_profile` | visible aux membres partageant un tenant ; `is_platform_admin` protégé par trigger contre l'auto-promotion |
| `audit_log` | lecture réservée à `platform_admin`, `governance_officer`, `client_admin`, `auditor` ; **aucune** politique d'écriture |
| `governance_event` | lecture tenant ; écriture uniquement via `app.emit_event` |
| `framework`, `requirement` | catalogue plateforme, lecture ouverte aux authentifiés, écriture `platform_admin` |
| `app.business_ref_counter` | RLS activée sans aucune politique : inaccessible hors fonction |
| `contact_request` | insertion anonyme d'une ligne neuve ; lecture et suivi réservés à `app.is_platform_admin()` |

## 6. Couverture de test

`tests/rls/` — 58 assertions, exécutées en série sur la base de démonstration,
chaque test dans une transaction annulée :

- **Isolation** : lecture, écriture, ciblage par identifiant, déplacement de
  ligne, accès anonyme, cohérence de tenant.
- **RBAC** : l'auditeur lit tout et n'écrit rien ; le porteur de système dépose
  une preuve mais ne crée pas de contrôle ; nul ne s'octroie le privilège
  plateforme.
- **Workflow** : statut non modifiable par `UPDATE`, transitions interdites,
  habilitation revérifiée dans une fonction `SECURITY DEFINER`, y compris pour
  un utilisateur d'un autre tenant.
- **Journal** : immuable en modification comme en suppression, écriture directe
  refusée, écriture hors périmètre tenant refusée.
- **Surface publique** : `anon` insère une demande de contact et rien d'autre —
  ni lecture, ni modification, ni accès à une autre table, ni dépôt d'une
  demande déjà marquée traitée.
- **Périmètre de l'administration** : ce qu'elle peut (organisations, comptes,
  rôles, lecture du portefeuille), ce qu'elle ne peut pas (cas d'usage, risque,
  décision, contrôle, transition, attribution de `platform_admin` ou de
  `client_admin`), et ce que les rôles de gouvernance ont perdu au passage.

## 7. Vérification manuelle

```sql
-- Aucune table de public ne doit apparaitre sans RLS forcee ni sans politique.
select c.relname, c.relrowsecurity, c.relforcerowsecurity,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, policies, c.relname;
```


## Le journal couvre toutes les tables métier

Version 1.1 — 14 septembre 2026

Sept tables étaient journalisées : preuves, décisions de Déclaration,
connecteurs, et les actes d'administration. Tout le reste ne l'était pas — un
contrôle créé, un risque modifié, un traitement **supprimé** ne laissaient
aucune trace.

La suppression était le cas le plus grave. Les politiques d'écriture couvrent
`for all`, DELETE compris : un objet de gouvernance pouvait disparaître sans
qu'on sache qui l'avait retiré, ni ce qu'il contenait — précisément ce qu'un
dossier d'audit doit pouvoir reconstituer.

`app.audit_business()` journalise création, modification et suppression, avec
l'état **complet avant et après**. Le déclencheur est posé par une boucle
déclarative sur 29 tables, comme les politiques RLS de la migration 0014 : même
contrat pour toutes, et une table oubliée se voit en lisant la liste.

Deux garde-fous complètent le dispositif :

- **`app.audit_coverage_gaps()`** nomme les tables portant un `tenant_id` et
  dépourvues de déclencheur. Un test exige que la liste reste vide : la
  prochaine table ajoutée sans journal fera échouer la suite.
- **L'immuabilité tient sans la RLS.** Sous un rôle d'utilisateur, la RLS suffit
  — aucune ligne n'est visible en écriture. Le test porte donc sur une connexion
  privilégiée, où seul le déclencheur `audit_log_immutable` protège.

Trois exclusions, assumées : `audit_log` et `governance_event` sont les journaux
eux-mêmes ; `connector_sync_run` est la sortie machine d'une synchronisation —
la journaliser reviendrait à journaliser un journal.

## Journal d'audit — couverture et lecture (v1.2, 16 septembre 2026)

**Ce qui est journalisé.** Un déclencheur générique (`app.audit_business`,
migration 0033) écrit une ligne *avant/après* sur chaque insertion, modification
et suppression de toute table portant un `tenant_id`. Trois tables sans
`tenant_id` ont leur propre déclencheur (migration 0041) : `tenant` (marque
blanche), `user_profile` (par l'appartenance active), `catalog_version` (par le
travail d'import). `app.audit_coverage_gaps()` doit rester vide — un test
l'exige — et connaît ces trois tables.

**Ce que cela signifie.** Aucune action serveur n'écrit dans le journal
elle-même ; il n'existe donc aucun chemin applicatif qui l'évite, y compris une
écriture directe par l'API ou par une clé de service.

**Lecture.** RLS : `platform_admin`, `governance_officer`, `client_admin`,
`auditor`, dans leur tenant. L'écran `/admin/journal` (administration) filtre,
pagine (`public.audit_log_page`), montre les champs modifiés et exporte en JSON
(5 000 lignes au plus). L'export est lui-même journalisé (`export`, avec les
filtres et le nombre de lignes) par `public.log_audit_export`, réservée à
l'administration.

**Ce que le journal ne fait pas.** Il ne se modifie ni ne se purge depuis
l'application. Une politique de rétention — durée, archivage hors base — reste
à décider ; elle relève de l'hébergement, pas du produit.
