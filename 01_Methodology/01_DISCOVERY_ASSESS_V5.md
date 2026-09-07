# 01 — DISCOVERY & ASSESS
## AI Discovery, cadrage du SMIA et diagnostic AI Trust — V5
Version 5.0 — 7 septembre 2026

## 1. Finalité
DISCOVERY n’est pas un pré-audit de certification déguisé. C’est la phase de **PLAN** qui transforme une demande souvent vague (« cadrer l’IA », « se mettre en conformité », « sécuriser Copilot/Claude », « préparer ISO 42001 ») en périmètre de gouvernance explicite, fondé sur les usages réels, les risques, les impacts, les responsabilités et les preuves disponibles.

Résultat attendu : la direction sait **quoi gouverner, pourquoi, avec quel niveau d’effort, quels risques prioritaires et quel périmètre BUILD/CONNECT**.

## 2. Principes de conduite
- Approche fondée sur le risque et proportionnée à la taille, au secteur, au rôle réglementaire et à la criticité des usages.
- Distinction systématique entre **déclaration**, **preuve**, **hypothèse** et **non vérifié**.
- Inventaire orienté usages réels, y compris Shadow AI et usages individuels devenus collectifs.
- Aucun score de maturité n’est présenté comme une certification.
- Toute pré-classification AI Act est une aide à la décision et peut nécessiter validation juridique.
- Les évaluations d’impact et de risque sont révisables pendant tout le cycle de vie.

## 3. Déroulé détaillé

### D0 — Mobilisation, sponsor et mandat
**Objectif :** sécuriser le mandat et éviter un diagnostic sans propriétaire.

Activités :
- identifier sponsor exécutif, pilote opérationnel, DSI/RSSI/DPO, métiers et achats ;
- préciser objectif : adoption maîtrisée, ISO 42001 readiness, AI Act, consolidation fournisseurs, maîtrise Shadow AI, audit interne, etc. ;
- définir confidentialité, modalités d’accès aux preuves et règles d’entretiens ;
- convenir du niveau de profondeur : Workshop, pilote 2 usages, diagnostic portefeuille ;
- fixer les règles de décision et d’escalade.

Livrables :
- lettre/fiche de mission ;
- RACI de diagnostic ;
- planning ;
- liste des preuves initiales ;
- registre des hypothèses et limites.

**Gate D0 :** sponsor nommé, périmètre provisoire accepté, accès minimal aux interlocuteurs et preuves.

### D1 — Contexte de l’organisation et objectifs IA
**Objectif :** comprendre l’environnement dans lequel le SMIA devra fonctionner.

Collecter :
- stratégie, métiers, processus critiques et objectifs de transformation ;
- attentes clients, partenaires, assureurs, autorités et collaborateurs ;
- contraintes sectorielles, géographiques, contractuelles et de souveraineté ;
- dépendances SI, cloud, données et fournisseurs ;
- politiques existantes : sécurité, RGPD, achats, qualité, risques, continuité, RH ;
- niveau d’intégration possible avec un SMSI ISO 27001 ou un système qualité existant.

Produire :
- fiche contexte ;
- parties intéressées et attentes pertinentes ;
- enjeux internes/externes ;
- première proposition de périmètre SMIA.

### D2 — Cartographie des rôles et obligations
**Objectif :** éviter de gouverner toutes les IA comme si l’entreprise était « fournisseur » de chaque système.

Pour chaque usage :
- qualifier le rôle de l’organisation dans la chaîne de valeur ;
- identifier fournisseur du modèle, fournisseur de la solution, intégrateur, hébergeur et sous-traitants ;
- relever données personnelles, données sensibles/confidentielles, propriété intellectuelle et contraintes contractuelles ;
- identifier obligations sectorielles ou client spécifiques ;
- tracer les points nécessitant avis juridique/DPO/RSSI.

Livrable : **Regulatory & Accountability Map**.

### D3 — Inventaire AI Systems / Use Cases / Agents / Models
**Objectif :** obtenir le registre initial, pas seulement une liste d’outils.

Sources :
- interviews métiers ;
- licences SaaS et achats ;
- SSO/Entra/Google si disponibles ;
- dépenses carte bancaire / procurement ;
- dépôts Git et API ;
- catalogues cloud ;
- enquêtes utilisateurs ;
- outils de découverte connectés si déjà présents.

Pour chaque cas d’usage :
- finalité et valeur attendue ;
- owner et utilisateurs ;
- populations concernées ;
- entrées/sorties ;
- données ;
- modèle/agent/fournisseur ;
- autonomie et capacité d’action ;
- environnement pilote/production ;
- fréquence et volume ;
- dépendances techniques ;
- statut actuel : autorisé, toléré, inconnu, suspendu, retiré.

Livrables :
- AI Use Case Register ;
- AI System / Model / Agent Register ;
- carte Shadow AI ;
- taux de couverture estimé.

### D4 — Triage valeur / criticité
**Objectif :** ne pas consacrer le même effort à un assistant de rédaction interne qu’à une IA influençant recrutement, sécurité ou décision client.

Axes :
- criticité métier ;
- personnes affectées ;
- niveau d’autonomie ;
- sensibilité des données ;
- exposition externe ;
- volume ;
- réversibilité ;
- dépendance fournisseur ;
- conséquences d’une erreur ;
- potentiel de valeur.

Sortie : portefeuille priorisé en vagues **P1 / P2 / P3**.

### D5 — Pré-classification réglementaire et policy screening
**Objectif :** détecter tôt les usages incompatibles, fortement contraints ou nécessitant davantage de preuves.

Vérifier notamment :
- pratiques interdites ou zones d’alerte ;
- potentiel « haut risque » ou obligations renforcées ;
- exigences de transparence ;
- interaction avec GPAI ;
- obligation de littératie IA ;
- obligations spécifiques du fournisseur/déployeur selon le cas ;
- RGPD : finalité, base, minimisation, DPIA potentielle, droits ;
- sécurité et exigences contractuelles.

Sortie AIGMS : `regulatory_preclassification` avec statut **CONFIRMED / TO_VALIDATE / NOT_APPLICABLE**.

### D6 — Baseline Risk Management — ISO 23894 / AI Act
**Objectif :** construire une première vision des risques connus et raisonnablement prévisibles.

Catégories minimales :
- sécurité / cybersécurité ;
- confidentialité / protection des données ;
- robustesse / fiabilité / disponibilité ;
- biais / équité / droits fondamentaux ;
- transparence / explicabilité ;
- qualité et provenance des données ;
- propriété intellectuelle ;
- dépendance fournisseur et chaîne d’approvisionnement ;
- autonomie / actions agentiques ;
- réputation ;
- finance / FinOps ;
- compétences et mauvais usage ;
- continuité / réversibilité ;
- fraude / manipulation ;
- environnement lorsque matériel.

Méthode :
1. identifier scénario ;
2. identifier actif/personne/processus affecté ;
3. causes et événements ;
4. conséquences ;
5. contrôles existants ;
6. vraisemblance/impact ;
7. risque brut et résiduel provisoire ;
8. owner ;
9. traitement ou étude complémentaire.

Livrables : Risk Register V0 + heatmap + Top Risks.

### D7 — AI Impact Assessment — ISO/IEC 42005
**Objectif :** dépasser le seul risque pour l’organisation et examiner les impacts sur individus, groupes ou société lorsque pertinent.

Évaluer :
- parties affectées et groupes vulnérables ;
- bénéfices et effets indésirables prévisibles ;
- discrimination / exclusion ;
- autonomie humaine et possibilité de contestation ;
- sécurité / santé ;
- vie privée ;
- dignité / droits ;
- impacts socio-économiques ou environnementaux pertinents ;
- distribution des bénéfices et dommages ;
- mesures de prévention, réduction, recours et suivi.

Sortie : **AIIA Lite** ou décision d’engager une AIIA complète pendant BUILD.

### D8 — Baseline Data Trust & Security
**Objectif :** relier gouvernance IA et SMSI au lieu de créer deux silos.

Évaluer :
- classification et sensibilité ;
- provenance ;
- qualité ;
- droits d’usage ;
- rétention ;
- localisation ;
- chiffrement ;
- identités et privilèges ;
- secrets / clés API ;
- journalisation ;
- environnements ;
- vulnérabilités et supply chain ;
- sauvegarde/continuité ;
- capacité d’investigation.

Livrable : Data & Security Trust Sheet par usage P1.

### D9 — Vendor, Model & Agent Due Diligence
**Objectif :** identifier les dépendances qui ne sont pas contrôlées directement par le client.

Analyser :
- conditions contractuelles ;
- usage des données pour entraînement ;
- sous-traitants ;
- localisation ;
- certifications/assurances ;
- documentation modèle ;
- changements unilatéraux ;
- SLA ;
- export/réversibilité ;
- droits d’audit ;
- notification incident ;
- limites, métriques et restrictions d’usage ;
- mécanismes de supervision / permissions des agents.

Sortie : Vendor & Model Risk Sheet.

### D10 — Baseline gouvernance / maturité / preuves
**Objectif :** mesurer l’écart entre pratiques déclarées et système de management réellement démontrable.

Domaines :
- leadership ;
- stratégie et objectifs ;
- politique IA ;
- rôles ;
- inventaire ;
- risques/impacts ;
- lifecycle ;
- données ;
- fournisseurs ;
- sécurité ;
- human oversight ;
- compétences ;
- incidents ;
- mesures/KPI ;
- audit ;
- revue de direction ;
- amélioration.

Chaque observation reçoit :
- statut ;
- preuve ;
- niveau de confiance ;
- criticité ;
- action proposée.

### D11 — Target Scope, Risk Appetite & Objectives
**Objectif :** préparer BUILD.

Définir :
- périmètre cible du SMIA ;
- exclusions justifiées ;
- principes de risque acceptable ;
- objectifs mesurables ;
- exigences de gouvernance par tier de risque ;
- systèmes prioritaires ;
- interfaces avec SMSI, RGPD, qualité, achats, RH et contrôle interne.

### D12 — Restitution CODIR et Gate DISCOVERY
Restitution :
- synthèse exécutive ;
- inventaire et couverture ;
- classification des usages ;
- Top risques et impacts ;
- écarts de gouvernance ;
- quick wins ;
- décision BUILD / CONNECT / STOP ;
- roadmap 30/90/180 jours ;
- budget et charge ;
- risques acceptés provisoirement ;
- décisions à prendre.

**Exit criteria DISCOVERY :**
- owner pour chaque usage P1 ;
- périmètre SMIA proposé ;
- usages P1 inventoriés et triés ;
- principaux rôles/obligations identifiés ;
- risques majeurs documentés ;
- impacts nécessitant approfondissement identifiés ;
- BUILD backlog priorisé ;
- sponsor valide la trajectoire.

## 4. Livrables obligatoires
| Livrable | Workshop | Pilote 2 usages | Diagnostic complet |
|---|---:|---:|---:|
| Mission & scope | Oui | Oui | Oui |
| AI Registry | Esquisse | Oui | Oui |
| Shadow AI map | Esquisse | Ciblée | Oui |
| Regulatory pre-classification | Flash | Oui | Oui |
| Risk Register | Flash | Oui | Oui |
| AIIA | Trigger | Lite | Selon risque |
| Data Trust Sheet | Non | Oui | Oui P1 |
| Vendor/Model sheet | Non | Oui | Oui P1 |
| AIGI / maturity | Flash | Preuve partielle | Preuve structurée |
| Roadmap | 30/90 j | 30/90/180 j | Programme complet |

## 5. Données AIGMS à créer pendant DISCOVERY
- organization / business_unit ;
- ai_use_case / ai_system / ai_model / ai_agent ;
- vendor / dataset ;
- owner / role ;
- assessment ;
- regulatory_preclassification ;
- risk ;
- impact_assessment ;
- evidence ;
- action ;
- governance_decision.

## 6. KPI de qualité DISCOVERY
- % usages P1 avec owner ;
- % usages P1 avec données/fournisseur connus ;
- % usages pré-classifiés ;
- % risques élevés avec owner ;
- taux de preuves vérifiées ;
- taux de couverture de l’inventaire estimé ;
- nombre de décisions CODIR en attente ;
- délai moyen intake → triage.

## Références normatives et état de l’art
Cette méthode est une interprétation opérationnelle et ne reproduit pas le texte des normes. Elle doit être adaptée au contexte, aux rôles réglementaires et au niveau de risque du client.

Références principales :
- ISO/IEC 42001:2023 — système de management de l’IA (SMIA), logique PDCA et amélioration continue.
- ISO/IEC 23894:2023 — recommandations de management des risques liés à l’IA.
- ISO/IEC 42005:2025 — évaluation de l’impact des systèmes d’IA sur les individus, groupes et société tout au long du cycle de vie.
- ISO/IEC 27001:2022 — système de management de la sécurité de l’information et gestion des risques de sécurité.
- Règlement (UE) 2024/1689 (AI Act), version consolidée applicable : obligations selon rôle, usage et niveau de risque.
- NIST AI RMF 1.0 — fonctions GOVERN, MAP, MEASURE, MANAGE comme cadre complémentaire de bonnes pratiques.

Sources officielles :
- https://www.iso.org/fr/standard/42001
- https://www.iso.org/fr/standard/77304.html
- https://www.iso.org/fr/standard/42005
- https://www.iso.org/fr/standard/27001
- https://eur-lex.europa.eu/eli/reg/2024/1689
- https://www.nist.gov/itl/ai-risk-management-framework


## Références de méthode et règle d'interprétation
La phase s'appuie sur ISO/IEC 42001:2023 comme référentiel de système de management, complété par ISO/IEC 23894:2023 pour le risque, ISO/IEC 42005:2025 pour les impacts, ISO/IEC 27001:2022 pour la sécurité de l'information, et l'AI Act selon le rôle et le niveau de risque.

**Règle AIGMS :** une exigence externe n'est jamais implémentée comme une simple case à cocher. Elle doit pouvoir être reliée à un owner, un contrôle, une preuve, une décision, un statut, une échéance et un historique.
