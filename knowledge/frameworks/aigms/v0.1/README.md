# AIGMS Control Framework V0.1

## Statut
Baseline figée pour le développement du module Admin > Framework Imports.

## Fichier canonique
`aigms_control_framework_v0.1.json`

Le JSON est la source d'import applicative.
Le YAML est la source éditable.
Le CSV sert au contrôle humain, au diff et à l'import de secours.

## Taxonomie
12 domaines / 120 contrôles :
- GOV Governance — 12
- INV AI Inventory — 8
- USE Use Case Management — 10
- RSK AI Risk Management — 12
- DAT Data Governance — 12
- SEC AI Security — 12
- SUP Suppliers & Models — 10
- HUM Human Oversight — 8
- OPS AI Operations — 12
- MON Monitoring & Performance — 8
- INC Incident & Resilience — 8
- CMP Compliance & Assurance — 8

## Principe de modèle
Control -> Risk -> Use Case -> Evidence -> Test -> Finding -> Remediation -> Framework Mapping

## Politique de version
Ne jamais modifier une baseline déjà utilisée en production.
Créer une nouvelle version du framework et des contrôles modifiés.
Les imports doivent être idempotents et fonctionner en UPSERT par clé naturelle.

## Emplacement recommandé dans le projet Claude Code

Ne pas mettre ce référentiel dans `.claude/`.

Utiliser plutôt :

```
/knowledge
  /frameworks
    /aigms
      /v0.1
        aigms_control_framework_v0.1.json
        aigms_control_framework_v0.1.yaml
        aigms_controls_v0.1.csv
        manifest.json
        IMPORT_SPEC.md
```

ou, si le produit possède déjà un dossier métier :

```
/src/domain/frameworks/seed/aigms/v0.1/
```

Le dossier `.claude/` doit rester réservé aux instructions, commandes, agents ou réglages Claude Code.
Le référentiel AIGMS est une donnée métier versionnée indépendante du moteur IA.

## À spécifier dans CLAUDE.md

Ajouter une section de gouvernance :

- Le référentiel AIGMS est une source métier versionnée.
- Claude ne doit jamais modifier une baseline gelée.
- Toute évolution crée une nouvelle version.
- Le code applicatif ne doit pas hardcoder les contrôles.
- Les mappings ISO / AI Act / NIST sont des données et non des règles codées en dur.
- Toute génération de contrôle doit respecter le schéma canonique.
- Toute modification doit produire un diff et passer une validation humaine.
