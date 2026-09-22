# AIGMS — Validation de l'offre de service CARITIS

*Réponse au document « CARITIS / AIGMS — Plan de service & AI Governance
Discovery Workshop ». Établie depuis le code réel, la base rejouée et les
trois environnements, le 28 septembre 2026. L'audit détaillé qui la fonde :
`docs/audit/AUDIT_TECHNIQUE_ET_FONCTIONNEL_V1.md`.*

---

## 1. Executive Summary

**Ce que la plateforme est réellement.** AIGMS est un *système de référence*
de la gouvernance de l'IA, achevé sur son cœur : 91 migrations, 64 tables,
223 déclencheurs métier, 130 politiques de sécurité, 48 écrans, 289 tests de
règles. Le registre des usages, la qualification AI Act, les risques, les
contrôles, les preuves, les décisions, les incidents, les revues et le
journal d'audit sont livrés et éprouvés de bout en bout.

**Sa différence tient en une phrase :** les règles ne sont pas des
conventions d'écran, elles sont **appliquées en base et opposables**. Un
passage en production refusé l'est par le serveur, avec ses huit
préconditions nommées ; une acceptation de risque est nominative et
impossible pour un autre ; une étude d'impact se signe à deux ; le journal
est *append-only*, y compris pour l'administration. Un tableur ou un GRC
générique ne fait rien de cela.

**Ce que l'offre promet et que la plateforme ne tient pas :** la collecte
automatique de preuves (le cadre des connecteurs existe, **aucune intégration
n'est branchée**), la détection du Shadow AI, le questionnaire de maturité,
les campagnes de collecte, le rapport annuel consolidé et l'import en lot des
cas d'usage — cinq items du Discovery et de la cadence reposent dessus.

**Le bloquant absolu :** la **production est à la migration 0016, la préprod
à 0091**. Rien de ce qui est décrit ici n'existe sur l'environnement de
production. Aucun client ne peut être servi avant cette bascule.

**Conclusion commerciale.** Les trois offres sont vendables, à deux
conditions : (1) ne pas promettre d'automatisation de collecte avant qu'un
connecteur existe ; (2) considérer les charges d'onboarding comme
**optimistes de 30 à 60 %** tant que l'import de cas d'usage et les campagnes
manquent. Le service tient — c'est la *rentabilité* qui dépend du backlog P0.

---

## 2. Architecture AIGMS observée

| Couche | Réalité |
|---|---|
| Application | Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 · 48 écrans, 5 routes serveur, 16 fichiers d'actions |
| Données | Supabase Postgres · 64 tables, RLS **forcée** partout, 130 politiques |
| Règles | 206 fonctions `app` (`security definer`) + 71 enveloppes `public` · 223 déclencheurs |
| Traçabilité | `audit_log` append-only, situé par organisation et cas d'usage (0077) |
| Documents | 8 impressions à l'identité de l'organisation + export `.docx` (étude d'impact) + export JSON (incident, journal) |
| Courriel | Resend + tâche planifiée Vercel (7 h) : immédiat pour ce qui bloque, synthèse à la cadence de chacun (0086) |
| Environnements | local · préprod **0091** · **production 0016** |
| Tests | 289 RLS (règles métier, pas seulement accès) · 25 unitaires · 10 E2E **non exécutés** |

Multi-clients natif : `tenant` → `organization` → rôles par organisation,
marque blanche, identité de documents par organisation. Le consultant voit
tous ses clients depuis `/admin/pilotage`.

---

## 3. Matrice capacité / offre

*Légende : ● implémenté · ◐ partiel · ○ absent.*

| Capacité attendue (§12 du plan) | | Emplacement / commentaire |
|---|:-:|---|
| **Organisation** — tenant, utilisateurs, rôles, permissions, contacts | ● | `tenant`, `organization`, `membership`, `role_assignment`, `contact_request` ; 7 rôles attribuables |
| **Use Cases** — registre, statut, propriétaire, criticité, classification, processus/activité | ● | `ai_use_case` ; 12 statuts, 8 jalons, grille de criticité (0075/0082) |
| **Assets** — registre, rattachements, dépendances | ◐ | `ai_asset`, `asset_control`, liens usage/fournisseur. **Dépendances entre actifs : absentes** (choix assumé : pas de CMDB) |
| **Risks** — registre, scoring, traitement, propriétaire, résiduel, échéances | ● | Cotation V×G calculée en base ; 4 stratégies à conséquences (0059) ; qui répond ≠ qui exécute (0087) |
| **Controls** — référentiel, applicables/non applicables, owner, statut, efficacité, fréquence | ● | 120 contrôles-types ; propositions par les faits ; SoA ; **outillage « se tient avec » (0088)** |
| **Evidence** — dépôt, validation, expiration, versioning, rattachement, demande | ◐ | Tout est là sauf la **demande groupée** (campagne). Fichiers en Storage, empreinte SHA-256 |
| **Decisions** — registre, propriétaire, approbation, justification, historique | ● | 8 types, approbateur attendu, arbitrage Comité si critique, date d'effet appliquée |
| **Suppliers** — registre, criticité, services, contrats, exigences, revue | ◐ | Revue complète et datée, DPA/sécurité/réversibilité. **Pas de questionnaire structuré ni de fiche d'évaluation contractuelle** |
| **Incidents** — registre, rattachement, analyse, actions, clôture | ● | Format du kit : déclencheur, droits fondamentaux, arrêt d'urgence, CAPA, double signature, export Jira/ServiceNow |
| **Workflow** — notifications, validations, rappels, tâches, escalades | ● | 25 natures d'alerte nominatives, rappels datés sans tâche planifiée, courriel immédiat + synthèse |
| **Dashboard** — risques, contrôles, preuves, décisions, actions, maturité, tendances | ◐ | Tout sauf **maturité et tendances** : `governance_health` donne un indice instantané, pas une série |
| **Governance Calendar** — revues, échéances, campagnes, réévaluations, comités | ◐ | Calendrier et cadence calculée (`review_cadence`). **Campagnes : absentes** |
| **Consultant Workbench** — vue multi-client | ● | `/admin/pilotage` : par client — risques élevés ouverts, preuves échues, actions en retard, incidents, revues dues, exigences sans décision |

**Score de couverture : 9 capacités sur 13 pleinement livrées, 4 partielles,
aucune totalement absente.** Les manques sont concentrés sur *la collecte* et
*la mesure*, pas sur *la structure*.

---

## 4. Validation du Discovery Workshop

### 4.1 Ce qui peut réellement être saisi pendant l'atelier

| Bloc du plan | Faisable dans AIGMS | Comment |
|---|:-:|---|
| 1. Contexte et objectifs | ◐ | L'organisation porte secteur, effectif, entités, rôle vis-à-vis de l'IA. Les *objectifs* ne sont pas un objet |
| 2. Inventaire des usages | ● | Déclaration guidée : finalité, bénéfice, utilisateurs, personnes affectées, données, autonomie, propriétaire, redevable. **Un par un — pas d'import** |
| 3. Données et actifs | ● | Actifs (système, modèle, agent, jeu de données) + fournisseurs, **importables en CSV**. L'actif « données personnelles » remonte au cas d'usage (0080) |
| 4. Risques | ● | Cotation immédiate, contrôle de traitement dès l'identification, recherche plein texte de contrôles |
| 5. Gouvernance existante | ◐ | Se lit par les contrôles retenus et les preuves déposées. **Aucune grille de maturité** |
| 6. Pré-classification | ● | Qualification AI Act (rôle, drapeaux, revue juridique), criticité par grille, **et chaque réponse agit** : AIIA exigée, contrôles proposés, cadence calculée |
| 7. Restitution | ◐ | Imprimables immédiats : registre, SoA, actifs, preuves. **Pas de document « synthèse d'atelier »** |

### 4.2 Les quatre sorties promises

| Livrable | État | Ce qui existe |
|---|:-:|---|
| **AI Landscape** | ◐ | Registre imprimable + carte processus/activités + graphe 8 couches. **Shadow AI absent** |
| **Preliminary Risk Map** | ● | Carte thermique par activité et par processus, risques ouverts nommés, chemin d'un risque |
| **Preliminary Regulatory Classification** | ◐ | AI Act complet ; ISO 42001 (41 exigences) ; **RGPD et ISO 27001 quasi absents en base** |
| **Governance Gap Analysis** | ● | Trois lectures réelles : contrôles obligatoires sans décision, matrice des preuves manquantes (`evidence_matrix_gaps`), indice de santé avec causes nommées |
| **Recommendation** | ○ | Aucun objet ne porte l'orientation Essentiel/Pilotage/Critique |

### 4.3 Workflow optimal du Discovery, tel que la plateforme le permet

1. **Avant** — créer l'organisation, poser les six rôles (sans quoi *rien*
   n'est enregistrable : `assert_organization_ready`), importer actifs et
   fournisseurs depuis le questionnaire préalable (CSV).
2. **Pendant, bloc 2** — déclarer chaque usage ; rattacher activité et actifs.
3. **Bloc 4** — coter deux à quatre risques par usage majeur.
4. **Bloc 6** — poser criticité (grille) et qualification (drapeaux) : à ce
   moment, la plateforme **produit d'elle-même** les contrôles proposés,
   l'exigence d'AIIA, la cadence de revue et les alertes.
5. **Bloc 7** — imprimer registre + SoA + carte des risques, lire l'indice de
   santé et les manques de la matrice des preuves.

**Le point de friction** : l'étape 2 est manuelle et coûte 5 à 10 minutes par
usage. Au-delà de dix usages, l'atelier de 2–3 h ne tient pas. C'est le
premier P0 commercial.

---

## 5. Validation des trois offres

### 5.1 ESSENTIEL — vendable en l'état

Périmètre réaliste : 1 à 5 usages internes, faible criticité. Tout ce que
l'offre décrit existe : organisation, rôles, usages, classification,
processus, actifs, risques, contrôles, preuves, calendrier, alertes,
tableau de bord. **Aucune promesse à retirer.**

### 5.2 PILOTAGE — vendable avec deux réserves

Les « campagnes de collecte de preuves » du jour 3 **n'existent pas** : on
ouvre des actions une à une, ce qui tient pour dix preuves et devient coûteux
au-delà. Le « workflow de validation » existe (décisions, approbateur
attendu, gates). **Reformuler** : *collecte pilotée par actions nominatives
et rappels automatiques*, pas *campagnes*.

### 5.3 CRITIQUE — vendable, mais la promesse de surveillance doit être tenue au mot

« Surveillance continue » doit se lire **surveillance des échéances et des
états déclarés**, pas surveillance technique du système d'IA : aucune
métrique de dérive, aucun signal runtime n'entre dans AIGMS. Le jour 5 (« test
des workflows, indicateurs, seuils, alertes ») est faisable **sauf les
seuils**, qui n'existent pas comme objet configurable. Les alertes sont
prédéfinies (25 natures), non paramétrables par le client.

---

## 6. Analyse des charges

| Offre | Onboarding annoncé | Verdict | Condition |
|---|---:|---|---|
| Essentiel | 2 j | **Réaliste** | ≤ 5 usages, actifs/fournisseurs importés en CSV avant l'atelier |
| Pilotage | 3 j | **Optimiste de ~1 j** | Saisie manuelle de 6–15 usages + désignation des responsables ; **tient à 3 j si l'import de cas d'usage existe** |
| Critique | 5 j | **Optimiste de ~2 j** | Cartographie fine, plans de supervision (formulaire riche), études d'impact complètes (4 sections, parties prenantes, constats) : 1 AIIA sérieuse = 0,5 à 1 j |

| Cadence | Verdict |
|---|---|
| Essentiel 4 j/an | **Réaliste** — l'automatisation des rappels et la synthèse quotidienne portent l'essentiel |
| Pilotage 8 j/an | **Réaliste**, à condition que la revue mensuelle soit *asynchrone* et s'appuie sur le poste de pilotage (il donne exactement les six compteurs attendus) |
| Critique 16 j/an | **Réaliste voire large** côté plateforme ; le risque est l'absence de connecteurs : chaque preuve réclamée à la main consomme le forfait |

**Effet des manques sur la rentabilité :** sans campagne de collecte, un
client Pilotage avec 40 preuves annuelles coûte environ **1 à 1,5 j/an** de
relance manuelle — c'est 15 % du forfait.

---

## 7. Gap Analysis

| Manque | Impact commercial | Effort estimé |
|---|---|---|
| **Production à 0016** | **Bloquant absolu** : aucun client servable | 1 j (séquence écrite dans `docs/roadmap/MISE_EN_PRODUCTION.md`) |
| Secrets : rotation, `SERVICE_ROLE_KEY`, `CRON_SECRET`, captcha | **Bloquant** : création de compte HS, courriels muets | 0,5 j (côté propriétaire) |
| Import CSV des cas d'usage | Tient la charge du Discovery et de l'onboarding | 1 j (le mécanisme des actifs se réplique) |
| Campagnes de collecte de preuves | 15 % du forfait récurrent | 3 j |
| Rapport annuel consolidé | Livrable de fin d'année (Phase 5) | 2 j |
| Questionnaire de maturité + score | Argument de Discovery et de restitution | 3 j |
| Registre des usages autorisés / Shadow AI | Bloc 2 du Discovery | 2 j |
| Exigences RGPD / ISO 27001 en base | Crédibilité de la SoA hors ISO 42001 | 1 j (import) |
| Premier connecteur réel (Entra ID ou Azure) | Toute la promesse d'automatisation | 5 j+ |
| Objet « recommandation d'offre » | Sortie du Discovery | 0,5 j |
| Tendances (séries temporelles) | « Dashboard maturité et tendances » | 2 j |

---

## 8. Backlog priorisé

### P0 — indispensable avant le premier client
1. **Bascule de la production** (75 migrations) + purge du jeu de démonstration.
2. **Secrets** : rotation, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`,
   `RESEND_API_KEY`, captcha Turnstile.
3. **Import CSV des cas d'usage** (Discovery et onboarding).
4. **Exécuter la suite E2E** au moins une fois sur la Preview : 10 fichiers
   maintenus qui ne protègent rien aujourd'hui.

### P1 — nécessaire pour industrialiser
5. **Campagnes de collecte de preuves** (demande groupée, relance, clôture).
6. **Rapport annuel de gouvernance** consolidé, imprimable.
7. **Questionnaire de maturité** + indice, avec historique.
8. **Exigences RGPD et ISO 27001** en base, mappées aux contrôles.
9. **Objet « recommandation »** à la fin du Discovery (Essentiel / Pilotage /
   Critique, avec sa justification).

### P2 — différenciant
10. **Premier connecteur réel** (Entra ID pour les comptes ; Azure/M365 pour
    les actifs) — la promesse « connect rather than rebuild » devient vraie.
11. **Registre des usages autorisés** (Shadow AI, littératie, attestation).
12. **Questionnaire fournisseur structuré** + fiche d'évaluation annexable.
13. **Tendances** : séries de l'indice de santé, de la couverture, des risques.
14. **Portail client en lecture seule** (auditeur externe, direction).

### P3 — évolutions futures
15. Assistance générative : résumé d'atelier, brouillon de constat d'impact,
    reformulation de politique — **toujours en proposition, jamais en décision**.
16. Multi-langue (anglais).
17. Collecte de signaux runtime (dérive, incidents modèle) par connecteur.

---

## 9. Automatisations possibles

**Déjà automatique** : rappels d'échéance (preuves, revues, fournisseurs,
études), alertes nominatives (25 natures), synthèse par courriel, cadence de
revue calculée, ordre du jour de revue généré, actions ouvertes par les faits
(constat grave, AIIA achevée, risque à traiter), transitions refusées avec
motif, journal.

**À automatiser, déterministe** (aucune IA générative) :
- campagnes de collecte et relances graduées ;
- rapport annuel assemblé depuis les registres ;
- score de maturité depuis les réponses du questionnaire ;
- proposition d'offre depuis la criticité, le nombre d'usages et le rôle.

**Candidats à l'IA générative, en proposition seulement** :
- brouillon de synthèse d'atelier depuis les objets saisis ;
- reformulation d'un constat d'impact ou d'une justification ;
- suggestion de scénarios de risque depuis la description de l'usage.

**Ce qui doit rester humain, et l'est déjà** : criticité, qualification,
acceptation d'un risque, visa d'étude d'impact, acceptation des risques
résiduels, autorisation de production, clôture d'incident. La base refuse
qu'une IA — ou qu'une seule personne — pose ces actes.

---

## 10. Proposition de service révisée

### ESSENTIEL — *Registre et conformité de base*
**2 j d'onboarding, 4 j/an.** Registre des usages, qualification AI Act,
criticité, risques cotés, contrôles proposés et retenus, preuves avec
échéances, calendrier, alertes nominatives, Déclaration d'Applicabilité
imprimable. *Limite affichée : ≤ 5 usages, collecte de preuves manuelle.*

### PILOTAGE — *Gouvernance opérationnelle*
**3 j d'onboarding, 8 j/an.** Tout Essentiel, plus : étude d'impact ISO 42005
signée à deux, plan de supervision humaine adossé aux contrôles, registre des
décisions avec approbateur attendu, fournisseurs revus, incidents au format du
kit, revues de gouvernance à la cadence calculée, poste de pilotage.
*Limite : relance de collecte assurée par le consultant.*

### CRITIQUE — *Gouvernance sous contrainte*
**5 j d'onboarding, 16 j/an.** Tout Pilotage, plus : arbitrage du Comité de
direction sur les usages critiques (appliqué par la base), double signature
des études d'impact, arrêt d'urgence structuré, journal d'audit filtrable et
imprimable, graphe de gouvernance à 8 couches, outillage des contrôles.
*Limite : surveillance des échéances et des états déclarés — pas de
surveillance technique du système d'IA.*

**Phrase de vente qui ne surpromet pas :**
> AIGMS ne surveille pas vos modèles. Il rend votre gouvernance **opposable** :
> ce qui doit être fait est nommé, daté, confié ; ce qui n'est pas fait bloque
> ce qui en dépend ; et rien de ce qui a été fait ne peut être réécrit.

---

## 11. Risques commerciaux et opérationnels

| Risque | Probabilité | Parade |
|---|---|---|
| Promettre l'automatisation de la collecte sans connecteur | Élevée | Retirer le mot « automatique » des supports tant que P2-10 n'est pas livré |
| Vendre avant la bascule de production | Élevée | P0-1, non négociable |
| Onboarding Pilotage/Critique en dépassement | Moyenne | Livrer P0-3 (import) ; facturer la saisie au-delà d'un seuil d'usages |
| Client demandant un audit ISO 27001 | Moyenne | La SoA ne porte réellement qu'ISO 42001 (41 exigences) : le dire |
| Dépendance à Supabase et Vercel | Faible | Documentée ; migration possible, coûteuse |
| Comptes de démonstration ouverts | Élevée si oubli | P0-2 |
| Alertes jugées trop nombreuses | Moyenne | Préférences par personne déjà livrées (0086) ; ne pas ajouter d'alerte sans arbitrage |

---

## 12. Informations nécessaires au deck Gamma

- **Promesse** : « Votre gouvernance de l'IA, opposable. »
- **Problème client** : l'IA entre par tous les côtés, personne ne sait qui
  répond de quoi, et l'auditeur demande des preuves datées que personne n'a.
- **Bénéfices** : un registre unique ; des décisions nominatives ; des preuves
  fraîches ; des refus motivés ; un journal inaltérable ; un calendrier qui
  tient tout seul.
- **Architecture du service** : CARITIS (méthode, expertise, arbitrage) ·
  AIGMS (structure, trace, alerte, refuse) · IZARRALDE (relation, intégration,
  remédiation) · Client (arbitre, accepte, finance, désigne).
- **Trois offres** : §10 ci-dessus, avec leurs limites affichées.
- **Preuves de sérieux** : 223 règles appliquées en base, 289 tests de règles,
  journal append-only, RACI des six rôles appliqué, huit préconditions de mise
  en production.
- **Objections et réponses** :
  - *« On a déjà un GRC »* → il ne connaît ni cas d'usage IA, ni AI Act, ni
    supervision humaine, ni étude d'impact ISO 42005.
  - *« C'est un tableur amélioré »* → un tableur n'a jamais refusé une mise en
    production.
  - *« Combien de temps pour démarrer ? »* → 2 à 5 jours, atelier compris.
  - *« Et si on change d'outil ? »* → registres imprimables et exports
    (.docx, JSON, CSV) à tout moment.
- **CTA** : un Discovery Workshop de 2–3 h, livrables repartis le jour même.

---

## 13. Questions ouvertes

1. **La production bascule-t-elle avant ou après le premier Discovery ?** Un
   atelier peut se tenir sur la préprod, pas un client.
2. **L'import de cas d'usage est-il un P0 ?** Il conditionne les charges
   annoncées pour Pilotage et Critique.
3. **Quel connecteur en premier ?** Entra ID (comptes, littératie) est le plus
   simple ; Azure/M365 (actifs) a plus de valeur commerciale.
4. **Le questionnaire de maturité est-il un livrable vendu ou un outil
   interne ?** Cela change son ampleur (score simple ou grille ISO 42001).
5. **Qui porte le rôle d'AI Governance Officer chez le client ?** Le modèle
   `client_admin` (0091) suppose un binôme cabinet/client : à contractualiser.
6. **La marque : AIGMS en blanc chez IZARRALDE, ou co-marqué ?** La plateforme
   fait les deux ; le choix est commercial.
7. **Quel seuil d'usages déclenche une facturation de saisie supplémentaire ?**
