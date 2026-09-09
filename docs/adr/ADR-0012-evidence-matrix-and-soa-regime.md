# ADR-0012 — La preuve attendue dépend du rôle exercé vis-à-vis de l'IA

Date : 9 septembre 2026 · Statut : accepté

## Contexte

Le registre des preuves (ADR-0011) proposait les mêmes typologies à tout le
monde. C'est faux dans les deux sens : un hébergeur doit démontrer l'isolation
de ses calculs et son empreinte énergétique, et n'a rien à dire sur l'équité
d'un modèle qu'il n'entraîne pas ; un utilisateur métier répond de la dérive du
système qu'il exploite, pas de son alignement.

La Déclaration d'Applicabilité souffrait du même défaut, en plus grave : elle
listait la couverture sans jamais exiger de **décision**. Or ISO/IEC 42001 ne
demande pas une liste, elle demande une position — sélectionné ou exclu — et sa
justification. Une exigence laissée sans réponse est le premier défaut qu'un
auditeur relève, et le seul qui ne se rattrape pas par un argument.

## Décision

**Le profil d'activité est une donnée de l'organisation, posée à sa création.**
Quatre valeurs : hébergeur / infrastructure, développeur / éditeur,
intégrateur / conseil, utilisateur métier. La colonne reste **nullable** : une
organisation créée avant cette décision n'a pas de profil, et l'écran le dit
plutôt que d'en supposer un.

**La matrice est une donnée, pas du code.** Huit typologies × quatre profils,
dans `knowledge/frameworks/aigms/evidence-matrix/v1/` ; la migration en est
**générée** (`scripts/generate-evidence-matrix.mjs`) et un test compare la base
au fichier à chaque exécution. Les résumés techniques sont rédigés en propre et
portent `review_status = 'to_review'`, comme l'Annexe A d'ISO 42001 : une
interprétation engage vis-à-vis d'un client.

**De la criticité découle le régime de preuve exigé par la Déclaration :**

| Criticité pour le profil | Statut attendu | Ce que la Déclaration exige |
|---|---|---|
| critique, élevé | sélectionné | preuve **technique** : décrire la mesure et pointer un livrable concret |
| modéré, faible | sélectionné | preuve **organisationnelle** : politique, clause contractuelle, procédure |
| négligeable | exclu | **justification formelle d'exclusion**, motivée par le profil d'activité |

**La règle d'or est portée par une contrainte, pas par un écran.**
`soa_decision.justification` est `not null` et non vide, sur les deux branches.
Une exigence sans décision ressort avec l'écart `undecided` ; une exclusion là
où la matrice attend une preuve ressort avec `exclusion_contested`.

**Les références que le référentiel chargé ne porte pas sont nommées.** La
matrice cite onze articles absents de la base — l'Annexe A chargée s'arrête à
A.10.4, et seuls les articles 14 et 50 du règlement sont chargés.
`app.evidence_matrix_gaps()` les liste, l'écran les affiche, et un test vérifie
que la liste correspond exactement à ce que le fichier source déclare.

## Conséquences

- La Déclaration d'Applicabilité **ne sort plus du périmètre du tenant**. Elle
  listait auparavant les exigences à tout venant, au motif que le référentiel
  est public ; elle porte désormais les justifications d'inclusion et
  d'exclusion du client, et se tait ailleurs. Le catalogue normatif reste
  lisible pour lui-même par `public.requirement`.
- Une décision se prend **en son propre nom** (`app.guard_soa_decision`), comme
  une validation de preuve. Elle est journalisée.
- Une justification de moins de trente caractères est refusée. Ce n'est pas de
  la coquetterie : « non applicable » n'est pas une justification, et c'est
  précisément la ligne qu'un auditeur ouvre en premier.
- Le même modèle change de lecture avec le profil : sur A.10.2, un intégrateur
  doit une preuve technique là où un hébergeur produit une exclusion motivée.
  Un test le vérifie sur la même exigence, en changeant le seul profil.
- La matrice **ne décide de rien**. Elle dit ce qui est attendu ; c'est un
  humain qui sélectionne ou exclut, et il peut contredire la matrice — l'écart
  est alors affiché, pas effacé.

## Alternatives écartées

- **Déduire le profil du secteur d'activité.** Un « éditeur de logiciel » peut
  n'être qu'utilisateur d'IA. La déduction produirait des exigences fausses avec
  l'assurance du calcul.
- **Rendre le profil obligatoire sur les organisations existantes.** Aurait
  supposé une valeur par défaut, c'est-à-dire affirmé un rôle que personne n'a
  déclaré.
- **Exiger un lien vers une preuve pour enregistrer une décision.** La décision
  précède normalement la preuve : la bloquer empêcherait de tracer l'étape que
  la gouvernance doit justement tracer. La table enregistre le fait, la fonction
  rend le verdict.
- **Rapprocher approximativement les références absentes.** Faire pointer
  A.10.5 vers A.10.4 « parce que c'est proche » produirait une Déclaration qui
  paraît complète en étant fausse.

## Point ouvert

`A.8.4` se résout, mais porte dans l'Annexe A chargée la **communication des
incidents**, là où la matrice l'invoque pour l'empreinte environnementale. Le
rapprochement est actif et signalé comme à relire dans le fichier source
(`reference_warnings`). Il demande un arbitrage humain.
