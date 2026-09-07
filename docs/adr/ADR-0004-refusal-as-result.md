# ADR-0004 — Un refus de transition est un résultat, pas une exception

Date : 7 septembre 2026 · Statut : accepté

## Contexte

`app.transition_use_case` journalise les refus (`gate_blocked`) avant de les
signaler. La première implémentation levait une exception PostgreSQL.

Un test l'a mise en défaut : l'exception annule la transaction courante, **et
avec elle l'écriture du journal**. Le refus disparaissait au moment précis où il
fallait le tracer. C'est exactement l'inverse de l'exigence d'auditabilité.

## Décision

Un refus **métier** retourne un objet structuré :

```json
{
  "transitioned": false,
  "from": "PILOT",
  "to": "PRODUCTION",
  "reason": "GATE_NOT_SATISFIED",
  "message": "Préconditions non satisfaites pour le passage en PRODUCTION.",
  "gate": { "checks": [...] }
}
```

`reason` vaut `OK`, `GATE_NOT_SATISFIED`, `TRANSITION_NOT_ALLOWED` ou
`ALREADY_IN_STATUS`.

Seules les **erreurs** lèvent : cas d'usage introuvable, habilitation
insuffisante. Elles ne sont pas des faits de gouvernance à journaliser, et
PostgREST les traduit correctement en 403 ou 404.

## Conséquences

- Le refus et son motif survivent dans `audit_log`.
- L'interface affiche le détail des préconditions manquantes plutôt qu'un
  message d'erreur opaque : elle indique quoi corriger.
- L'appelant doit tester `transitioned`, jamais l'absence d'exception. C'est
  contre-intuitif pour qui attend un `throw`, d'où ce document.
- `screen_change_request` suit la même convention.

## Alternatives écartées

- **Journaliser dans une transaction autonome** (`dblink`, `pg_background`) :
  une dépendance et une connexion supplémentaires pour conserver un `raise`.
- **Journaliser côté application après l'exception** : la trace dépendrait alors
  du chemin d'accès, et un appel PostgREST direct n'en produirait aucune.
