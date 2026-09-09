# ADR-0011 — Garde des fichiers de preuve

Date : 9 septembre 2026 · Statut : accepté

## Contexte

Le chemin du risque (ADR-0010) désigne le plus souvent la même rupture :
`no_evidence`. Elle était irréparable depuis la plateforme — on pouvait
déclarer une preuve, pas la déposer.

Un fichier de preuve est le contenu le plus sensible qu'AIGMS détient : extraits
de journaux, rapports de test, attestations, parfois données personnelles. Il
est aussi la seule pièce qu'un auditeur examinera vraiment. Deux exigences en
découlent — confidentialité stricte, et intégrité démontrable — auxquelles
s'ajoute une contrainte connue d'avance : la plateforme pourra être hébergée
ailleurs que sur Supabase.

## Décision

**Le chemin est dérivé, jamais saisi.** Un objet vit sous
`<tenant>/<organisation>/<preuve>/<fichier>`. Le serveur le compose ;
`app.guard_evidence_file` vérifie que la ligne de preuve ne référence rien
d'autre ; les politiques de `storage.objects` lisent le tenant dans le premier
segment. Les trois, parce qu'une règle d'isolation qui ne vit que dans
l'application disparaît dès qu'on appelle PostgREST directement.

**L'administrateur de plateforme ne télécharge pas.** La politique de lecture
exige `app.tenant_role(...) is not null` — une appartenance réelle — là où le
reste du modèle se contente de `has_tenant_access`, qui accorde tout à
l'administrateur. Il voit donc qu'une preuve existe ; il n'ouvre pas le document
d'un client. C'est l'extension naturelle d'ADR-0008 au seul endroit où la
distinction porte des données et non des métadonnées.

**Un fichier déposé porte son empreinte.** `content_hash` (SHA-256, calculé au
dépôt) est obligatoire dès qu'il y a un fichier. Sans elle, un auditeur ne peut
pas établir que la pièce téléchargée est celle qui a été validée.

**Une preuve validée est figée.** Ni son fichier, ni son empreinte, ni sa taille
ne changent après validation ; il n'existe aucune politique `UPDATE` sur les
objets du compartiment. Corriger reviendrait à modifier, après coup, ce qu'un
validateur nommé a déclaré avoir examiné. On dépose une nouvelle preuve, et
`superseded_by` conserve le lien entre les deux.

**La validation est un acte nominatif.** Le passage à « validée » exige
`validated_by = app.current_user_id()`. La règle porte sur l'acte, pas sur la
création d'une ligne déjà validée : une reprise de données ou un import CONNECT
porte légitimement une validation faite ailleurs, et c'est le journal qui dit
alors qui l'a versée.

**Aucune URL en base.** Seulement le couple (`storage_bucket`, `storage_path`).
Le téléchargement passe par une URL signée d'une minute, demandée avec le client
de session : la plateforme ne sert pas les fichiers elle-même, et un lien copié
dans un courriel ne survit pas.

## Conséquences

- Le dépôt écrit le fichier **avant** la ligne de preuve : c'est le seul ordre
  qui ne peut pas produire une preuve référençant un objet absent. Si
  l'insertion échoue ensuite, l'objet est retiré — un fichier orphelin dans un
  compartiment de preuves est une donnée client sans titulaire.
- Un dépôt n'est pas une validation. La pièce arrive « à valider », et
  l'interface le dit.
- **Portabilité.** L'arborescence se transpose telle quelle sur n'importe quel
  stockage compatible S3. Une migration d'hébergement se réduit à copier l'arbre
  et à changer une variable d'environnement : aucune donnée de la base ne
  référence Supabase.
- Ce qui ne se transpose pas est nommé : les politiques de `storage.objects`
  sont propres à Supabase Storage. Sur un stockage tiers, l'équivalent devra
  être posé au niveau du service qui signe les URL. C'est le premier point à
  traiter dans le sprint d'hébergement.

## Alternatives écartées

- **Servir les fichiers depuis l'application.** Aurait fait transiter chaque
  document par le serveur applicatif, avec ses journaux et ses caches, pour un
  gain nul en contrôle : la politique de stockage tranche déjà.
- **Un écran d'administration du stockage.** Voir `IMPLEMENTATION_STATUS` :
  compartiment, quotas et rétention sont de l'infrastructure ; les exposer en
  écran donnerait l'illusion d'un réglage produit et ouvrirait une surface de
  configuration sans contrepartie de gouvernance.
- **Permettre le remplacement d'un fichier validé.** Plus commode, et
  destructeur de la valeur probante : c'est exactement ce qu'un auditeur
  cherche à exclure.
