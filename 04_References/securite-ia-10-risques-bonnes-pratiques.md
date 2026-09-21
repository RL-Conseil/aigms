---
# ─────────────────────────────────────────────────────────────
# AIGMS — Fiche de connaissance / Référentiel de risques IA
# ─────────────────────────────────────────────────────────────
doc_id: AIGMS-KB-SEC-IA-001
titre: "Sécurité de l'IA : les 10 risques à connaître et les bonnes pratiques à adopter"
type_document: dossier_magazine
domaine: securite_ia
langue: fr
statut: actif
version: 1.0
date_extraction: 2026-09-21
extrait_par: claude-opus-5

source:
  nature: presse_specialisee
  support: magazine_papier
  pages_sources: [44, 45, 46, 47]
  pages_manquantes: [48]
  fichiers_images:
    - 20260919_114715.jpg  # p.44
    - 20260919_114720.jpg  # p.45
    - 20260919_114728.jpg  # p.46
    - 20260919_114731.jpg  # p.47
  chemin_images: "C:\\Users\\RichardLabrador\\OneDrive\\Images\\Risques_IA"
  methode: transcription_ocr_visuelle
  fidelite: "Texte des pages 44 à 47 transcrit et restructuré. Aucune reformulation
             altérant le sens. Tout ajout hors source est préfixé derive_ ou placé
             dans une section explicitement marquée [PROPOSITION]."

completude:
  risques_couverts_par_source: 9.5
  risques_total: 10
  alerte: >
    L'article s'interrompt en bas de page 47 au milieu du risque n°10
    ("Elles contournent…"). La section « bonnes pratiques à adopter »
    annoncée dans le chapô ne figure PAS dans les images fournies.
    La fin du risque 10 et la section bonnes pratiques de ce document
    sont des PROPOSITIONS dérivées, non issues de la source.

taxonomie:
  nb_risques: 10
  categories:
    - manipulation_entrees
    - integrite_donnees_modele
    - confidentialite_donnees
    - propriete_intellectuelle
    - persistance_agent
    - architecture_multiagent
    - supply_chain
    - fraude_identite
  referentiels_cites_par_source: [NIST, ISO, OWASP, MITRE]

mots_cles:
  - securite ia
  - prompt injection
  - empoisonnement modele
  - inversion de modele
  - inference appartenance
  - vol de modele
  - llmjacking
  - empoisonnement memoire
  - systemes multiagents
  - supply chain ia
  - attaque evasion
  - adversarial
  - deepfake
  - rgpd
  - ai act
  - anssi
---

# Sécurité de l'IA : les 10 risques à connaître et les bonnes pratiques à adopter

> **Chapô (source, p.44)** — À mesure que l'intelligence artificielle s'intègre aux
> applications et aux processus métier, elle ouvre aussi de nouvelles surfaces
> d'attaque. Découvrez les dix principales menaces à surveiller et les bonnes
> pratiques à adopter pour mieux sécuriser vos systèmes d'IA.

---

## 1. Contexte et périmètre

```yaml
bloc: contexte
page_source: 44
```

Les entreprises sont désormais pleinement entrées dans l'ère du développement et du
déploiement de l'intelligence artificielle. Elles construisent des systèmes multiagents
et constatent une amélioration du retour sur investissement de leurs projets d'IA. Mais
l'innovation s'accompagne aussi de nouveaux risques. Parmi eux figurent les attaques
propres aux systèmes d'intelligence artificielle, comme l'apprentissage automatique
adversarial.

**Donnée chiffrée (source)** — Selon le rapport *Currents Research* publié par
DigitalOcean en février 2026, **34 % des personnes interrogées déclarent rencontrer des
difficultés pour gérer la sécurité de leurs différents outils d'IA**. Ce chiffre est loin
d'être négligeable, d'autant que les surfaces d'attaque s'élargissent désormais aux :

- données utilisées par l'IA ;
- modèles ;
- résultats générés ;
- contenus synthétiques ;
- deepfakes.

Des menaces comme l'injection de prompt, l'empoisonnement des modèles de langage,
l'inversion de modèle et les entrées adversariales peuvent manipuler les résultats,
provoquer la fuite d'informations sensibles ou dégrader les performances d'un système.
Ces attaques sont souvent difficiles à détecter avec les outils de cybersécurité
traditionnels. Pour les décideurs techniques, la sécurité de l'IA ne consiste donc plus
seulement à renforcer l'infrastructure. Elle nécessite également une compréhension
approfondie du comportement des modèles dans des conditions réelles.

### 1.1 Le périmètre de la sécurité de l'IA

La sécurité de l'IA regroupe l'ensemble des pratiques destinées à protéger les systèmes
d'intelligence artificielle contre les menaces, tout en préservant la qualité, la
fiabilité et l'intégrité des données et des modèles.

**Son périmètre est plus large que celui de la cybersécurité traditionnelle.** Là où cette
dernière se concentre principalement sur les serveurs, les réseaux, les terminaux, les
applications ou les comptes utilisateurs, la sécurité de l'IA doit également prendre en
compte :

- les données d'entraînement et d'inférence ;
- les modèles ;
- les instructions système ;
- les contenus générés ;
- les outils connectés ;
- la mémoire persistante utilisée par certains agents.

Cette extension de la surface d'attaque expose les systèmes d'IA à des menaces
spécifiques. Ces attaques peuvent provoquer des fuites d'informations sensibles, dégrader
le comportement d'un modèle, favoriser la propagation de fausses informations ou conduire
un agent à exécuter des actions non autorisées.

Pour limiter ces risques, les développeurs et les organisations doivent adopter une
approche de sécurité adaptée à l'ensemble du cycle de vie des systèmes d'IA. Elle repose
notamment sur :

- le contrôle de la qualité des données ;
- l'évaluation régulière du comportement des modèles ;
- la surveillance continue ;
- le choix de fournisseurs fiables ;
- la définition d'exigences internes de sécurité ;
- le maintien d'une supervision humaine lorsque les décisions sont critiques.

La collaboration entre les équipes techniques, métiers, juridiques et de conformité joue
également un rôle essentiel. Des frameworks spécialisés permettent de structurer cette
démarche et de mieux identifier, évaluer et réduire les risques. Parmi les principales
références figurent notamment les cadres proposés par le **NIST**, l'**ISO**, l'**OWASP**
et **MITRE**. Leur objectif commun est d'aider les organisations à intégrer la sécurité
dès la conception des systèmes d'IA, puis à la maintenir tout au long de leur utilisation.

---

## 2. Les 10 risques

### RISQUE N°1 — Les injections de prompt multimodales et indirectes

```yaml
id: AIGMS-RISK-IA-01
slug: injection-prompt-multimodale-indirecte
nom: "Injections de prompt multimodales et indirectes"
page_source: 45
categorie: manipulation_entrees
cible: [modele, agent, outils_connectes, pipeline_rag]
phase_cycle_de_vie: [inference, execution_agent]
vecteur: [texte, image, audio, document, caracteres_unicode_invisibles, mise_en_forme_typographique, page_web, source_rag]
impact: [execution_commandes_non_autorisees, exfiltration_donnees, appels_outils_non_autorises, acces_crm, envoi_messages, modification_fichiers]
tendance_2026: "en évolution — de la simple tentative de contournement textuel vers la perturbation des boucles d'exécution des agents"
incident_cite:
  - nom: "Vulnérabilité Google Jules"
    date: 2025-08
    description: "Caractères Unicode invisibles ; instructions cachées dans une issue GitHub pouvant déclencher l'exécution de code ou de commandes non autorisées"
# ── champs dérivés (NON issus de l'article) ──
derive_owasp_llm: "LLM01 - Prompt Injection"
derive_nist_ai_100_2: "Abuse / Prompt injection (direct & indirect)"
derive_mitre_atlas_tactique: "Initial Access, Execution, Defense Evasion"
derive_ai_act: "Art. 15 (robustesse & cybersécurité), Art. 14 (supervision humaine)"
derive_criticite: critique
derive_detectabilite: faible
```

Les attaques par injection de prompt multimodale et indirecte restent très répandues en
2026. Elles ont évolué, passant de simples tentatives de contournement textuel à des
techniques capables de perturber les boucles d'exécution des agents.

Cette vulnérabilité repose sur une difficulté fondamentale : **lorsqu'instructions
légitimes et données non fiables apparaissent dans une même séquence, un modèle peut avoir
du mal à les distinguer.** Le risque ne se limite donc plus à générer une réponse
inappropriée. Une injection peut aussi entraîner des appels d'outils non autorisés,
l'exécution de commandes, l'exfiltration de données, l'accès à un CRM, l'envoi de messages
ou encore la modification de fichiers.

Les injections indirectes sont particulièrement dangereuses, car elles peuvent transformer
une source apparemment fiable, comme une page Web ou un document récupéré par un système
RAG, en vecteur d'attaque caché. Un attaquant peut ainsi dissimuler des instructions
malveillantes dans une image, un fichier audio, un document, des caractères Unicode
invisibles ou encore dans une mise en forme typographique destinée à échapper aux
mécanismes de détection.

Ces techniques peuvent permettre de contourner des filtres uniquement conçus pour analyser
le texte visible. En août 2025, une vulnérabilité de Google Jules impliquant des caractères
Unicode invisibles a ainsi été révélée. Des instructions cachées dans une issue GitHub
pouvaient déclencher l'exécution de code ou de commandes non autorisées.

---

### RISQUE N°2 — L'empoisonnement des données et des modèles

```yaml
id: AIGMS-RISK-IA-02
slug: empoisonnement-donnees-modeles
nom: "Empoisonnement des données et des modèles"
page_source: 45
categorie: integrite_donnees_modele
cible: [jeu_entrainement, donnees_fine_tuning, base_documentaire_rag, source_donnees_externe]
phase_cycle_de_vie: [collecte_donnees, entrainement, fine_tuning, indexation_rag]
vecteur: [donnees_malveillantes, declencheur_pixels, formulation_specifique, texte_biaise, sequence_predefinie]
impact: [decisions_biaisees, resultats_incorrects, defaillances_systemiques, porte_derobee, vulnerabilites_latentes_post_reentrainement]
particularite: "Attaque préparable longtemps à l'avance — mécanisme dormant. Le modèle semble fonctionner normalement dans la majorité des situations."
# ── champs dérivés (NON issus de l'article) ──
derive_owasp_llm: "LLM04 - Data and Model Poisoning"
derive_nist_ai_100_2: "Poisoning (availability / targeted / backdoor)"
derive_mitre_atlas_tactique: "ML Supply Chain Compromise, Persistence"
derive_ai_act: "Art. 10 (gouvernance des données), Art. 15"
derive_criticite: critique
derive_detectabilite: tres_faible
```

L'empoisonnement consiste à introduire des données malveillantes dans un jeu
d'entraînement, des données de fine-tuning, une base documentaire RAG ou encore une source
de données externe.

L'objectif est de compromettre la fiabilité du modèle avant même son déploiement. Ce type
d'attaque peut introduire des vulnérabilités latentes qui **persistent après le
réentraînement** et provoquer des décisions biaisées, des résultats incorrects, des
défaillances systémiques ou encore l'installation d'une porte dérobée.

Un modèle empoisonné peut ainsi sembler fonctionner normalement dans la majorité des
situations, tout en produisant un comportement malveillant lorsqu'il rencontre un motif
précis contrôlé par l'attaquant. Ce déclencheur peut prendre la forme de pixels
particuliers, de formulations spécifiques, de textes biaisés ou de séquences prédéfinies.
Ces attaques peuvent être préparées longtemps à l'avance et ne se manifester
qu'ultérieurement, à la manière d'un mécanisme dormant.

---

### RISQUE N°3 — L'inversion de modèle et la reconstruction de données

```yaml
id: AIGMS-RISK-IA-03
slug: inversion-modele-reconstruction-donnees
nom: "Inversion de modèle et reconstruction de données"
page_source: 45
categorie: confidentialite_donnees
cible: [modele, api_exposee, donnees_entrainement]
phase_cycle_de_vie: [inference, exposition_api]
vecteur: [interrogation_api_repetee, analyse_scores_confiance, analyse_probabilites, analyse_variations_reponses, analyse_comportement_general]
impact: [reconstruction_noms, reconstruction_adresses, reconstruction_visages, reconstruction_attributs_personnels, fuite_donnees_confidentielles]
particularite: "Permet d'extraire des informations sensibles SANS compromettre directement la base de données d'origine."
# ── champs dérivés (NON issus de l'article) ──
derive_owasp_llm: "LLM02 - Sensitive Information Disclosure"
derive_nist_ai_100_2: "Privacy compromise / Model inversion & reconstruction"
derive_mitre_atlas_tactique: "Exfiltration, ML Model Access"
derive_ai_act: "Art. 15 ; RGPD art. 5, 25, 32"
derive_criticite: elevee
derive_detectabilite: moyenne
```

L'inversion de modèle est une attaque qui vise la confidentialité en exploitant les
réponses d'un modèle pour reconstituer des informations sensibles issues de ses données
d'entraînement. Un attaquant peut, par exemple, interroger une API de manière répétée et
analyser les scores de confiance, les probabilités, les variations entre les réponses ou
encore le comportement général du modèle.

À partir de ces éléments, il peut tenter de reconstruire progressivement des informations
telles que des noms, des adresses, des visages, des attributs personnels ou d'autres
données confidentielles. Cette technique peut ainsi permettre d'extraire des informations
sensibles sans avoir à compromettre directement la base de données d'origine.

---

### RISQUE N°4 — Les attaques par inférence d'appartenance

```yaml
id: AIGMS-RISK-IA-04
slug: inference-appartenance
nom: "Attaques par inférence d'appartenance"
page_source: [45, 46]
categorie: confidentialite_donnees
cible: [modele, donnees_entrainement]
phase_cycle_de_vie: [inference]
vecteur: [analyse_confiance_differentielle, modeles_fantomes_shadow_models, donnees_publiques]
principe_technique: "Un modèle se montre plus confiant lorsqu'il traite des données déjà rencontrées pendant son entraînement. L'attaquant crée des modèles secondaires (modèles fantômes) à partir de données publiques pour apprendre à reconnaître les différences de comportement entre données connues et données inédites."
impact: [revelation_maladie, revelation_situation_personnelle, revelation_appartenance_population, divulgation_information_protegee, remise_en_cause_anonymisation, risques_juridiques]
# ── champs dérivés (NON issus de l'article) ──
derive_owasp_llm: "LLM02 - Sensitive Information Disclosure"
derive_nist_ai_100_2: "Privacy compromise / Membership inference"
derive_mitre_atlas_tactique: "ML Model Access, Exfiltration"
derive_ai_act: "RGPD art. 4 (données personnelles), art. 9 (données sensibles), art. 32"
derive_criticite: elevee
derive_detectabilite: faible
```

Les attaques par inférence d'appartenance cherchent à déterminer si une donnée précise a
été utilisée pour entraîner un modèle. Elles représentent un risque important pour la
confidentialité, car elles peuvent permettre de déduire qu'une personne appartenait à un
jeu de données sensible et révéler indirectement une maladie, une situation personnelle,
l'appartenance à une population particulière ou toute autre information protégée.

Ces attaques exploitent notamment le fait qu'un modèle peut se montrer plus confiant
lorsqu'il traite des données déjà rencontrées pendant son entraînement. L'attaquant peut
alors créer des modèles secondaires, appelés **modèles fantômes**, à partir de données
publiques afin d'apprendre à reconnaître les différences de comportement entre des données
connues du modèle et des données inédites.

Ce type d'attaque peut **remettre en cause certaines méthodes classiques d'anonymisation**
et entraîner des risques juridiques importants.

---

### RISQUE N°5 — Le vol et l'extraction de modèles

```yaml
id: AIGMS-RISK-IA-05
slug: vol-extraction-modeles
nom: "Vol et extraction de modèles"
page_source: 46
categorie: propriete_intellectuelle
cible: [modele_proprietaire, api_exposee, identifiants_api]
phase_cycle_de_vie: [exposition_api, exploitation]
vecteur: [interrogation_systematique_api, collecte_couples_entree_resultat, distillation, identifiants_api_voles]
technique_associee:
  - nom: LLMjacking
    description: "Utilisation d'identifiants d'API volés pour exploiter illégalement des ressources, dérober des données, introduire du code malveillant ou détourner des services payants."
impact: [perte_propriete_intellectuelle, perte_avantage_concurrentiel, cout_financier, reproduction_biais_modele_origine]
particularite: "La perte de PI survient même si l'infrastructure n'a jamais été directement compromise. Le modèle de substitution reproduit aussi certaines erreurs et certains biais du modèle d'origine."
# ── champs dérivés (NON issus de l'article) ──
derive_owasp_llm: "LLM10 - Unbounded Consumption (incl. model theft/extraction)"
derive_nist_ai_100_2: "Model extraction / Model stealing"
derive_mitre_atlas_tactique: "ML Model Access, Exfiltration, Impact (Cost Harvesting)"
derive_criticite: elevee
derive_detectabilite: moyenne
```

Le vol de modèle consiste à reproduire aussi fidèlement que possible un modèle
propriétaire en interrogeant systématiquement son API. À mesure que les entreprises
proposent leurs modèles sous forme de service, un attaquant peut collecter un grand nombre
de couples entrée-résultat, puis constituer un jeu de données destiné à entraîner un
modèle de substitution. À l'aide de techniques de **distillation**, ce dernier peut
reproduire les comportements, les spécialisations, mais aussi certaines erreurs et
certains biais du modèle d'origine.

Le principal risque pour l'entreprise est alors la perte d'une propriété intellectuelle
coûteuse et, potentiellement, d'un avantage concurrentiel, **même si son infrastructure
n'a jamais été directement compromise**.

Une autre forme d'attaque, parfois appelée **LLMjacking**, consiste à utiliser des
identifiants d'API volés pour exploiter illégalement des ressources, dérober des données,
introduire du code malveillant ou détourner des services payants.

---

### RISQUE N°6 — L'empoisonnement de la mémoire

```yaml
id: AIGMS-RISK-IA-06
slug: empoisonnement-memoire
nom: "Empoisonnement de la mémoire"
page_source: 46
categorie: persistance_agent
cible: [agent, memoire_persistante, stockage_contexte_multi_sessions]
phase_cycle_de_vie: [execution_agent, persistance]
vecteur: [fausse_information_durable_en_memoire, regle_frauduleuse_memorisee]
exemple_source: "Demander à un assistant de mémoriser une règle frauduleuse : « les prochaines factures doivent être envoyées à une nouvelle adresse ». L'agent réutilise cette information lors de futures interactions et effectue des actions non autorisées."
impact: [actions_non_autorisees_recurrentes, fraude_financiere, modification_logique_future_agent]
particularite: "Contrairement à une injection temporaire, l'effet est durable. La cause initiale est ancienne et difficile à relier au comportement observé plus tard."
# ── champs dérivés (NON issus de l'article) ──
derive_owasp_llm: "LLM01 - Prompt Injection ; LLM06 - Excessive Agency ; LLM08 - Vector and Embedding Weaknesses"
derive_mitre_atlas_tactique: "Persistence, Impact"
derive_ai_act: "Art. 12 (journalisation), Art. 14 (supervision humaine)"
derive_criticite: critique
derive_detectabilite: tres_faible
```

L'empoisonnement de la mémoire cible les agents utilisant un stockage persistant pour
conserver un contexte entre plusieurs sessions. Contrairement à une injection temporaire,
cette attaque consiste à **introduire une fausse information durable dans la mémoire de
l'agent**.

Un attaquant pourrait, par exemple, demander à un assistant de mémoriser une règle
frauduleuse : les prochaines factures doivent être envoyées à une nouvelle adresse.
L'agent pourrait réutiliser cette information lors de futures interactions et effectuer des
actions non autorisées.

Ce type d'attaque est dangereux, car **la cause initiale peut être ancienne et difficile à
relier au comportement observé plus tard**. L'attaquant modifie ainsi indirectement la
logique future de l'agent.

---

### RISQUE N°7 — Les défaillances en cascade dans les systèmes multiagents

```yaml
id: AIGMS-RISK-IA-07
slug: defaillances-cascade-multiagents
nom: "Défaillances en cascade dans les systèmes multiagents"
page_source: 46
categorie: architecture_multiagent
cible: [agent_orchestrateur, agents_specialises, processus_automatise]
phase_cycle_de_vie: [execution_agent, orchestration]
vecteur: [agent_compromis_transmettant_informations_incorrectes, confiance_implicite_inter_agents]
principe_technique: "De nombreuses architectures reposent sur un agent d'orchestration supervisant plusieurs agents spécialisés (vérifier un fournisseur, traiter une facture, approuver un paiement, modifier un compte). Une information erronée se propage très rapidement aux autres composants, qui la considèrent comme fiable parce qu'elle provient du système interne."
incident_cite:
  - organisation: Meta
    description: "Un agent aurait publié un conseil non autorisé sur un forum interne, ce qui aurait conduit un second agent à exécuter des commandes et à exposer des données de salariés pendant plus de deux heures."
    statut: rapporte
impact: [compromission_processus_automatise_complet, exposition_donnees_salaries, propagation_vitesse_machine]
particularite: "Propagation à la vitesse des machines, difficile à interrompre car le raisonnement des agents reste peu transparent pour les humains. Un seul point de défaillance peut compromettre l'ensemble d'un processus automatisé."
# ── champs dérivés (NON issus de l'article) ──
derive_owasp_llm: "LLM06 - Excessive Agency ; LLM09 - Misinformation"
derive_mitre_atlas_tactique: "Execution, Impact"
derive_ai_act: "Art. 14 (supervision humaine), Art. 15"
derive_criticite: critique
derive_detectabilite: faible
```

Une défaillance en cascade survient lorsqu'un agent compromis transmet des informations
incorrectes à l'ensemble d'un système automatisé. De nombreuses architectures reposent en
effet sur un agent d'orchestration chargé de superviser plusieurs agents spécialisés, par
exemple pour vérifier un fournisseur, traiter une facture, approuver un paiement ou
modifier un compte.

Si l'un de ces agents fournit une information erronée, celle-ci peut se propager très
rapidement aux autres composants, qui risquent de la considérer comme fiable **simplement
parce qu'elle provient du système interne**. Cette propagation à la vitesse des machines
devient particulièrement difficile à interrompre lorsque le raisonnement des agents reste
peu transparent pour les humains. Un seul point de défaillance peut alors compromettre
l'ensemble d'un processus automatisé.

Un incident rapporté chez **Meta** illustre ce risque : un agent aurait publié un conseil
non autorisé sur un forum interne, ce qui aurait conduit un second agent à exécuter des
commandes et à exposer des données de salariés pendant plus de deux heures.

---

### RISQUE N°8 — La compromission de la chaîne d'approvisionnement de l'IA

```yaml
id: AIGMS-RISK-IA-08
slug: compromission-supply-chain-ia
nom: "Compromission de la chaîne d'approvisionnement de l'IA"
page_source: 46
categorie: supply_chain
cible: [modeles_preentraines, jeux_de_donnees, bibliotheques, dependances, depots_publics, outils_de_deploiement]
phase_cycle_de_vie: [conception, entrainement, deploiement]
vecteur: [publication_modele_malveillant, bibliotheque_contenant_code_malveillant, charge_utile_dans_poids_modele, fichiers_serialises, bytecode, scripts_installation, dependances_compromises, confusion_noms_paquets_modeles]
impact: [execution_code_automatique_au_chargement_du_modele, compromission_avant_premiere_inference, telechargement_imitation_malveillante]
particularite: "Le code malveillant peut être exécuté automatiquement lorsque le modèle est chargé. Une entreprise peut compromettre son système avant même d'avoir lancé la moindre inférence."
# ── champs dérivés (NON issus de l'article) ──
derive_owasp_llm: "LLM03 - Supply Chain"
derive_nist_ai_100_2: "ML supply chain attacks"
derive_mitre_atlas_tactique: "ML Supply Chain Compromise, Initial Access, Execution"
derive_ai_act: "Art. 15 ; obligations fournisseurs de modèles GPAI"
derive_mesure_technique_cle: "Interdire les formats de sérialisation exécutables (pickle) au profit de safetensors ; vérifier signatures et provenance ; SBOM/AI-BOM."
derive_criticite: critique
derive_detectabilite: moyenne
```

La chaîne d'approvisionnement de l'IA regroupe l'ensemble des composants nécessaires à la
conception, à l'entraînement et au déploiement d'un système d'intelligence artificielle.
Elle comprend notamment les modèles préentraînés, les jeux de données, les bibliothèques et
leurs dépendances, mais aussi les dépôts publics utilisés pour distribuer ces ressources
ainsi que les outils servant à déployer les modèles en production.

Les attaquants peuvent exploiter la confiance accordée aux plateformes de distribution en y
publiant des modèles ou des bibliothèques contenant du code malveillant. Ces charges utiles
peuvent être dissimulées directement dans **les poids d'un modèle**, dans des **fichiers
sérialisés**, du **bytecode**, des **scripts d'installation** ou encore dans des
**dépendances compromises**.

Le code malveillant peut être exécuté automatiquement lorsque le modèle est chargé.
Certaines attaques jouent également sur la **confusion entre noms de paquets ou modèles**
afin d'inciter les développeurs à télécharger une imitation malveillante. Une entreprise
peut ainsi compromettre son système avant même d'avoir lancé la moindre inférence.

---

### RISQUE N°9 — Les attaques d'évasion et les exemples adversariaux

```yaml
id: AIGMS-RISK-IA-09
slug: attaques-evasion-exemples-adversariaux
nom: "Attaques d'évasion et exemples adversariaux"
page_source: [46, 47]
categorie: manipulation_entrees
cible: [modele_classification, reconnaissance_faciale, detection_fraude, analyse_documents, detection_malware, controle_acces, vehicule_autonome]
phase_cycle_de_vie: [inference]
vecteur: [modification_subtile_entree, autocollants_physiques, perturbations_imperceptibles]
technique_citee:
  - nom: "Fast Gradient Sign Method (FGSM)"
    famille: methodes_basees_sur_le_gradient
    principe: "Déplacer l'entrée au-delà de la frontière de décision du modèle tout en conservant une apparence normale pour un observateur humain."
principe_technique: "Exploite le fait que les modèles reposent sur des motifs statistiques et non sur une compréhension réelle du sens."
impact: [mauvaise_classification, contournement_reconnaissance_faciale, contournement_detection_fraude, contournement_detection_malware, contournement_controle_acces, non_reconnaissance_panneau_signalisation]
exemple_source: "Véhicule autonome : de petits autocollants placés sur un panneau peuvent suffire à empêcher sa reconnaissance."
# ── champs dérivés (NON issus de l'article) ──
derive_owasp_llm: "LLM01 / hors périmètre LLM strict — s'applique surtout aux modèles de vision et de classification"
derive_nist_ai_100_2: "Evasion attacks (white-box / black-box)"
derive_mitre_atlas_tactique: "Defense Evasion, Impact"
derive_ai_act: "Art. 15 (exactitude, robustesse), Annexe III si usage à haut risque"
derive_criticite: elevee
derive_detectabilite: faible
```

Les attaques d'évasion consistent à modifier subtilement les données d'entrée afin de
provoquer une mauvaise classification. **Les modifications sont souvent imperceptibles pour
un humain.** Dans le cas d'un véhicule autonome, de petits autocollants placés sur un
panneau peuvent suffire à empêcher sa reconnaissance.

Dans une entreprise, ces attaques peuvent notamment être utilisées pour contourner des
systèmes de reconnaissance faciale, de détection de fraude, d'analyse de documents, de
détection de logiciels malveillants ou encore de contrôle d'accès.

Les attaquants utilisent souvent des méthodes basées sur le gradient, comme la **Fast
Gradient Sign Method**. Ces techniques déplacent l'entrée au-delà de la frontière de
décision du modèle tout en conservant une apparence normale pour un observateur humain.
Elles exploitent le fait que **les modèles reposent sur des motifs statistiques et non sur
une compréhension réelle du sens**.

---

### RISQUE N°10 — Les deepfakes et l'usurpation d'identité

```yaml
id: AIGMS-RISK-IA-10
slug: deepfakes-usurpation-identite
nom: "Deepfakes et usurpation d'identité"
page_source: 47
source_complete: false
note_completude: "Le texte source s'interrompt sur « Elles contournent » (bas de page 47). La fin de section est une reconstitution proposée, marquée [PROPOSITION]."
categorie: fraude_identite
cible: [collaborateurs, dirigeants, processus_validation, controles_biometriques]
phase_cycle_de_vie: [exploitation, usage_externe]
vecteur: [audio_synthetique, video_synthetique, images_artificielles, voix_clonees, enregistrement_public_de_quelques_secondes]
impact: [virement_frauduleux, vol_mot_de_passe, obtention_document_confidentiel, acces_compte, modification_procedure_interne]
principe_technique: "Exploitation de la confiance naturelle accordée aux images et aux sons."
tendance: "De plus en plus utilisées contre les entreprises."
# ── champs dérivés (NON issus de l'article) ──
derive_owasp_llm: "LLM09 - Misinformation (usage offensif de l'IA générative)"
derive_mitre_atlas_tactique: "Initial Access (social engineering), Impact"
derive_ai_act: "Art. 50 (obligations de transparence / marquage des contenus générés)"
derive_criticite: critique
derive_detectabilite: faible
```

Les deepfakes utilisent l'intelligence artificielle générative pour produire des contenus
synthétiques très réalistes, qu'il s'agisse d'enregistrements audio, de vidéos, d'images,
de visages artificiels ou encore de voix clonées. Ces attaques sont de plus en plus
utilisées contre les entreprises.

Un fraudeur peut, par exemple, se faire passer pour un dirigeant afin d'obtenir un
virement, un mot de passe, un document confidentiel, l'accès à un compte ou encore la
modification d'une procédure interne.

**Il suffit parfois de quelques secondes d'enregistrement public pour reproduire une voix
ou un visage de manière crédible.** Ces attaques exploitent la confiance naturelle accordée
aux images et aux sons. Elles contournent…

> **[PROPOSITION — hors source, à valider contre la page 48]**
> …*les contrôles fondés sur la reconnaissance vocale ou faciale et, plus largement, les
> validations reposant sur la confiance interpersonnelle plutôt que sur une vérification
> formelle. La parade n'est donc pas principalement technique : elle repose sur des
> procédures de contre-vérification hors bande (rappel sur un numéro connu, double
> validation humaine pour tout ordre de paiement ou changement de coordonnées bancaires)
> et sur la sensibilisation des équipes exposées — direction, finance, RH, support.*

---

## 3. Encadré — Conformité et normes de sécurité de l'IA à connaître

```yaml
bloc: conformite
page_source: 47
type: encadre
```

À mesure que les risques augmentent et que davantage de données sont utilisées par les
systèmes d'IA, de nouvelles réglementations et normes apparaissent pour encadrer leur
utilisation.

### 3.1 Le Règlement général sur la protection des données (RGPD)

```yaml
id: AIGMS-CONF-01
nom: RGPD
juridiction: union_europeenne
entree_en_application: 2018
url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=FR"
```

Entré en application en 2018, le Règlement général sur la protection des données, ou RGPD,
encadre le traitement des données personnelles dans l'Union européenne. Il garantit
notamment aux citoyens le droit de savoir quelles données sont collectées, comment elles
sont utilisées, combien de temps elles sont conservées, avec qui elles sont partagées et de
quelle manière ils peuvent exercer un contrôle sur leur utilisation.

Les données de citoyens européens utilisées dans des projets d'intelligence artificielle
doivent donc respecter ces exigences. Cela implique notamment de mettre en place :

- des mesures d'anonymisation ;
- une gouvernance rigoureuse des données ;
- une définition précise des finalités de traitement ;
- une limitation de la collecte ;
- une information claire des utilisateurs ;
- des dispositifs adaptés pour sécuriser les traitements.

### 3.2 L'AI Act européen

```yaml
id: AIGMS-CONF-02
nom: "AI Act"
juridiction: union_europeenne
entree_en_vigueur: 2024-08
url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=FR"
```

Entré en vigueur en août 2024, l'AI Act encadre l'utilisation de l'intelligence artificielle
dans l'Union européenne selon plusieurs niveaux de risque, **du minimal à l'inacceptable**.
Il impose notamment des obligations de transparence pour les systèmes d'IA à usage général
et renforce les exigences applicables aux systèmes à haut risque, avec des règles portant
sur la gouvernance des données, la documentation, les contrôles, la qualité et la
supervision humaine.

### 3.3 La Securities and Exchange Commission américaine (SEC)

```yaml
id: AIGMS-CONF-03
nom: "SEC — équipe dédiée à l'IA"
juridiction: etats_unis
date: 2025
url: "https://www.sec.gov/newsroom/press-releases/2025-103-sec-creates-task-force-tap-artificial-intelligence-enhanced-innovation-efficiency-across-agency"
```

Aux États-Unis, la Securities and Exchange Commission, ou SEC, a mis en place en 2025 une
équipe dédiée à l'intelligence artificielle. Cette initiative vise à encourager une
utilisation responsable de l'IA, à réduire certains freins à son adoption, à mieux
coordonner les efforts internes dans ce domaine et à évaluer les bénéfices comme les risques
associés à ces technologies. Son action concerne principalement l'utilisation de
l'intelligence artificielle au sein de la SEC elle-même, afin d'encadrer son intégration
dans les activités et les processus de l'institution.

### 3.4 Les lois adoptées par les États américains

```yaml
id: AIGMS-CONF-04
nom: "Lois des États américains"
juridiction: etats_unis_etats_federes
etats_cites: [Californie, Colorado, Texas]
```

Plusieurs États américains, parmi lesquels la Californie, le Colorado et le Texas, ont
adopté des lois visant à encadrer certains usages de l'intelligence artificielle. Leur
portée varie selon les juridictions :

- **Californie** — impose notamment des règles de transparence pour certains contenus
  générés par IA et les chatbots ;
- **Colorado** — encadre l'utilisation de systèmes automatisés dans certaines décisions
  importantes ;
- **Texas** — a renforcé la lutte contre certains deepfakes non autorisés.

Plus largement, ces législations cherchent à améliorer la transparence des systèmes d'IA, à
limiter certains usages abusifs et à renforcer la protection des consommateurs.

### 3.5 Le guide ANSSI

```yaml
id: AIGMS-CONF-05
nom: "Recommandations de sécurité pour un système d'IA générative — ANSSI"
juridiction: france
url: "https://messervices.cyber.gouv.fr/guides/recommandations-de-securite-pour-un-systeme-dia-generative"
```

À noter : l'**ANSSI** a publié un guide consacré à la sécurité des systèmes d'IA générative
visant à sensibiliser administrations et entreprises aux risques associés et à promouvoir de
bonnes pratiques, depuis la conception et l'entraînement des modèles jusqu'à leur
déploiement en production. Il se concentre sur la sécurité des architectures, **sans traiter
en détail les questions de performance métier, d'éthique, de vie privée ou de protection des
données personnelles**.

---

## 4. [PROPOSITION] Bonnes pratiques à adopter

> ⚠️ **Cette section entière n'est PAS issue des images fournies.** L'article annonce des
> « bonnes pratiques à adopter » dans son chapô, mais elles figurent sur la page 48, non
> photographiée. Ce qui suit est une proposition dérivée, construite à partir des éléments
> de remédiation déjà présents dans la section « Périmètre de la sécurité de l'IA » (p.44)
> et des référentiels cités par l'article (NIST, ISO, OWASP, MITRE, ANSSI).
> **À remplacer par le texte réel dès que la page 48 sera disponible.**

```yaml
bloc: bonnes_pratiques
statut: proposition_derivee
source: hors_article
a_remplacer: true
```

### 4.1 Gouvernance et organisation

| ID | Pratique | Risques couverts |
|----|----------|------------------|
| BP-01 | Tenir un inventaire des systèmes d'IA, des modèles, des jeux de données et des agents en production (AI-BOM) | 02, 05, 08 |
| BP-02 | Classer chaque système d'IA par niveau de risque (aligné AI Act) et définir des exigences internes de sécurité par niveau | tous |
| BP-03 | Faire collaborer explicitement équipes techniques, métiers, juridiques et conformité | tous |
| BP-04 | Adosser la démarche à un framework reconnu (NIST AI RMF, ISO/IEC 42001, OWASP LLM Top 10, MITRE ATLAS) | tous |

### 4.2 Données et entraînement

| ID | Pratique | Risques couverts |
|----|----------|------------------|
| BP-05 | Contrôler la qualité et la provenance des données d'entraînement, de fine-tuning et des corpus RAG | 02 |
| BP-06 | Valider et versionner les jeux de données ; tracer toute modification | 02 |
| BP-07 | Anonymiser / minimiser les données personnelles ; envisager la confidentialité différentielle | 03, 04 |
| BP-08 | Tester la présence de portes dérobées et de déclencheurs après chaque réentraînement | 02 |

### 4.3 Modèles et inférence

| ID | Pratique | Risques couverts |
|----|----------|------------------|
| BP-09 | Limiter l'exposition des scores de confiance et des probabilités dans les réponses d'API | 03, 04 |
| BP-10 | Appliquer quotas, limitation de débit et détection d'usage anormal sur les API de modèles | 03, 04, 05 |
| BP-11 | Protéger et faire tourner les clés d'API ; surveiller la consommation (anti-LLMjacking) | 05 |
| BP-12 | Évaluer régulièrement le comportement des modèles en conditions réelles, y compris par red teaming adversarial | 01, 02, 09 |
| BP-13 | Tester la robustesse aux exemples adversariaux (FGSM et variantes) sur les modèles de classification critiques | 09 |

### 4.4 Agents et architectures multiagents

| ID | Pratique | Risques couverts |
|----|----------|------------------|
| BP-14 | Séparer strictement instructions système et données non fiables ; ne jamais traiter un contenu récupéré comme une instruction | 01 |
| BP-15 | Appliquer le moindre privilège aux outils appelables par un agent ; lister explicitement les actions autorisées | 01, 06, 07 |
| BP-16 | Exiger une validation humaine pour toute action irréversible ou financière (paiement, changement de RIB, suppression) | 01, 06, 07, 10 |
| BP-17 | Journaliser intégralement les appels d'outils, les décisions et les écritures en mémoire persistante | 06, 07 |
| BP-18 | Expirer et faire réviser la mémoire persistante des agents ; interdire la mémorisation de règles métier sans validation | 06 |
| BP-19 | Ne pas accorder de confiance implicite aux sorties d'un agent interne : valider entre agents comme on validerait une source externe | 07 |
| BP-20 | Prévoir un coupe-circuit permettant d'arrêter une chaîne d'agents en cours d'exécution | 07 |

### 4.5 Chaîne d'approvisionnement

| ID | Pratique | Risques couverts |
|----|----------|------------------|
| BP-21 | N'utiliser que des modèles et bibliothèques issus de fournisseurs et dépôts fiables, avec vérification de signature | 08 |
| BP-22 | Interdire les formats de poids exécutables (pickle) au profit de formats sûrs (safetensors) | 08 |
| BP-23 | Scanner modèles, dépendances et scripts d'installation avant chargement ; charger en environnement isolé | 08 |
| BP-24 | Vérifier les noms exacts de paquets et de modèles (risque de confusion / typosquatting) | 08 |

### 4.6 Détection, réponse et facteur humain

| ID | Pratique | Risques couverts |
|----|----------|------------------|
| BP-25 | Surveiller en continu entrées et sorties : filtrage des caractères Unicode invisibles, normalisation des documents et images ingérés | 01 |
| BP-26 | Intégrer les incidents IA au processus de réponse à incident existant (playbooks dédiés) | tous |
| BP-27 | Mettre en place une contre-vérification hors bande pour toute demande sensible reçue par voix ou vidéo | 10 |
| BP-28 | Sensibiliser direction, finance, RH et support aux deepfakes et à l'ingénierie sociale assistée par IA | 10 |
| BP-29 | Maintenir une supervision humaine effective sur les décisions critiques | tous |

---

## 5. Annexe — Index de classification rapide

```yaml
index:
  - {id: AIGMS-RISK-IA-01, nom: "Injections de prompt multimodales et indirectes", categorie: manipulation_entrees, derive_criticite: critique}
  - {id: AIGMS-RISK-IA-02, nom: "Empoisonnement des données et des modèles", categorie: integrite_donnees_modele, derive_criticite: critique}
  - {id: AIGMS-RISK-IA-03, nom: "Inversion de modèle et reconstruction de données", categorie: confidentialite_donnees, derive_criticite: elevee}
  - {id: AIGMS-RISK-IA-04, nom: "Attaques par inférence d'appartenance", categorie: confidentialite_donnees, derive_criticite: elevee}
  - {id: AIGMS-RISK-IA-05, nom: "Vol et extraction de modèles", categorie: propriete_intellectuelle, derive_criticite: elevee}
  - {id: AIGMS-RISK-IA-06, nom: "Empoisonnement de la mémoire", categorie: persistance_agent, derive_criticite: critique}
  - {id: AIGMS-RISK-IA-07, nom: "Défaillances en cascade dans les systèmes multiagents", categorie: architecture_multiagent, derive_criticite: critique}
  - {id: AIGMS-RISK-IA-08, nom: "Compromission de la chaîne d'approvisionnement de l'IA", categorie: supply_chain, derive_criticite: critique}
  - {id: AIGMS-RISK-IA-09, nom: "Attaques d'évasion et exemples adversariaux", categorie: manipulation_entrees, derive_criticite: elevee}
  - {id: AIGMS-RISK-IA-10, nom: "Deepfakes et usurpation d'identité", categorie: fraude_identite, derive_criticite: critique}

conformite_index:
  - {id: AIGMS-CONF-01, nom: RGPD, juridiction: ue, date: 2018}
  - {id: AIGMS-CONF-02, nom: "AI Act", juridiction: ue, date: 2024-08}
  - {id: AIGMS-CONF-03, nom: "SEC AI Task Force", juridiction: us, date: 2025}
  - {id: AIGMS-CONF-04, nom: "Lois États américains", juridiction: us_etats, etats: [Californie, Colorado, Texas]}
  - {id: AIGMS-CONF-05, nom: "Guide ANSSI IA générative", juridiction: fr}
```

### Avertissement sur les champs dérivés

Tous les champs préfixés `derive_` (mappings OWASP LLM Top 10, NIST AI 100-2, MITRE ATLAS,
articles de l'AI Act, criticité, détectabilité) **ne figurent pas dans l'article source**.
Ce sont des correspondances proposées pour faciliter la classification dans AIGMS. Les
identifiants de techniques MITRE ATLAS ont volontairement été remplacés par des noms de
tactiques plutôt que des codes, afin d'éviter toute référence erronée — à compléter avec les
codes exacts depuis `atlas.mitre.org` avant intégration en base.

De même, la **section 4 (bonnes pratiques)** et la **fin du risque 10** sont des propositions
à remplacer par le texte réel de la page 48.
