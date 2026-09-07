# Sprint DISCOVERY & Pilot Readiness — V5
## Kit de préparation au déploiement de l'IA
Version 5.0 — 7 septembre 2026

### Positionnement
Prestation courte de 5 jours destinée à transformer une intention IA, un ensemble de PoC dispersés ou des usages Shadow AI en une **décision de pilote gouvernée, sécurisée, techniquement exploitable et reliée à une roadmap 90 jours**.

Le Sprint constitue une **porte d'entrée DISCOVERY / ASSESS** du modèle AI Governance Office V5. Il ne remplace ni le delivery Data/IA, ni les équipes d'intégration, ni les outils GRC/SIEM/DLP. Il prépare une décision exploitable et produit des objets directement réutilisables dans AIGMS.

### Résultat attendu
À J5, le sponsor doit pouvoir répondre :
1. quels cas d'usage IA méritent d'être poursuivis ;
2. avec quelles données et dépendances ;
3. quels risques et impacts doivent être traités ;
4. quel niveau de supervision humaine est requis ;
5. quelles capacités doivent être BUILD, CONNECT ou DON'T BUILD ;
6. quelles conditions bloquent ou autorisent un pilote ;
7. quel pilote lancer dans les 90 jours, avec quels KPI, rôles et gates.

---

# 1. Préparation J-5 à J0

## Objectifs
- qualifier l'opportunité ;
- confirmer sponsor et interlocuteurs ;
- collecter les documents disponibles ;
- définir périmètre, confidentialité et contraintes ;
- sélectionner les ateliers et participants.

## Entrées minimales
- objectif métier / irritant ;
- sponsor ;
- contexte SI/Data ;
- liste initiale d'outils ou usages IA connus ;
- politiques SSI/RGPD/achats si disponibles ;
- architecture ou cartographie SI existante ;
- fournisseurs IA connus ;
- contraintes sectorielles / souveraineté / HDS le cas échéant.

## Livrables
- fiche opportunité ;
- RACI Sprint ;
- agenda ;
- evidence request list ;
- registre hypothèses/limites.

## Gate G0 — Mandat
GO si :
- sponsor nommé ;
- problème ou objectif explicite ;
- accès minimum aux métiers et à la DSI/Data ;
- périmètre accepté.

---

# 2. J1 — DISCOVER : usages, valeur, contexte et Shadow AI

## Ateliers
Sponsor + métiers + DSI/Data.

## Activités
- clarifier objectifs, irritants et KPI de référence ;
- inventorier usages déclarés et non déclarés ;
- distinguer outil, système, modèle, agent, cas d'usage ;
- identifier owners, utilisateurs et populations affectées ;
- repérer autonomie, décisions influencées et exposition externe ;
- identifier premiers fournisseurs et environnements ;
- estimer taux de couverture de l'inventaire.

## Données AIGMS produites
- `organization_context`
- `ai_use_case`
- `ai_system`
- `ai_model`
- `ai_agent`
- `vendor`
- `stakeholder`
- `business_kpi_baseline`

## Sorties
- backlog initial 8 à 20 cas d'usage ;
- registre IA V0 ;
- carte Shadow AI ;
- contexte et objectifs ;
- premiers owners.

## Gate G1 — Problème et ownership
GO vers approfondissement si :
- sponsor présent ;
- cas d'usage formulé en problème/valeur ;
- owner métier identifié ;
- KPI de départ ou critère de succès défini.

---

# 3. J2 — DATA / SI / TECHNICAL READINESS

## Ateliers
DSI, Data, architecture, sécurité, propriétaires applicatifs.

## Activités
Pour les cas P1/P2 :
- données sources, propriétaires, sensibilité, qualité, volume, fréquence ;
- droits d'utilisation et confidentialité ;
- applications, API et intégrations ;
- identités, accès, secrets, clés API ;
- environnements pilote/production ;
- logs et capacité d'investigation ;
- dépendances cloud ;
- résilience, sauvegarde et réversibilité ;
- contraintes d'hébergement et localisation ;
- identifier ce qui doit être BUILD, CONNECT ou référencé.

## Sorties
- Data & Security Trust Sheet ;
- cartographie SI/Data simplifiée ;
- liste des prérequis techniques ;
- premières décisions BUILD / CONNECT / DON'T BUILD.

## Gate G2 — Data & Technical Readiness
GO si :
- données critiques identifiées ;
- owner data connu ;
- mode d'accès plausible ;
- aucun blocage technique rédhibitoire non traité ;
- dépendances majeures connues.

---

# 4. J3 — GOVERNANCE / RISK / IMPACT / HUMAN OVERSIGHT

## Ateliers
DSI/RSSI/DPO, métier, gouvernance, juridique si nécessaire.

## 4.1 Pré-classification réglementaire
Pour chaque cas prioritaire :
- rôle de l'organisation ;
- potentiel pratique interdite / haut risque / transparence ;
- dépendance GPAI ;
- RGPD / DPIA potentielle ;
- exigences sectorielles ;
- besoin d'avis juridique.

Statuts :
`CONFIRMED / TO_VALIDATE / NOT_APPLICABLE`.

## 4.2 Risk Assessment Lite
Scénario -> causes -> conséquences -> contrôles existants -> vraisemblance -> impact -> risque brut -> traitement -> risque résiduel provisoire -> owner.

Catégories minimales :
cyber, confidentialité, robustesse, qualité data, biais/équité, transparence, IP, fournisseur, autonomie agentique, continuité, réputation, finance, compétences/mauvais usage.

## 4.3 AIIA Lite
Qualifier si les impacts sur personnes/groupes/société justifient une AIIA complète :
- personnes affectées ;
- vulnérabilité ;
- discrimination/exclusion ;
- autonomie humaine ;
- contestation/recours ;
- santé/sécurité ;
- vie privée ;
- droits ;
- impacts socio-économiques/environnementaux pertinents.

## 4.4 Human Oversight Lite
Niveau d'autonomie :
- L0 Advisory
- L1 Propose
- L2 Execute after approval
- L3 Execute within limits
- L4 Highly autonomous

Définir :
- accountable human ;
- triggers d'intervention ;
- override ;
- stop authority ;
- compétence ;
- preuve attendue.

## Sorties
- regulatory preclassification ;
- Risk Register V0 ;
- AIIA Lite ;
- Human Oversight Plan Lite ;
- points à escalader DPO/RSSI/juridique.

## Gate G3 — Gouvernabilité
GO vers pilote si :
- aucune pratique interdite suspectée non résolue ;
- risques critiques traitables ou bloqués ;
- impact assessment requis identifié ;
- supervision humaine définissable ;
- ownership des risques connu.

---

# 5. J4 — PRIORISATION & PILOT DESIGN

## Scoring
Chaque cas est évalué selon :
- valeur métier ;
- urgence ;
- faisabilité Data/SI ;
- maturité technique ;
- risque résiduel estimé ;
- impact humain ;
- dépendance fournisseur ;
- délai de mise en pilote ;
- coût/effort ;
- capacité à mesurer la valeur.

## Décision portefeuille
Sorties :
- P1 : pilote prioritaire ;
- P2 : à préparer ;
- P3 : backlog / expérimentation légère ;
- HOLD : prérequis manquants ;
- STOP : non acceptable ou non pertinent.

## BUILD / CONNECT Design
Pour le pilote retenu :
- BUILD : gouvernance, workflow, décision, human oversight, contrôles ;
- CONNECT : sources de preuves / identité / logs / cloud / ticketing / GRC ;
- DON'T BUILD : SIEM, DLP, IAM, CMDB, runtime guardrails spécialisés, etc.

## Pilot Governance Minimum
Le pilote ne part pas sans :
- owner métier ;
- KPI de départ ;
- données identifiées ;
- risques majeurs tracés ;
- critères d'arrêt ;
- supervision humaine ;
- décision formelle ;
- actions bloquantes identifiées.

## Sorties
- Top 3 ;
- architecture/pattern cible ;
- backlog pilote ;
- `governance_decision` DRAFT ;
- liste des conditions GO.

## Gate G4 — Pilot Ready
Pilote recommandé si :
- sponsor + owner ;
- KPI mesurable ;
- faisabilité Data/SI ;
- risques acceptables sous conditions ;
- oversight défini ;
- architecture cible plausible ;
- budget/ressources estimables.

---

# 6. J5 — EXECUTIVE DECISION & ROADMAP 90 JOURS

## Restitution
Le sponsor reçoit un **Pilot Decision Pack**, et non un rapport de conformité.

## Contenu
1. contexte et objectifs ;
2. portefeuille des usages ;
3. Top 3 et scoring ;
4. cas pilote recommandé ;
5. risques/impacts prioritaires ;
6. pré-classification ;
7. human oversight ;
8. architecture BUILD/CONNECT ;
9. conditions de GO ;
10. KPI pilote ;
11. roadmap 30/60/90 jours ;
12. proposition de suite.

## Décisions possibles
- GO PILOT
- GO WITH CONDITIONS
- HOLD
- STOP
- REASSESS

## Gate G5 — Décision
Toute décision doit contenir :
- scope ;
- options examinées ;
- justification ;
- conditions ;
- décideur ;
- risques liés ;
- actions ;
- date de revue.

---

# 7. Roadmap 30 / 60 / 90 jours

## J0-J30 — Secure the pilot
- closes des actions bloquantes ;
- données et accès ;
- vendor due diligence ;
- règles de sécurité ;
- AIIA/DPIA si requis ;
- controls minimum ;
- environnement pilote ;
- baseline KPI.

## J31-J60 — Build / Connect
- prototype/pilote ;
- intégrations ;
- logs ;
- tests ;
- human oversight ;
- formation utilisateurs ;
- collecte des preuves ;
- revue risques.

## J61-J90 — Decide / Scale
- mesure valeur ;
- revue incidents ;
- revue contrôles ;
- décision Go Production / Extend / Stop ;
- plan OPERATE ;
- backlog d'industrialisation ;
- transfert dans AIGMS.

---

# 8. Livrables du kit

## Livrables client
- Executive Pilot Decision Pack ;
- AI Use Case Register V0 ;
- Portfolio Scoring ;
- Regulatory Preclassification ;
- Risk Register V0 ;
- AIIA Lite ;
- Data & Security Trust Sheet ;
- Human Oversight Lite ;
- BUILD / CONNECT / DON'T BUILD map ;
- Pilot Gate ;
- Roadmap 90 jours ;
- Action Log.

## Livrables internes / AIGMS
Tous les objets précédents doivent être structurés de façon à pouvoir être importés ou saisis directement dans AIGMS sans requalification complète.

---

# 9. Articulation avec AI Governance Office V5

Sprint 5 jours = DISCOVERY / ASSESS accéléré.

Suites :
1. **BUILD / CONNECT** : installation de la gouvernance et intégrations.
2. **Pilot Delivery** : réalisé par SEI / intégrateur / équipe Data & IA.
3. **OPERATE** : AI Governance Office, comités, KPI, preuves, risques, incidents, changements.
4. **ISO 42001 Readiness** : si objectif de SMIA certifiable.

Le Sprint n'est pas un audit ISO et ne délivre pas de déclaration de conformité.

---

# 10. Critères de réussite du Sprint

- 100 % des cas P1 ont un owner ;
- pilote recommandé avec KPI mesurable ;
- pré-classification réalisée pour le Top 3 ;
- risques prioritaires documentés ;
- impacts à approfondir identifiés ;
- supervision humaine définie pour le pilote ;
- data/technical blockers identifiés ;
- BUILD/CONNECT choisi ;
- décision J5 traçable ;
- roadmap 90 jours actionnable.
