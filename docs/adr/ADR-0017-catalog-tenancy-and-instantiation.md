# ADR-0017 — Référentiels de l'éditeur et des tenants ; un contrôle opérationnel naît d'un contrôle-type

*Statut : accepté — 16 septembre 2026*

## Contexte

Le moteur d'import de référentiels (migration 0021) fonctionnait, mais trois
choses manquaient : aucun référentiel n'était présent en base par défaut ; la
lecture du catalogue était globale, ce qu'un cabinet importait, tous les autres
le voyaient ; et la colonne `control.catalog_control_id` n'était jamais écrite
— « Créer un contrôle » restait un formulaire vierge, le catalogue ne servait à
rien dans l'application.

## Décision

**Deux sortes de référentiels, distinguées par `catalog_framework.tenant_id`.**
NULL : référentiel de l'éditeur, visible de tous les tenants, livré et publié
par migration, jamais écrit depuis l'application. Renseigné : référentiel privé
du tenant qui l'importe. Le code d'un référentiel de l'éditeur ne peut pas être
repris par un tenant.

**Le référentiel AIGMS Control Framework est livré en v0.2**, générée depuis la
v0.1 gelée et une vague d'enrichissement versionnée
(`knowledge/frameworks/aigms/v0.2/wave1_enrichment.json`) : GOV, INV, USE, RSK,
soit 42 contrôles avec objectif, questions d'évaluation, preuves attendues,
responsable, fréquence, correspondances ISO/IEC 42001 et AI Act. Les 78 autres
restent des titres, en attente des vagues suivantes. Une vague est une nouvelle
version ; la v0.1 n'est jamais modifiée.

**Un contrôle opérationnel s'ajoute d'abord depuis un référentiel.**
`app.instantiate_catalog_control` crée le contrôle de l'organisation à partir
d'un contrôle-type publié — code, nom, objectif, fréquence repris, lien
conservé — et rattache automatiquement les correspondances vers des exigences
chargées dans AIGMS (ISO/IEC 42001). Les autres (AI Act) sont nommées, pas
perdues. Un contrôle-type ne s'instancie qu'une fois par organisation. L'ajout
libre reste possible pour ce qui n'existe dans aucun référentiel.

## Conséquences

- Une base neuve — Production comprise — porte 120 contrôles-types dès la
  migration 0043, sans passer par l'écran d'import.
- La liste d'une organisation s'appelle « Liste des contrôles opérationnels » et
  chaque ligne porte son origine (`AIGMS-CF v0.2 · AIGMS-RSK-012`).
- L'administration lit chaque version contrôle par contrôle.
- Un cabinet qui a importé un référentiel avant cette migration ne le voit plus
  partagé : c'est le but.
- Mode opératoire : `docs/admin/IMPORTER_UN_REFERENTIEL.md`.

## Voir aussi

- ADR-0006 — référentiels normatifs partagés (exigences), qui restent livrés par migration
