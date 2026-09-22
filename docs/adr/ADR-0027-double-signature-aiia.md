# ADR-0027 — L'étude d'impact se signe à deux, et l'Administrateur client devient un rôle

*28 septembre 2026. Migrations 0090–0091.*

## Contexte

Achever une étude d'impact était un seul geste : celui qui la rédige
concluait. Un auditeur ne pouvait donc pas distinguer deux choses de nature
différente — « l'étude est bien conduite » et « l'organisation assume ce qui
reste ». Le kit de preuve de l'AI Officer le demande (workflow B) ; la clôture
d'un incident le fait déjà (0069).

Par ailleurs `client_admin` portait les mêmes prérogatives que l'AI Governance
Officer — il aurait donc visé une AIIA — sans figurer parmi les rôles
attribuables, ni dans le RACI, ni dans la liste des rôles. Visible dans la
matrice des capacités, introuvable partout ailleurs, et porté par zéro compte.

## Décisions

1. **Deux actes, deux signataires.** Le **visa de méthode** (AI Governance
   Officer ou Administrateur client) atteste que l'étude est conduite
   correctement. L'**acceptation des risques résiduels** (Porteur de l'IA,
   nommément, avec sa propre déclaration) dit que l'organisation assume ce qui
   demeure. Entre les deux, l'étude est **« en attente de signature »**.
2. **Nul ne signe au nom d'un autre, nul ne pose les deux.** La base remplit
   les signataires avec `app.current_user_id()` et refuse qu'une même personne
   pose les deux signatures — comme la clôture d'incident.
3. **L'acceptation est un acte, pas une écriture.** Écrire une étude reste
   fermé au Porteur (`roles_write_governance`) : il ne doit pas pouvoir la
   réécrire. Sa signature passe par `accept_residual_risks`, comme une
   transition passe par `transition_use_case`.
4. **Le refus motivé existe.** `return_impact_study` renvoie l'étude à
   l'étude : le visa tombe, l'officer est averti et reprend la main. Sans lui,
   la seule issue serait de ne rien faire — un blocage silencieux.
5. **Relances J+7 puis J+14**, posées d'avance (0084) : la première au
   Porteur, la seconde à l'officer — c'est lui qui relance humainement. Elles
   tombent dès que la signature arrive ou que l'étude est renvoyée.
6. **Le jalon Production exige les deux signatures**, et son détail dit
   laquelle manque : « visé le 22/09, en attente de l'acceptation des risques
   résiduels par Dominique Etchart ». Aucune précondition nouvelle : c'est le
   même check, mieux exigeant.
7. **Le statut du cas d'usage ne bouge pas.** Une signature qui tarde n'est
   pas un incident ; suspendre un système en production pour cela serait
   disproportionné. La conséquence est le jalon, pas le statut.
8. **`client_admin` devient un rôle à part entière** : attribuable depuis
   l'application, présent au RACI avec les lettres de l'officer, décrit comme
   « l'officer chez le client quand le cabinet tient le rôle en prestation ».
   **Il ne compte pas** pour la règle des six rôles tenus (0056) : il double
   l'officer, il ne le remplace pas.

## Conséquences

- L'export `.docx` et l'impression portent un tableau de signatures — acte,
  signataire, date, portée — et la déclaration du Porteur. C'est ce qu'un
  auditeur regarde en premier.
- L'alerte de signature part immédiatement par courriel (0086) : elle retient
  un jalon.
- Les études déjà achevées restent achevées, sans signature : la contrainte ne
  vaut que pour les achèvements postérieurs.
