# AIGMS — contenu de la page de présentation

**Export du 10 septembre 2026.** Destiné à la création d'une page dédiée sur
https://caritis.fr. Ce fichier remplace la page d'accueil de l'application, qui
devient un écran de connexion : AIGMS est désormais une application SaaS, la
vitrine vit sur le site commercial.

Les chiffres cités portent leur source. **Aucune formulation n'affirme
qu'AIGMS certifie ou garantit la conformité** : c'est une exigence produit, pas
une prudence rédactionnelle. Merci de la conserver lors de la reprise.

---

## En-tête

> **AI Governance Management System**
>
> # Gouverner l'IA. Décider. Prouver. Améliorer.
>
> Le registre unique des usages d'IA de votre organisation : leurs risques, les
> décisions qui les autorisent, les contrôles qui les encadrent, et les preuves
> qui le démontrent.

**Appel à l'action** — « Commençons par 2 cas d'usage réels » · Atelier de
qualification, 45 minutes.

**Cible** — Pour les PME et ETI, et pour les cabinets, MSP et intégrateurs qui
gouvernent l'IA de leurs clients.

### Illustration : une fiche de décision

Encart visuel accompagnant l'en-tête. Il montre la pièce que l'outil produit.

| Champ | Contenu |
|---|---|
| Référence | DEC-IA-2026-0042 |
| Statut | Approuvé sous conditions |
| Objet | Mise en production de l'assistant IA du support client |
| Conditions | Validation humaine maintenue avant envoi. Revue hebdomadaire d'échantillon pendant trois mois. |
| Approbateur | RSSI |
| Revue | Dans 6 mois |
| Éléments liés | RSK-2026-0001 · AIIA-2026-0001 · CTL-02 · EVD-2026-0002 |

---

## Le constat

> « Le problème n'est plus d'autoriser ou non ChatGPT. Le problème est de
> gouverner un portefeuille d'usages IA qui évolue chaque semaine. »

Copilotes, modèles SaaS, agents, API : les usages se multiplient plus vite que
les règles internes. Le risque n'est pas l'outil, c'est l'absence de trace de
qui a décidé quoi.

### Graphique — Part des salariés utilisant des outils d'IA non approuvés

*Source : enquête Okta, « AI Agents at Work », 2026.*

| Population | Part |
|---|---|
| Ensemble des pays étudiés | 52 % |
| France | 31 % |
| Ont transmis des informations professionnelles sensibles à un outil d'IA sans autorisation | 38 % |

### Chiffre d'appui — adoption de l'IA dans les TPE et PME françaises

*Source : Bpifrance Le Lab et France Num.*

| Année | Part utilisant au moins une solution d'IA |
|---|---|
| 2024 | 13 % |
| 2026 | 26 % |

---

## Le test — six questions auxquelles un dirigeant doit pouvoir répondre

Si l'une reste sans réponse documentée, la gouvernance de l'IA n'existe pas
encore dans votre organisation.

| # | Question | Ce qu'AIGMS y répond |
|---|---|---|
| 01 | Quelles IA utilisons-nous ? | Cas d'usage, systèmes, modèles, agents, jeux de données et fournisseurs, dans un registre unique. |
| 02 | Qui en est responsable ? | Un propriétaire opérationnel et un responsable redevable nommés pour chaque usage. |
| 03 | Quelles données utilisent-elles ? | Nature des données, personnes concernées, articulation avec l'analyse d'impact RGPD. |
| 04 | Quels risques avons-nous acceptés ? | Chaque acceptation porte un responsable humain, une justification et une date de revue. |
| 05 | Qui a autorisé la mise en production ? | Une décision datée, motivée, conditionnée, reliée aux risques et aux contrôles. |
| 06 | Pouvons-nous le prouver ? | Des preuves avec propriétaire, date de validité et statut de fraîcheur, rattachées aux contrôles. |

---

## La méthode — un cycle de management, pas une bibliothèque de registres

Chaque étape a une entrée, un responsable, un statut, des critères de sortie,
des preuves attendues et une échéance. Un changement significatif rouvre
l'évaluation.

| Phase | Étape | Contenu |
|---|---|---|
| **PLAN** | Discovery & Assess | Recenser les usages, les qualifier, pré-classifier au regard des textes, coter les risques, mesurer les impacts. |
| **DO** | Build & Connect | Affecter les contrôles, documenter la supervision humaine, rassembler les preuves, instruire les décisions. |
| **CHECK + ACT** | Operate | Suivre les revues dues, les preuves qui expirent, les actions échues, les incidents et les décisions à prendre. |
| **BOUCLE** | Re-assess | Un modèle change, l'autonomie augmente, la finalité évolue : le moteur qualifie le changement et rouvre ce qui doit l'être. |

### Le cycle de vie d'un cas d'usage, avec ses points de passage obligés

Intake → Triage → Évaluation → Revue → Pilote → **Production** → Surveillance →
Changement ou retrait

> **Le passage en production est refusé côté serveur** tant que les
> préconditions ne sont pas réunies : classification aboutie, risques traités ou
> acceptés, évaluation d'impact terminée, revue fournisseur close, supervision
> humaine approuvée, contrôles obligatoires statués, décision d'autorisation en
> vigueur, actions bloquantes soldées. Le refus est motivé, précondition par
> précondition, et journalisé au même titre qu'une autorisation.

---

## Le différenciateur — le registre de décisions

Une gouvernance crédible ne documente pas seulement les risques. Elle documente
*qui a décidé quoi, pourquoi et sous quelles conditions.*

C'est la pièce que les autres outils traitent en dernier, et celle qu'un
auditeur ouvre en premier. Autorisation d'usage, mise en production, acceptation
de risque, exception, suspension, retrait : chaque type de décision a son
dossier.

- **Aucune approbation automatique.** Une décision engageante exige un
  approbateur humain, une justification et une date d'effet.
- **Séparation des rôles.** L'auteur d'une décision de mise en production ou
  d'acceptation de risque ne peut pas l'approuver lui-même.
- **Rien ne dort.** Acceptations de risque et exceptions portent une date de
  revue : le tableau de bord les fait remonter à l'échéance.
- **Reconstituable.** Chaque décision est rattachée aux risques, contrôles et
  preuves sur lesquels elle s'appuie.

### Encart — un contrôle, plusieurs référentiels

Le même contrôle répond à plusieurs exigences. La preuve est collectée une fois,
le plan d'action est unique.

**CTL-02 — Supervision humaine documentée** répond à :

| Référentiel | Exigence |
|---|---|
| ISO/IEC 42001 | Système de management de l'IA |
| Règlement (UE) 2024/1689 | Contrôle humain, article 14 |
| ISO/IEC 27001 | Sécurité de l'information |
| RGPD | Analyse d'impact, article 35 |

> AIGMS conserve des références, des résumés internes et des exigences dérivées,
> versionnés et datés. Il ne reproduit pas le texte des normes et ne délivre
> aucune certification.

---

## Écosystème — AIGMS ne remplace pas vos outils, il les fait converger

Les plateformes spécialisées restent les meilleures sources techniques de
contrôle et de preuve. Ce qui manque, c'est la couche où l'on décide, où l'on
tranche, et où l'on garde la trace. C'est celle-là qu'AIGMS occupe.

**AIGMS — la couche de décision et de preuve.** Registre des usages, risques,
impacts, supervision, décisions, contrôles, preuves, incidents, actions.
*Cas d'usage · Risques · Décisions · Contrôles · Preuves*

### Ce que chacun fait le mieux

| Outil | Rôle |
|---|---|
| Vanta | Automatisation de la collecte de preuves et de la conformité |
| OneTrust | Gouvernance IA d'entreprise et contrôles à l'exécution |
| ServiceNow | Tour de contrôle IA, CMDB et workflows d'entreprise |
| Microsoft Purview | Sécurité des données, classification et prévention des fuites |
| **AIGMS** | Le poste de pilotage de l'AI Governance Officer, pour une PME/ETI comme pour un cabinet suivant plusieurs organisations |

> Les connecteurs sont conçus en lecture seule et à moindre privilège : AIGMS lit
> des métadonnées, des statuts et des preuves. Il ne prend pas la main sur vos
> systèmes.

---

## Le calendrier — les échéances bougent, votre registre doit suivre

Le report des obligations « haut risque » en est la démonstration : une date
d'application n'est pas une constante. AIGMS conserve les référentiels sous
forme de données versionnées et datées — jamais de dates inscrites en dur dans
un écran.

### Frise — règlement (UE) 2024/1689 sur l'IA et règlement (UE) 2024/2847 sur la cyber-résilience

| Date | Objet | État |
|---|---|---|
| 2 février 2025 | Pratiques interdites et obligations de littératie en IA. | Applicable |
| 2 août 2026 | Application générale du règlement sur l'IA, y compris le régime de sanctions et les obligations de transparence. | Applicable |
| 11 septembre 2026 | Cyber-résilience : obligations de signalement des vulnérabilités activement exploitées. | Applicable |
| 2 décembre 2027 | Systèmes à haut risque de l'annexe III. Échéance reportée de seize mois par le règlement (UE) 2026/1744. | À venir |
| 11 décembre 2027 | Cyber-résilience : obligations principales et marquage CE intégrant la cybersécurité. | À venir |

### Graphique — plafonds de sanction prévus par le règlement sur l'IA

*Article 99 — le montant retenu est le plus élevé des deux.*

| Manquement | Plafond | Part relative (pour la barre) |
|---|---|---|
| Pratiques interdites | 35 M€ ou 7 % du chiffre d'affaires mondial | 100 % |
| Manquements aux obligations, dont haut risque et modèles à usage général | 15 M€ ou 3 % | 43 % |
| Informations inexactes fournies aux autorités | 7,5 M€ ou 1 % | 21 % |

> Pour les PME et les jeunes entreprises, chaque plafond est ramené au plus
> faible des deux montants.

### Encart — règlement sur la cyber-résilience

Produits comportant des éléments numériques.

**15 M€** ou 2,5 % du chiffre d'affaires mondial.

Exigences essentielles de cybersécurité, traitement des vulnérabilités,
documentation technique et évaluation de la conformité.

> Un système d'IA intégré à un produit connecté relève des deux régimes. Un
> contrôle bien construit sert les deux.

---

## Appel à l'action

> # Commençons par deux cas d'usage réels.
>
> Quarante-cinq minutes suffisent pour voir ce que donne votre portefeuille IA
> passé au filtre d'une gouvernance opérationnelle.

**Bouton** — « Demander l'atelier de qualification »

### Ce que vous repartez avec

1. Deux usages IA identifiés et cadrés
2. Leur pré-classification réglementaire, et ce qu'elle implique
3. Une première carte des risques
4. Une démonstration d'AIGMS sur vos propres cas

---

## Notes de reprise

- **Le formulaire de contact n'est pas exporté.** Il est repris par le
  formulaire du site commercial. L'application ne collecte plus de demande
  entrante.
- **Navigation d'origine** (à réimplanter selon l'arborescence de caritis.fr) :
  Le constat · La méthode · Registre de décisions · Écosystème · Calendrier.
- **Trois graphiques** à reconstruire : barres horizontales pour les usages non
  approuvés, frise à cinq jalons pour le calendrier, barres proportionnelles
  pour les plafonds de sanction. Les valeurs sont dans les tableaux ci-dessus.
- **Palette d'origine** : bleu nuit sur fond clair, accents bleu-vert réservés
  aux repères de données. Titres en serif, corps en sans-serif.
- **Précaution à conserver** : ne jamais affirmer que l'outil certifie ou
  garantit la conformité, et ne pas reproduire le texte des normes.
