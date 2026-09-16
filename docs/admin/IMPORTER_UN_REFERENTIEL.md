# Importer un référentiel de contrôles — mode opératoire

*Version 1.0 — 16 septembre 2026*

## De quoi on parle

Un **référentiel de contrôles** est une bibliothèque de *contrôles-types* :
des modèles — code, titre, objectif, preuves attendues, questions d'évaluation,
correspondances normatives — que les rôles de gouvernance **instancient** chez
une organisation pour en faire des *contrôles opérationnels* (avec un
responsable, un état, des preuves).

Deux sortes de référentiels coexistent :

| | Propriétaire | Visible de | Arrive par |
|---|---|---|---|
| **Référentiel de l'éditeur** — `AIGMS-CF` | personne (`tenant_id` NULL) | tous les tenants | migration, livré avec la plateforme |
| **Référentiel du cabinet** | le tenant qui l'importe | ce tenant seul | l'écran *Administration → Référentiels* |

Ne se confondent pas avec les **référentiels normatifs** (ISO/IEC 42001, AI Act)
qui portent des *exigences* et alimentent la Déclaration d'Applicabilité : ceux-là
ne s'importent jamais par l'écran, ils sont livrés par migration parce qu'une
exigence mal transcrite fausserait la déclaration de tous les clients.

## Le paquet AIGMS Control Framework

- `knowledge/frameworks/aigms/v0.1/` — baseline gelée, 120 titres en 12 domaines.
  **Ne jamais la modifier.**
- `knowledge/frameworks/aigms/v0.2/` — la v0.1 plus la **vague 1 d'enrichissement**
  (GOV, INV, USE, RSK : 42 contrôles avec objectif, questions, preuves attendues,
  responsable, fréquence, correspondances ISO/IEC 42001 et AI Act), domaines en
  français. Générée par `node scripts/generate-catalog-v0.2.mjs` depuis
  `wave1_enrichment.json` ; la migration `0043` la charge comme référentiel de
  l'éditeur, publiée.

Pour une **v0.3** (vague 2 : DAT, SEC, SUP, HUM) : ajouter les contrôles à un
`wave2_enrichment.json`, adapter le script pour cumuler les vagues, générer,
relire le diff du JSON, écrire la migration `00xx_editor_catalog_v0_3.sql`. La
v0.2 devient « remplacée » à la publication de la v0.3 ; les contrôles
opérationnels déjà instanciés gardent leur lien vers la v0.2 — on ne réécrit
pas l'histoire d'un client.

## Importer un référentiel de cabinet

### 1. Préparer le fichier

Deux formats, une seule validation.

**JSON canonique** — le modèle est téléchargeable :
`/modeles/referentiel-controles-modele.json`. Structure minimale :

```json
{
  "framework": { "id": "CAB-CF", "name": "…", "version": "1.0", "control_count": 3, "domain_count": 2 },
  "domains":   [ { "code": "GOV", "name": "Gouvernance", "order": 1 } ],
  "controls":  [ { "id": "CAB-GOV-001", "domain": "GOV", "title": "…", "version": "1.0",
                   "objective": "…", "expected_evidence": ["…"],
                   "framework_mappings": [ { "framework": "ISO_IEC_42001", "version": "2023", "reference": "A.2.2" } ] } ]
}
```

**CSV** — une ligne par contrôle, séparateur `;`, modèle sur
`/modeles/referentiel-controles.csv`. Colonnes obligatoires `control_id`,
`domain`, `title` ; facultatives `domain_name`, `objective`, `control_type`,
`default_applicability`, `owner_role`, `review_frequency`, `status`, `version`.
Le CSV ne porte pas l'identité du référentiel : code, nom et version sont
demandés au dépôt. Il ne porte que l'ossature — pas de questions, de preuves
attendues ni de correspondances ; elles se complètent sur le contrôle
opérationnel, ou dans une version JSON ultérieure.

**Règles que la validation applique :**
- `framework.id + version` et `control.id + version` sont des clés naturelles,
  sans doublon ;
- chaque contrôle référence un domaine présent dans le document ;
- `control_count`, s'il est déclaré, correspond au nombre de contrôles portés ;
- une version déjà publiée ne se réimporte pas — créer une nouvelle version ;
- le code d'un référentiel de l'éditeur (`AIGMS-CF`) ne peut pas être repris
  par un cabinet.

**Correspondances qui deviennent des rattachements :** seules celles vers un
référentiel normatif chargé dans AIGMS — aujourd'hui `ISO_IEC_42001` `2023`,
références `A.2.2` … `A.10.4`, `6.1.2`, `8.4`, `9.3` — sont rattachées
automatiquement à l'instanciation. Les autres (AI Act…) sont conservées et
rappelées, à porter à la main.

### 2. Déposer et valider

*Administration → Référentiels → Importer un référentiel.* Le document est
validé au dépôt ; chaque constat est listé avec son chemin. Rien n'entre en
base avant la confirmation.

### 3. Relire

La version apparaît « Importée » (gelée). Ouvrir son nom : la page liste ses
contrôles, par domaine, avec ce qui est enrichi et ce qui n'est qu'un titre.

### 4. Publier

*Publier* sur la version. Elle devient la version proposée aux organisations du
tenant ; la précédente du même référentiel passe « remplacée ». **Une version
publiée est immuable** : pour corriger, on dépose une nouvelle version.

### 5. Instancier

Sur une organisation, *Contrôles → Ajouter un contrôle → Depuis un référentiel* :
référentiel, domaine, contrôle-type ; la fiche s'affiche avant l'ajout. Le
contrôle opérationnel naît « proposé », avec le lien vers son modèle, et ses
correspondances ISO 42001 rattachées. Un contrôle-type ne s'instancie qu'une
fois par organisation.

## Ce qui est journalisé

Le dépôt, la validation, l'import (avec l'empreinte SHA-256 du fichier), la
publication, l'instanciation : chacun laisse sa ligne dans le journal d'audit,
lisible sur *Administration → Journal*.

## Voir aussi

- `knowledge/frameworks/aigms/v0.1/IMPORT_SPEC.md` — spécification d'origine
- `docs/adr/ADR-0006-shared-framework-catalog.md` — référentiels normatifs partagés
