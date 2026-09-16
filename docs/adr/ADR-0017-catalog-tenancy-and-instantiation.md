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

**Le référentiel AIGMS Control Framework est livré par vagues**, chacune une
nouvelle version générée depuis la v0.1 gelée et des fichiers d'enrichissement
versionnés (`knowledge/frameworks/aigms/waves/`) : objectif, questions
d'évaluation, preuves attendues, responsable, fréquence, correspondances
ISO/IEC 42001 et AI Act. v0.2 (migration 0043) : GOV, INV, USE, RSK ; v0.3
(migration 0044) : DAT, SEC, SUP, HUM — 84 contrôles enrichis sur 120. Les 36
restants (OPS, MON, INC, CMP) attendent la vague 3. La v0.1 n'est jamais
modifiée.

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
  chaque ligne porte son origine (`AIGMS-CF v0.3 · AIGMS-RSK-012`).
- L'administration lit chaque version contrôle par contrôle.
- Un cabinet qui a importé un référentiel avant cette migration ne le voit plus
  partagé : c'est le but.
- Mode opératoire : `docs/admin/IMPORTER_UN_REFERENTIEL.md`.

## Voir aussi

- ADR-0006 — référentiels normatifs partagés (exigences), qui restent livrés par migration
