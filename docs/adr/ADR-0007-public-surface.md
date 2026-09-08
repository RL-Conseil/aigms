# ADR-0007 — Une seule table accepte l'écriture anonyme

Date : 8 septembre 2026 · Statut : accepté

## Contexte

La migration `0005` pose une règle nette : `anon` ne dispose d'aucun droit.
AIGMS n'avait alors aucune surface publique — toute page exigeait une session.

L'ajout d'une page publique et de son formulaire de rappel contredit cette
règle : un visiteur sans compte doit pouvoir écrire quelque part.

Trois options se présentaient : router l'écriture par une route serveur
utilisant la clé `service_role` ; passer par un service tiers de formulaire ;
ou ouvrir une écriture anonyme strictement bornée.

## Décision

Une seule table, `contact_request`, accepte l'insertion anonyme.

L'exception est bornée sur quatre axes :

1. **Insertion seule.** `grant insert` à `anon`, rien d'autre. Il ne peut pas
   relire ce que d'autres ont déposé, ni modifier, ni effacer.
2. **Une ligne neuve, toujours.** La clause `WITH CHECK` impose `status = 'new'`,
   aucun champ de traitement renseigné, et un jour de dépôt égal à la date du
   jour — un automate ne peut pas déposer une demande déjà marquée archivée,
   invisible au suivi.
3. **Aucune donnée de gouvernance.** La table ne porte pas de `tenant_id` : une
   demande entrante n'appartient à aucun client. Sa lecture est réservée à
   `app.is_platform_admin()`.
4. **Types dans `public`.** Ses deux énumérés sont définis dans `public` et non
   dans `app`, contrairement à tout le reste du produit. Référencer un type de
   `app` exige `USAGE` sur ce schéma, et le rôle anonyme ne doit pas l'obtenir
   pour la commodité d'un formulaire. C'est le point que la première
   implémentation a manqué : l'insertion échouait sur
   `permission denied for schema app`.

## Conséquences

- La surface publique d'AIGMS tient en une table et une politique, relues d'un
  coup d'œil, et couvertes par neuf tests dédiés qui vérifient aussi bien ce
  qu'`anon` peut faire que tout ce qu'il ne peut pas.
- Aucune clé `service_role` ne circule dans un chemin de requête publique : le
  formulaire écrit avec les mêmes droits que n'importe quel visiteur.
- La limitation de débit est rudimentaire : un index unique sur
  `(email, jour)` écarte le double clic et la soumission répétée, mais pas un
  automate qui fait varier l'adresse. Une protection sérieuse relèvera du bord
  (règles de pare-feu Vercel) plutôt que du schéma.
- Toute future surface publique devra faire l'objet du même examen, et de son
  propre ADR : la règle reste « `anon` n'a aucun droit », avec cette exception
  nommée.

## Alternatives écartées

- **Route serveur avec `service_role`** : fait circuler une clé qui contourne
  toute la RLS dans le chemin le plus exposé du produit. Une erreur de portée y
  coûterait beaucoup plus cher qu'un `grant insert` explicite.
- **Service tiers de formulaire** : les demandes vivraient hors du système, à
  rapprocher à la main du registre. Elles alimentent le suivi commercial, elles
  ont leur place en base.
