# Références, statut et règles de traçabilité — V1
Version 1.0 — 7 septembre 2026

## 1. Objet
Ce document fixe les références externes utilisées par la méthode AI Governance Office et par AIGMS. Il ne reproduit pas le texte intégral des normes. AIGMS doit stocker des identifiants, résumés internes, exigences dérivées et mappings validés, avec version et date d'effet.

## 2. Références structurantes

| Référence | Statut | Rôle dans la méthode |
|---|---|---|
| ISO/IEC 42001:2023 | Norme internationale publiée | Exigences du SMIA : contexte, leadership, planification, support, opérations, évaluation des performances, amélioration continue ; logique PDCA |
| ISO/IEC 23894:2023 | Guidance | Management des risques spécifiques à l'IA, intégrable aux activités et fonctions de l'organisation |
| ISO/IEC 42005:2025 | Guidance | Evaluation de l'impact des systèmes d'IA sur individus, groupes et société tout au long du cycle de vie |
| ISO/IEC 27001:2022 | Norme de système de management | Discipline SMSI, sécurité de l'information, gouvernance des contrôles et risques cyber |
| Règlement (UE) 2024/1689 — AI Act | Réglementation UE | Obligations selon rôle, usage et niveau de risque ; exigences de transparence et autres obligations applicables progressivement |
| RGPD | Réglementation UE | Licéité, données personnelles, DPIA, droits, sous-traitance, sécurité |
| NIS2 / CRA | Réglementations UE | Cyber-résilience et exigences applicables selon périmètre et rôle |
| NIST AI RMF | Cadre volontaire | Complément pratique de gouvernance et risk management |

## 3. Point de situation AI Act au 7 septembre 2026
- Le règlement est globalement applicable depuis le 2 août 2026, avec exceptions et transitions.
- Les obligations de littératie IA et certaines interdictions s'appliquent depuis le 2 février 2025.
- Les règles de gouvernance et obligations relatives aux modèles GPAI sont applicables depuis le 2 août 2025.
- Les obligations de transparence de l'article 50 sont applicables depuis le 2 août 2026, avec une grâce limitée pour certains systèmes antérieurs concernant le marquage/détection des contenus.
- Les échéances des systèmes à haut risque ont été modifiées/étendues : AIGMS doit donc gérer une table réglementaire versionnée et ne jamais coder une date de conformité en dur dans l'UI.

## 4. Règles de traçabilité dans AIGMS
Chaque exigence réglementaire ou normative configurée doit posséder :
- `framework_code` ;
- `framework_version` ;
- `requirement_reference` ;
- résumé interne ;
- statut : requirement / guidance / internal ;
- date d'effet ;
- date de retrait éventuelle ;
- source officielle ;
- contrôles associés ;
- owner du mapping ;
- date de dernière revue.

## 5. Principe de prudence
AIGMS fournit une aide au cadrage, à la pré-classification, à la documentation et à la preuve. Il ne remplace pas :
- un avis juridique ;
- une décision du responsable de risque ;
- un audit de certification ;
- une autorité compétente.

## 6. Sources officielles vérifiées
- ISO — ISO/IEC 42001:2023, AI management systems.
- ISO — ISO/IEC 23894:2023, guidance on AI risk management.
- ISO — ISO/IEC 42005:2025, AI system impact assessment.
- Commission européenne — AI Act / application timeline et enforcement framework.
- Commission européenne — lignes directrices Article 50, transparence des systèmes IA.
