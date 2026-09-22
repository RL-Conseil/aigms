# Importer les cas d'usage, les actifs d'IA et les fournisseurs (CSV, connecteurs)

*20 septembre 2026 — migrations 0061 et 0062. Cas d'usage : 29 septembre
2026 — migration 0092.*

Un inventaire d'actifs existe presque toujours ailleurs — CMDB de l'ITSM
(ServiceNow, GLPI, iTop, EasyVista), registre des traitements, tableur — et
un registre des fournisseurs aussi. Les ressaisir un à un est ce qui fait
qu'un registre reste vide. AIGMS les **importe** : par CSV aujourd'hui, par
connecteur ensuite (même fonction en base).

## Où

- **Administration de l'organisation, compte administrateur seulement** :
  deux cartes « Importer les actifs d'IA » et « Importer les fournisseurs ».
  L'import est une *reprise de données*, comme l'import d'un référentiel ; les
  rôles de gouvernance déclarent un à un ce dont ils répondent, ils
  n'importent pas (migration 0062).
- **Administration › Actifs et fournisseurs** (`/admin/actifs-fournisseurs`,
  22 septembre 2026) : l'endroit central. Toutes les organisations, filtre par
  organisation, nature et texte ; la fiche d'un actif ou d'un fournisseur se
  corrige d'un crayon avec le même formulaire que sur le registre ; l'ajout et
  l'import se font dans l'organisation choisie dans le filtre.

L'organisation doit être opérationnelle (six rôles tenus, migration 0056) :
l'import écrit des objets de gouvernance, la règle s'applique.

## Le format

CSV, UTF-8 (avec ou sans BOM), séparateur `;` (Excel français) ou `,`. La
première ligne nomme les colonnes ; l'ordre est libre ; une colonne inconnue
est ignorée et signalée. Modèles : [`/modeles/actifs-ia.csv`](../../public/modeles/actifs-ia.csv),
[`/modeles/fournisseurs.csv`](../../public/modeles/fournisseurs.csv).

### Actifs d'IA

| Colonne | Obligatoire | Valeurs | Synonymes reconnus |
|---|---|---|---|
| `name` | oui | nom de l'actif — clé de rapprochement | nom, libellé, asset, CI name |
| `kind` | non (système par défaut) | `système` / `modèle` / `agent` / `jeu de données` (ou `ai_system`, `ai_model`, `ai_agent`, `dataset`) | nature, type, classe, `sys_class_name`, catégorie |
| `description` | non | texte libre | |
| `version` | non | version ou millésime | `model_id` |
| `vendor` | non | nom du fournisseur — **créé s'il est inconnu**, revue non commencée | fournisseur, éditeur, manufacturer |
| `hosting_location` | non | où il tourne : « UE — Azure Francfort », « interne » | hébergement, localisation, location |
| `contains_personal_data` | non | oui / non | données personnelles, personal data |
| `owner_email` | non | adresse d'un compte AIGMS (sinon ignoré) | responsable, owner, `owned_by`, propriétaire |

### Fournisseurs

| Colonne | Obligatoire | Valeurs | Synonymes |
|---|---|---|---|
| `name` | oui | raison sociale — clé de rapprochement | nom |
| `is_model_provider` | non | oui / non | fournisseur de modèle, model provider |
| `criticality` | non (modérée) | faible / modérée / élevée / critique | criticité |
| `country_code` | non | ISO 3166-1 alpha-2 : FR, US, DE… | pays, country |
| `dpa_signed` | non | oui / non | DPA, DPA signé |
| `security_assessed` | non | oui / non | sécurité évaluée |
| `reversibility_documented` | non | oui / non | réversibilité |
| `subprocessors` | non | texte | sous-traitants |
| `notes` | non | texte | commentaires, remarques |

## Ce que fait l'import

**Rapprochement par nom**, dans l'organisation, sans casse : une ligne dont le
nom existe **met à jour** ce qu'elle apporte (les champs vides ne
n'écrasent rien ; un « oui » ne redevient jamais « non ») ; une ligne nouvelle
**crée**. **Rien ne se supprime** : un actif retiré de la CMDB reste au
registre, avec son histoire. Chaque ligne rend compte — créée, mise à jour,
refusée et pourquoi (nom manquant, nature ou criticité inconnue). L'import est
journalisé (qui, quand, combien) ; au plus 2 000 lignes et 2 Mo par fichier.

Un fournisseur créé par l'import d'actifs arrive « revue non commencée » : la
revue tiers reste un acte humain.

## D'où viennent les colonnes

Le modèle reprend les attributs communs aux inventaires d'IA demandés par
**ISO/IEC 42001 (A.6 — inventaire des systèmes d'IA, données, ressources)** et
**l'AI Act (annexe IV, description du système, versions, fournisseur)**, et
les champs standard d'une CMDB **ITIL 4 / ServiceNow `cmdb_ci`** (`name`,
`sys_class_name`, `model_id`, `owned_by`, `location`, `manufacturer`) — d'où
les synonymes reconnus, pour qu'un export brut passe sans retouche.

## Depuis un connecteur

Les connecteurs (Microsoft Entra, Azure, GitHub, Google Workspace, ServiceNow…)
appellent la **même fonction** `import_ai_assets(organisation, lignes)` avec
des lignes de même forme : brancher un connecteur, c'est écrire la lecture de
sa source vers ces colonnes. Voir `docs/admin/COMPTES_ET_ANNUAIRE.md` (niveau
C) pour le modèle de synchronisation proposé.


## Les cas d'usage (migration 0092)

Un atelier de découverte recense dix à trente usages en deux heures. Les
ressaisir un par un coûte cinq à dix minutes chacun : c'est ce qui fait
déborder l'atelier, et ce qui laisse un registre vide.

### Colonnes

`name`\*, `purpose`\*, `business_process`, `activity`, `expected_benefit`,
`users_description`, `affected_persons`, `data_description`,
`involves_personal_data`, `involves_sensitive_data`,
`involves_vulnerable_persons`, `autonomy_level`, `criticality`,
`criticality_rationale`, `decision_impact`, `owner_email`,
`accountable_email`, `next_review_at`, `assets`, `vendors`.

Modèle : `public/modeles/cas-d-usage.csv`. Les synonymes français usuels sont
reconnus (nom, finalité, processus, activité, autonomie, porteur, données
sensibles, personnes vulnérables, actifs, fournisseurs…).

### Ce que l'import fait, et ce qu'il ne fait pas

- **Rapprochement par nom**, dans l'organisation : une ligne connue complète
  ce qu'elle apporte, une ligne nouvelle crée. Rien ne se supprime, rien ne
  s'efface.
- **Le statut ne s'importe jamais.** Chaque usage entre en `DRAFT` et franchit
  ses jalons par `app.transition_use_case`, qui seul évalue les préconditions.
- **La criticité ne s'importe pas sans sa justification** : elle commande
  l'évaluation d'impact et l'arbitrage du Comité de direction. Sans colonne
  `criticality_rationale`, la ligne est acceptée et la criticité signalée
  comme non reprise.
- **La qualification au regard du règlement ne s'importe pas** : c'est un acte
  de jugement, posé depuis la fiche.
- **Activité, actifs et fournisseurs se rattachent par leur nom**, s'ils
  existent déjà dans l'organisation ; sinon la ligne le dit, sans échouer.

### Où

Administration de l'organisation, et *Administration › Actifs et
fournisseurs* une fois l'organisation choisie. Comme les autres imports, il
est **réservé à l'administration de la plateforme** (0062) : c'est une reprise
de données, pas un acte de gouvernance.
