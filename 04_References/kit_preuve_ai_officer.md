# Kit de Preuve de l'AI Officer Prestataire : Gouvernance & Gestion des Incidents IA (ISO/IEC 42001)

Ce document sert de spécification technique et fonctionnelle pour intégrer les processus de gouvernance de l'IA au sein de votre **Système de Management de l'IA (SMIA)**. Il définit les interactions entre l'**AI Officer (Prestataire)** et les **Managers Internes (Responsables Métiers / DSI / Direction)**, tout en structurant les preuves exigées lors d'un audit de certification ISO 42001.

---

## 1. Matrice RACI : Droits de l'AI Officer Prestataire vs Managers Internes

L'ISO 42001 impose une distinction claire des rôles. En tant que prestataire externe, l'AI Officer conseille, audite, formalise et alerte (**R**esponsable ou **C**onsulté), tandis que la direction ou les responsables internes possèdent l'autorité légale et opérationnelle (**A**ccountable / Décideur).

### Légende RACI
*   **R (Responsible) :** Réalise l'action, produit le livrable.
*   **A (Accountable) :** Approuve, décideur final, porte la responsabilité de la conformité.
*   **C (Consulted) :** Donneur d'avis, expert sollicité avant l'action.
*   **I (Informed) :** Notifié après réalisation de l'action.

### Tableau de Répartition des Responsabilités

| Activité du SMIA / Processus IA | AI Officer (Prestataire) | Direction Générale (Sponsor) | Manager Métier / System Owner | DSI / Responsable IT |
| :--- | :---: | :---: | :---: | :---: |
| **Politique de l'IA & Objectifs** (Clause 5.2) | **R** | **A** | **C** | **C** |
| **Triage & Classification du Risque** (AI Act / ISO) | **R** | **I** | **C** | **C** |
| **Évaluation d'Impact sur l'IA (AIIA)** (Clause 6.1.2) | **R** | **I** | **C** | **C** |
| **Validation finale de mise en production** | **C** | **A** | **A** | **R** |
| **Gestion opérationnelle du Registre d'Incidents** | **R** | **I** | **C** | **C** |
| **Activation du "Kill-Switch" (Arrêt d'urgence)** | **C** | **A** | **A** | **R** |
| **Revue de Direction du SMIA** (Clause 9.3) | **R** | **A** | **I** | **I** |

---

## 2. Structure Standardisée d'un Ticket d'Incident IA (ISO 42001)

Ce format de ticket (compatible Jira, ServiceNow ou Monday) permet de consigner les preuves d'analyse de cause profonde et de traitement exigées par l'auditeur.

### [INC-IA-YYYY-XXXX] - Titre de l'Incident (ex: Dérive de performance du modèle de scoring)

#### 📝 1. Métadonnées de base
*   **ID Unique :** INC-IA-[Année]-[Numéro]
*   **Date/Heure de Détection :** AAAA-MM-JJ HH:MM UTC
*   **Déclencheur :** [Alerte automatique de monitoring / Plainte utilisateur / Audit interne / Alerte Fournisseur]
*   **Système IA Impacté :** [Nom du modèle / ID de l'inventaire]
*   **Rôle de l'organisation :** [Fournisseur / Développeur / Déployeur / Utilisateur]

#### 🚨 2. Qualification et Impact
*   **Description de l'anomalie :** (Description claire des faits : écart constaté, biais détecté, hallucination critique, ou violation de données).
*   **Sévérité initiale :** [Faible / Modérée / Critique]
*   **Classification Réglementaire :** [Système Haut Risque (AI Act) / Risque Limité / Non réglementé]
*   **Droits fondamentaux impactés ?** [Oui / Non] (Si oui, spécifier l'impact : discrimination, vie privée, transparence).

#### 🛠️ 3. Workflow de Traitement & Acteurs
*   **Rapporteur :** [Nom / Rôle]
*   **AI Officer en charge (Prestataire) :** [Nom du prestataire]
*   **System Owner Interne :** [Nom du manager interne responsable du système]
*   **Statut :** [Nouveau ➡️ En cours d'analyse ➡️ Mesure conservatoire ➡️ Résolu ➡️ Clos]

#### 🔍 4. Analyse et Remédiation (Preuves pour l'Auditeur)
*   **Analyse de Cause Profonde (Root Cause) :** (ex: *Data drift* lié à un changement de comportement saisonnier des utilisateurs non pris en compte dans le jeu d'entraînement).
*   **Action Conservatoire Immédiate :** [ex: Activation du Kill-Switch / Bascule sur des règles métiers de fallback / Message d'avertissement aux utilisateurs].
*   **Plan d'Action Correctif (CAPA) :**
    1. Ré-entraînement du modèle avec le jeu de données corrigé (Échéance : AAAA-MM-JJ, Resp : Équipe Data).
    2. Ajout d'une métrique de surveillance spécifique dans le pipeline (Échéance : AAAA-MM-JJ, Resp : MLOps).
*   **Date de Clôture Effective :** AAAA-MM-JJ
*   **Validation AI Officer :** Signé électroniquement par [Nom] le [Date]
*   **Approbation System Owner :** Signé électroniquement par [Nom] le [Date]

---

## 3. Workflows Internes Démontrables (A à F)

### 📈 CLASSE 1 : Haute Criticité (Développeurs / Systèmes à Haut Risque)

#### Workflow A : Mise sur le marché & Triage de l'Inventaire (Fréquence : Continu à Trimestriel)
1.  **Déclencheur :** Soumission d'une demande de nouveau projet IA par un Manager Métier via un formulaire de cadrage.
2.  **Analyse :** L'AI Officer évalue les critères techniques et juridiques du projet (critères de l'EU AI Act, types de données, autonomie du système).
3.  **Décision :** L'AI Officer classe le système dans le registre d'inventaire : *Interdit*, *Haut Risque*, ou *Risque Faible/Général*.
4.  **Preuve d'Audit :** L'historique du registre d'inventaire avec la trace écrite du choix de classification signé par l'AI Officer.

#### Workflow B : Évaluation d'Impact & Alignement des Risques (Fréquence : Avant déploiement)
1.  **Déclencheur :** Projet classé "Haut Risque" ou touchant des données sensibles dans le Workflow A.
2.  **Analyse :** L'AI Officer anime un atelier avec le Manager Métier et la DSI pour réaliser l'**AI Impact Assessment (AIIA)**. Identification des risques (biais, sécurité, explicabilité) et application des contrôles de l'Annexe A de l'ISO 42001.
3.  **Décision :** Rédaction d'un rapport de risques. Le Manager Métier accepte formellement les risques résiduels.
4.  **Preuve d'Audit :** Le document d'AIIA finalisé, daté et signé par l'AI Officer (visa de conformité) et le Manager Métier (acceptation du risque) *avant* le premier déploiement en production.

#### Workflow C : Gestion des Dérives et Kill-Switch (Fréquence : Temps Réel à Mensuel)
1.  **Déclencheur :** Alerte automatique issue du monitoring technique (ex: baisse de performance) ou incident utilisateur remonté.
2.  **Analyse :** L'AI Officer qualifie l'incident sous 24h via la structure de ticket standardisée (Section 2).
3.  **Décision (Escalade) :** Si la dérive dépasse le seuil critique toléré, l'AI Officer émet une recommandation d'arrêt immédiat. La DSI exécute la coupure technique ou la bascule en mode dégradé (Kill-Switch) validée par le System Owner.
4.  **Preuve d'Audit :** Le ticket d'incident complet démontrant la chronologie entre la détection, la recommandation d'arrêt, l'action technique et la validation post-remédiation.

---

### 🛡️ CLASSE 2 : Criticité Modérée (Intégrateurs / Personnalisation de Modèles)

#### Workflow D : Gouvernance des Fournisseurs d'IA (Fréquence : Trimestriel à Semestriel)
1.  **Déclencheur :** Projet d'intégration d'une brique IA externe (API, modèle open source modifié, SaaS tiers).
2.  **Analyse :** L'AI Officer audite le fournisseur à l'aide d'un questionnaire de conformité ISO 42001 / AI Act (politique de données, transparence, robustesse).
3.  **Décision :** L'AI Officer émet un avis favorable, favorable sous conditions (ex: interdiction d'utiliser les données d'entreprise pour l'entraînement du modèle tiers), ou défavorable.
4.  **Preuve d'Audit :** La fiche d'évaluation du fournisseur signée et annexée au contrat commercial par le service Achats/Juridique.

#### Workflow E : Revue Périodique du Registre de Décision (Fréquence : Trimestriel)
1.  **Déclencheur :** Revue planifiée par l'AI Officer selon le calendrier de gouvernance du SMIA.
2.  **Analyse :** Extraction automatique de l'état des plans d'action (CAPA) en cours et des décisions stratégiques du trimestre.
3.  **Décision :** L'AI Officer anime une instance de revue avec les managers internes pour réévaluer l'efficacité des mesures de traitement du risque.
4.  **Preuve d'Audit :** Compte-rendu du comité de gouvernance de l'IA (Minutes) mentionnant l'état d'avancement exact des lignes du registre de décision.

---

### 👥 CLASSE 3 : Faible Criticité (Simples Utilisateurs)

#### Workflow F : Autorisation d'usage & Sensibilisation à l'IA (Fréquence : Au fil de l'eau)
1.  **Déclencheur :** Demande d'un collaborateur interne d'accéder à un outil d'IA grand public (ex: ChatGPT, Midjourney) ou arrivée d'un nouveau collaborateur.
2.  **Analyse :** Vérification de l'adéquation de la demande avec la charte d'utilisation de l'IA de l'entreprise.
3.  **Décision :** Délivrance de l'accès après validation d'un module obligatoire de sensibilisation (AI Literacy).
4.  **Preuve d'Audit :** Registre centralisé des utilisateurs autorisés croisé avec les certificats de formation/sensibilisation signés par le personnel.
