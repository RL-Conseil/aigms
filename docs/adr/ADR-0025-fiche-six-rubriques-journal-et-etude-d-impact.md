# ADR-0025 — La fiche en six rubriques ; le journal et l'étude d'impact ont leur page

*22 septembre 2026. Migrations 0076–0078.*

## Contexte

La fiche du cas d'usage avait neuf onglets. Deux n'étaient pas des rubriques
de travail : le **Journal** (une lecture d'audit, limitée aux entrées dont
l'entité était le cas d'usage — pas ses risques ni ses décisions) et
l'**Évaluation d'impact** (six champs, alors que la base portait depuis 0008
les parties prenantes et les constats par domaine, sans interface). Actions et
Incidents se lisaient séparément alors qu'une action naît souvent d'un
incident. « Fil conducteur » décrivait une manière de lire, pas ce que
l'onglet montre.

## Décisions

1. **Six rubriques** : Avancement (ex-Fil conducteur : la barre des jalons,
   ce qui est fait, ce qui bloque, « Faire évoluer »), Contrôles affectés,
   Risques, Actions et incidents (un onglet, un sélecteur), Supervision
   humaine, Décisions et changements. Les anciennes adresses restent valides.
2. **Le suivi conduit à la ligne.** « Suivi d'actions et d'incidents »
   surligne l'action ou l'incident visé (`?action=`, `?incident=`) ; les
   alertes y conduisent directement (0076).
3. **Le journal se lit par organisation.** Chaque entrée est située
   (organisation, cas d'usage) à l'écriture, par l'état journalisé ou la ligne
   parente (0077). Page « Journal d'audit » — familles d'opérations, cas
   d'usage, période, recherche — imprimable, à côté d'« Imprimer le
   registre » ; lien « Journal » dans l'en-tête de la fiche, filtré sur elle.
   Le journal est gardé parce qu'il consigne ce qu'aucun registre ne porte :
   les refus, les transitions, les validations, avec auteur et heure, sans
   réécriture possible.
4. **L'étude d'impact IA se conduit sur sa page**, au format du modèle
   ISO/IEC 42005 de l'organisation : cadrage et parties prenantes, analyse
   croisée bénéfices / préjudices par domaine, plan de remédiation,
   conclusion. Un préjudice significatif ou grave porte une mesure, confiée et
   datée, qui **ouvre son action** (bloquante si grave) (0078). L'export
   `.docx` reprend le modèle ; achevée, l'étude se dépose comme preuve d'un
   clic et solde l'action ouverte par l'achèvement. Bouton « Conduire une
   étude d'impact IA » sur la page Cas d'usage ; carte courte sur
   l'Avancement de la fiche (exigée ? où en est-elle ?).

## Conséquences

- Les règles de gate ne changent pas : l'AIIA reste exigée par les faits et
  demandée achevée au jalon Production.
- La double signature de l'AIIA (kit, point 4) se greffera sur la fiche de
  l'étude.
