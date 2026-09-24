# ADR-0031 — L'outillage a deux natures, et il se signale

*1er octobre 2026. Migration 0094.*

## Contexte

ADR-0026 a posé l'outillage des contrôles : avec quoi, chez nous, un contrôle
se tient. Une seule idée — l'outil est l'**instrument d'un contrôle**.

La question « l'outillage est-il plus proche des contrôles ou des actifs
d'IA ? » a fait apparaître qu'il en manquait une seconde.

| Texte | Ce qu'il dit | Rattachement |
|---|---|---|
| ISO/IEC 27002:2022 | la mesure porte elle-même sa nature ; l'outil est un moyen | contrôle |
| RGPD art. 32 | « mesures techniques **et** organisationnelles » | contrôle |
| ISO/IEC 42001 **A.4.4** « Tooling resources » | l'outillage est une **ressource du système d'IA**, à documenter | actif |
| AI Act, annexe IV | décrire les moyens employés pour développer et valider | actif |
| AI Act art. 12, 19, 26(6) | journalisation : capacité du système, conservée par le déployeur | actif |
| NIST AI RMF, MEASURE | méthodes et métriques : instruments d'un contrôle | contrôle |

**Aucun cadre n'érige l'outillage en objet gouverné à part entière.** Deux
rattachements coexistent, et le discriminant est le **sujet** : outillage *du
système* (42001 A.4.4) contre outillage *du contrôle* (27002, RGPD 32).

Le modèle ne couvrait que le second. Et le cas qui compte lui échappait
entièrement : une passerelle d'appels IA avec modération, un juge LLM, un
assistant de code sont **instrument de contrôle et actif d'IA à gouverner**.
Il fallait les saisir deux fois, sans lien.

## Décisions

1. **La réponse à la question reste : plus proche des contrôles.** Un actif
   d'IA est un objet gouverné ; un outil est un instrument de gouvernance.
   Datadog n'est pas un cas d'usage à instruire. `control_tooling` reste
   accroché au contrôle.
2. **`organization_tooling.role`** (`control_instrument`, `system_resource`,
   `both`) nomme le titre auquel l'outil est déclaré. Les intitulés de
   l'interface citent le texte qui les fonde : sans cela, le champ devient une
   taxonomie de plus.
3. **`organization_tooling.asset_id`**, facultatif : quand l'outil **est** un
   actif d'IA déclaré, le registre et la carte d'outillage cessent de
   s'ignorer. Un garde vérifie que l'actif appartient à la même organisation —
   le garde générique ne rapproche pas deux tables.
4. **Deux signaux**, lus par la carte et par la fiche du contrôle :
   - `app.control_needs_tooling` — un contrôle de nature **technique** dont
     aucun outillage n'est retenu énonce un moyen sans le nommer : il ne se
     prouve pas ;
   - `app.control_evidence_automatable` — un contrôle qui retient un outil
     dont le connecteur est **actif** et n'a aucune preuve validée et fraîche
     collecte à la main ce qui pourrait venir seul.
5. **Toujours pas de CMDB.** Une ligne par famille, le produit employé. Pas
   d'instances, pas de dépendances, pas de cycle de vie. Le rattachement à un
   actif désigne une fiche existante, il n'en crée pas. La règle est
   réaffirmée en commentaire de migration et dans l'infobulle, parce que les
   deux colonnes ajoutées donnent envie de la franchir.

## Le second signal et les connecteurs

Il sert d'abord la gouvernance : savoir où la preuve se collecte encore à la
main est une information légitime pour l'officer.

Il a un usage commercial, et il faut le nommer pour ne pas s'y tromper. En
atelier de qualification, il produit du chiffré et du nominatif — « Datadog
tient 7 contrôles, 5 sans preuve fraîche » — là où le catalogue de connecteurs
ne dit qu'une capacité abstraite. **Cet usage reste celui de la lecture faite
en atelier, pas un message dans le produit.** L'officer client lit son propre
écran ; une incitation à l'achat y serait mal reçue, et le libellé retenu ne
dit que l'état constaté.

Deux réserves tiennent :

- **ne rien promettre qui n'existe pas** — `connector_id` distingue le
  connecteur branché du produit candidat, et l'écran doit le dire sans
  ambiguïté ;
- **la carte vide ne calcule rien** — c'est une donnée d'entrée du Discovery,
  pas un acquis.

## Une famille porte plusieurs produits

*2 octobre 2026. Migration 0095.*

0088 imposait `unique (organization_id, tool_code)` — un produit par famille.
C'était une erreur, et `connector_id` la rend visible : **le connecteur est
porté par la ligne**. Deux produits écrasés en un libellé (« Datadog +
Grafana ») ne peuvent en porter qu'un, le second devient inatteignable, et le
signal « preuve automatisable » ment.

Les cas interdits étaient ordinaires : l'observabilité tenue par un produit en
production et un autre ailleurs, deux CSPM pendant une migration, un SIEM
groupe et un SIEM filiale.

`unique (organization_id, tool_code, product)` remplace la contrainte :
plusieurs produits, pas deux fois le même. **Cela ne rapproche pas d'une
CMDB** — ce qui en ferait une, ce sont les instances, les dépendances et le
cycle de vie, pas le nombre de produits.

Conséquence sur les lectures : `declared` cesse d'être un objet et devient une
liste, dans la carte comme dans la vue par contrôle.

## Nommer les contrôles, et les retrouver

Deux manques constatés à l'usage :

- « 7 contrôles attendent cette famille » ne disait pas **lesquels**, et
  obligeait à les chercher au registre. La carte porte désormais
  `served_controls` et une infobulle les nomme, en signalant ceux qui n'ont
  encore rien retenu.
- Le signal « contrôle technique sans outillage » se comptait sans se
  parcourir. Le registre des contrôles porte un filtre **« Technique, sans
  outillage »**, qui n'apparaît que s'il y a quelque chose à voir.

## L'outillage d'un actif — le lien inverse

*4 octobre 2026. Migration 0103.*

`asset_id` répondait à « cet outil est un actif ». Il ne répondait pas à « ce
système a été entraîné avec MLflow et DVC », qui est la question de l'auditeur
— celle d'ISO/IEC 42001 **A.4.4 lu à la lettre** (documenter l'outillage **par
système**) et de l'**annexe IV de l'AI Act**.

`asset_tooling` porte le couple actif × outillage, avec une **phase** du cycle
de vie (conception, données, entraînement, validation, déploiement,
exploitation). Un même outil peut servir à deux moments : l'unicité porte sur
le triplet, pas sur le couple — sinon on perd l'un des deux.

La fiche d'un actif porte la carte « Avec quoi il a été fait ». Vide, elle le
dit sans détour : un auditeur demandera avec quoi ce système a été entraîné,
validé et déployé.

**Toujours pas de CMDB.** Un couple, une phase, une note. Pas d'instances, pas
de versions, pas de dépendances — la règle tient depuis 0088, et les trois
tables ajoutées depuis ne l'ont pas entamée.
