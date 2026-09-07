# AIGMS — Architecture cible

Version 1.0 — 7 septembre 2026

## 1. Principe directeur

AIGMS est un **système de management exécutable**, pas un ensemble de registres.
La conséquence architecturale est nette : **les règles de gouvernance vivent dans
la base**, où elles sont testables, journalisées et impossibles à contourner
depuis un client. L'application Next.js présente ces règles et leurs résultats ;
elle n'en porte aucune.

```
Navigateur ──► Next.js App Router ──► Supabase (PostgREST + Auth)
                    │                        │
              Server Actions            RLS + fonctions app.*
              (validation de forme)     (habilitation, gates, audit)
                                              │
                                        PostgreSQL
```

## 2. Couches

### 2.1 Présentation — Next.js 16 App Router

- Server Components pour toute lecture ; le client Supabase porte le JWT de
  l'utilisateur et reste soumis à la RLS.
- Server Actions pour les écritures sensibles : elles valident la **forme** de
  l'entrée avec Zod, puis délèguent la **décision** à une fonction serveur.
- `src/proxy.ts` (Next 16 remplace `middleware.ts`) rafraîchit la session et
  redirige les visiteurs non authentifiés. Il ne porte aucune règle métier.
- Tailwind v4, TypeScript strict avec `noUncheckedIndexedAccess`.

### 2.2 Domaine — PostgreSQL

Deux schémas, deux rôles :

| Schéma | Contenu | Exposé à PostgREST |
|---|---|---|
| `public` | tables métier, vues, wrappers d'API | oui |
| `app` | helpers RLS, gates, moteur de réévaluation, journalisation | non |

Les fonctions de `app` sont `SECURITY DEFINER` : elles contournent la RLS pour
lire les appartenances sans provoquer de récursion dans les politiques. Chacune
**revérifie explicitement l'habilitation** de l'appelant — sans quoi le
`SECURITY DEFINER` deviendrait une porte dérobée. Le schéma `app` n'étant pas
exposé, `public` offre quatre wrappers minces en `SECURITY INVOKER`
(`transition_use_case`, `evaluate_gate`, `screen_change_request`,
`evaluate_governance_impact`).

### 2.3 Persistance et preuves

- Migrations versionnées dans `supabase/migrations/`, appliquées par le CLI.
  Aucune modification improvisée : la CI échoue si le schéma dérive.
- `audit_log` append-only : les `UPDATE` et `DELETE` sont refusés par trigger,
  y compris pour le propriétaire des tables. L'écriture passe exclusivement par
  `app.log_audit`, qui refuse toute écriture hors du périmètre tenant.
- `governance_event` persiste les événements métier sans bus d'événements.

## 3. Choix structurants

| Sujet | Décision | ADR |
|---|---|---|
| Disposition du dépôt | Code applicatif et pack méthodologique dans un même dépôt | ADR-0001 |
| Frontière d'isolation | `tenant`, propagé par `tenant_id` sur chaque table | ADR-0002 |
| Règles de gate | Dans la base, testées, jamais côté client | ADR-0003 |
| Refus de transition | Résultat structuré, pas exception | ADR-0004 |
| Actifs IA | Une table `ai_asset` discriminée par `kind` | ADR-0005 |
| Catalogue de référentiels | Partagé plateforme, écriture réservée | ADR-0006 |

## 4. Sécurité

- RLS **activée et forcée** sur les 36 tables de `public`, aucune exception.
- `anon` ne dispose d'aucun droit : AIGMS n'a pas de surface publique.
- La clé `service_role` n'est jamais importée par le code applicatif ; une règle
  ESLint (`no-restricted-imports`) l'interdit hors de `scripts/` et `tests/`.
- `serverEnv()` lève si elle est évaluée côté navigateur.
- Séparation des rôles imposée en base : l'auteur d'une décision engageante ne
  peut pas l'approuver.

## 5. Ce qu'AIGMS ne construit pas

Conformément à la matrice BUILD / CONNECT / DON'T BUILD : ni SIEM, ni DLP, ni
CMDB, ni ITSM, ni IAM, ni observabilité de modèles, ni garde-fous d'exécution.
L'intégration passera par une abstraction `GovernanceConnector` en lecture seule
et à moindre privilège (Sprint 15, non commencé).

## 6. Dette assumée

| Sujet | État | Raison |
|---|---|---|
| ESLint épinglé en 9.x | `eslint-config-next@16` embarque un `eslint-plugin-react` incompatible avec ESLint 10 | Contrainte amont ; à lever à la prochaine version de `eslint-config-next` |
| Storage Supabase | Non câblé : les preuves acceptent une URL externe ou une déclaration | Le dépôt de fichiers relève du Sprint 8 complet |
| Écriture des objets de gouvernance | L'interface est en lecture pour la plupart des objets ; seule la transition de cycle de vie est actionnable | Le vertical slice privilégie la profondeur du workflow à la largeur des formulaires |
