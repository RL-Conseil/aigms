# ADR-0028 — Les fonctions s'exécutent à Dublin, avec la base

*23 septembre 2026. `vercel.json`.*

## Contexte

La navigation dans l'espace de gouvernance était lente, d'une lenteur diffuse :
pas un temps de chargement franc, une latence qui s'installe. L'audit du
23 septembre 2026 a cherché la cause dans le code et l'a trouvée dans la
topologie.

| | Valeur |
|---|---|
| Région des fonctions Vercel | `iad1` — Washington, Virginie |
| Région Supabase, préprod et production | `eu-west-1` — Dublin |

Chaque lecture traversait donc l'Atlantique deux fois. Le coût ne se voit dans
aucun fichier : il se lit dans la configuration du projet d'hébergement, que
personne n'avait posée — `iad1` est le défaut de Vercel.

Il se multiplie par le nombre de **vagues séquentielles** d'une page, pas par
le nombre de requêtes : les requêtes indépendantes partent déjà ensemble. La
fiche d'un cas d'usage en compte une seizaine, dont six pour la seule barre de
navigation, soit de l'ordre de 1,3 seconde de réseau pur avant tout rendu.

## Décision

**Les fonctions s'exécutent à `dub1` — Dublin**, la même région AWS que le
projet Supabase.

Le choix se joue entre deux villes :

- **`dub1` (Dublin)** — les allers-retours vers la base tombent à quelques
  millisecondes ; l'unique aller-retour navigateur → fonction gagne une
  quinzaine de millisecondes depuis la France.
- **`cdg1` (Paris)** — l'inverse : l'aller-retour utilisateur est minimal, mais
  chacune des dix à vingt lectures d'une page paie la traversée de la Manche.

Une navigation fait **un** aller-retour utilisateur et **une dizaine** de
lectures. `dub1` gagne tant que ces lectures ne sont pas consolidées ; le jour
où elles le seraient, la question mériterait d'être reposée.

## Où ce réglage vit, et pourquoi pas dans le dépôt

`"regions"` dans `vercel.json` **n'a aucun effet** : Fluid Compute est actif sur
ce projet, et la région y est un réglage de projet, `resourceConfig.functionDefaultRegions`.
Nous l'avons vérifié — un déploiement portant `"regions": ["dub1"]` dans
`vercel.json` rapportait toujours `iad1`. Laisser dans le dépôt une clé inerte
serait un piège pour la prochaine personne : elle a donc été retirée.

Le réglage se pose, et se vérifie, par l'API :

```js
// PATCH — poser la région
fetch(`https://api.vercel.com/v9/projects/aigms?teamId=${TEAM}`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ resourceConfig: { functionDefaultRegions: ['dub1'] } }),
})

// GET — le déploiement rapporte sa région dans `regions`
fetch(`https://api.vercel.com/v13/deployments/${id}?teamId=${TEAM}`, …)
```

C'est le premier réglage d'infrastructure qui ne vit pas dans le dépôt. Il
compte parmi les arguments du dossier `HEBERGEMENT_VPS_V1.md` : sur un VPS, la
région est l'adresse du serveur, et elle ne peut pas diverger en silence.

## Conséquences

- Aucune ligne de code applicatif ne change, et la décision se défait en une
  requête.
- Les données restent dans l'Union européenne, ce qu'elles ne faisaient pas
  entièrement : le traitement se faisait aux États-Unis. C'est un gain de
  conformité autant que de vitesse, et il vaut d'être dit au registre des
  traitements.
- Le réglage étant porté par le projet, la **production le prendra à son
  prochain déploiement**. Le déploiement de production en cours reste à `iad1`
  jusque-là. Rien n'est promu : la promotion demeure la décision du
  propriétaire.
- Cela ne corrige **pas** les six autres causes relevées par l'audit — absence
  de `layout.tsx` sous `/admin`, six vagues séquentielles dans la coquille,
  aucun `loading.tsx`, `getUser()` appelé deux fois par navigation, une
  écriture pendant un rendu GET, deux N+1. Elles restent au plan, et n'ont
  d'intérêt qu'une fois ce plancher posé.
