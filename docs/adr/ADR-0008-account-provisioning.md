# ADR-0008 — L'administration ouvre les accès, elle ne gouverne pas

Date : 8 septembre 2026 · Statut : accepté

## Contexte

Jusqu'à la migration `0017`, `app.is_platform_admin()` court-circuitait tous les
contrôles de rôle : `has_tenant_role` et `has_organization_role` retournaient
vrai sans regarder plus loin. L'administrateur de la plateforme pouvait donc
déclarer un cas d'usage, coter un risque, approuver une mise en production.

C'est exactement ce que le produit refuse par ailleurs. Une décision de
gouvernance engage une responsabilité métier ; l'exploitant technique de la
plateforme n'a pas cette responsabilité, et lui donner ce pouvoir vide de sens
le registre de décisions.

## Décision

L'administration de la plateforme **ouvre les accès** : elle crée les
organisations, déclare les comptes, attribue les rôles. Elle **ne gouverne
pas** : ni cas d'usage, ni risque, ni impact, ni contrôle, ni décision, ni
transition.

Concrètement :

- `has_tenant_role` et `has_organization_role` ne court-circuitent plus sur le
  privilège plateforme. Un administrateur n'obtient un rôle de gouvernance que
  si quelqu'un le lui a explicitement attribué — comme n'importe qui.
- `roles_write_governance`, `roles_contribute`, `roles_risk` et `roles_review`
  ne contiennent plus `platform_admin`.
- `roles_administer` est introduit, et gouverne les politiques d'écriture sur
  `organization`, `membership`, `role_assignment` et `tenant`.
- `assignable_roles()` borne ce qu'un administrateur peut attribuer : ni
  `platform_admin`, ni `client_admin`. Un trigger le vérifie, de sorte que la
  règle tienne quel que soit le chemin d'accès.
- **Le privilège transverse conservé est la lecture** : `has_tenant_access`
  reste vrai pour un administrateur, qui doit constater l'état d'un portefeuille
  pour l'administrer.

En contrepartie, les rôles de gouvernance perdent la création d'organisations
et la gestion des comptes : ces actes deviennent le monopole de
l'administration.

## La clé `service_role`, et pourquoi elle apparaît une fois

Créer un compte d'authentification passe par l'API d'administration de
Supabase, qui n'accepte que la clé `service_role`. Aucune politique RLS ne peut
s'y substituer. `src/lib/actions/admin.ts` est donc le seul module de
l'application à l'employer, sous quatre conditions :

1. l'action vérifie **d'abord**, avec le client soumis à la RLS, que l'appelant
   administre bien le tenant visé — un appel non habilité s'arrête avant que la
   clé ne soit lue ;
2. la clé ne sert qu'à `auth.admin.createUser` : l'appartenance et le rôle
   passent par le client ordinaire, donc par la RLS ;
3. la règle ESLint `no-restricted-imports` continue d'interdire cet import
   partout ailleurs, et sa dérogation est locale et commentée ;
4. l'acte est journalisé — par un trigger en base, non par l'application.

## La journalisation est posée par des triggers

`0018` pose des triggers d'audit sur `organization`, `membership` et
`role_assignment` plutôt que des appels depuis l'application.

Une journalisation applicative ne couvre que le chemin qu'elle emprunte : un
appel direct à l'API, un script ou une session `psql` y échapperaient. Le
trigger s'exécute quel que soit le chemin. C'est aussi ce qui permet de ne pas
exposer `app.log_audit` à PostgREST : personne ne peut écrire dans le journal en
choisissant ce qu'il y consigne.

## Conséquences

- Le registre de décisions retrouve son sens : personne ne peut approuver une
  mise en production au titre de l'exploitation technique.
- Un administrateur qui doit gouverner un portefeuille doit se voir attribuer un
  rôle de gouvernance — explicitement, et la trace en reste.
- L'interface suit : le menu d'un administrateur ne propose pas le pilotage, et
  un bandeau nomme le mode dans lequel il travaille. Ce n'est qu'un confort
  d'affichage ; la RLS refuserait ces actions même si un lien y menait.
- Onze tests couvrent la frontière dans les deux sens : ce que l'administration
  peut faire, ce qu'elle ne peut pas, et ce que les rôles de gouvernance ont
  perdu.

## Alternatives écartées

- **Laisser le court-circuit et s'en remettre à l'interface** : une interface
  ne protège rien. La règle doit être en base, où elle vaut pour tous les
  chemins d'accès.
- **Un rôle d'administration par organisation** plutôt que par tenant :
  complexité supplémentaire sans besoin identifié — l'exploitant de la
  plateforme administre son portefeuille entier.
