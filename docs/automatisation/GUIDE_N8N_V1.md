# Automatiser autour d'AIGMS avec n8n

*Version 1 — 23 septembre 2026. Écrit contre la plateforme réelle : chaque
requête de ce guide a été exécutée sur la préprod avant d'être publiée.*

---

## 1. Avant tout : ce qu'AIGMS fait déjà, et qu'il ne faut pas automatiser

C'est la première chose à savoir, parce que l'erreur la plus coûteuse serait
de doubler le natif : deux systèmes qui relancent la même personne pour la
même échéance, et plus personne ne sait lequel dit vrai.

| Ce qui est déjà fait, en base | Ne pas refaire dans n8n |
|---|---|
| **25 natures d'alerte nominatives** : risque confié, action confiée et échue, traitement, décision soumise / à statuer / date d'effet / bloquée, changement, supervision, incident (4), criticité à réviser, preuve à valider / bientôt échue / échue, revue de cas d'usage, de fournisseur, d'étude d'impact | des relances par courriel sur ces mêmes objets |
| **Synthèse par courriel**, quotidienne ou hebdomadaire, par personne, avec liens directs vers la ligne exacte du suivi | un « digest de gouvernance » hebdomadaire |
| **Rappels datés sans tâche planifiée** : posés à l'avance, ils apparaissent le jour dit et disparaissent quand l'objet est soldé | un planificateur qui calcule des échéances |
| **Ouverture automatique d'actions** : constat d'impact grave, étude d'impact achevée, risque à traiter, preuve à renouveler | créer ces actions depuis n8n |
| **Refus des jalons** : huit préconditions évaluées côté serveur | tout contrôle « avant passage en production » |
| **Journal d'audit** *append-only*, situé par organisation et cas d'usage | un journal parallèle |

**La règle** : n8n agit **hors** d'AIGMS — ITSM, IAM, M365, SIEM, signature,
messagerie d'équipe — et rapporte dans AIGMS. Il ne refait pas la gouvernance,
il la prolonge là où elle touche d'autres systèmes.

---

## 2. Principes de conception

1. **Aucune décision automatique.** Approuver, accepter un risque, viser une
   étude, autoriser une production : ces actes sont nominatifs et la base les
   refuse à quiconque n'est pas la personne désignée. Un workflow qui tenterait
   d'approuver à la place de quelqu'un recevrait une erreur, et c'est voulu.
2. **Approbation et exécution se séparent.** n8n n'exécute une action sur un
   système cible qu'après qu'un humain a décidé *dans AIGMS*. Le workflow lit
   la décision, il ne la provoque pas.
3. **Une réponse 200 prouve l'exécution, pas l'efficacité.** Le contrôle
   d'efficacité est un acte distinct, humain, dans AIGMS.
4. **Un fichier déposé ne rend pas un contrôle conforme.** Une preuve déposée
   par n8n arrive *en attente de validation* ; l'AI Governance Officer la
   valide. C'est le comportement natif, ne pas le contourner.
5. **n8n a son propre compte AIGMS**, avec un rôle de gouvernance. Toutes ses
   écritures sont nominatives au journal : un auditeur voit « automation@… a
   déposé cette preuve le 23/09 à 07 h 12 ».
6. **Jamais la clé `service_role` dans un workflow.** Elle contourne toute la
   sécurité. n8n se connecte comme un utilisateur ; la RLS fait le reste.
7. **Tout workflow renvoie son identifiant d'exécution** dans l'objet AIGMS
   qu'il touche (description d'action, note de preuve) : c'est ce qui rend la
   chaîne reconstituable.

---

## 3. Comment n8n parle à AIGMS

**Il n'y a pas d'API « AIGMS » distincte : l'API, c'est PostgREST**, exposée
par Supabase sur la base de la plateforme. Deux surfaces :

| Surface | Forme | Usage |
|---|---|---|
| **Tables** | `GET/POST/PATCH/DELETE https://<ref>.supabase.co/rest/v1/<table>` | lire et écrire les registres |
| **Fonctions métier** | `POST https://<ref>.supabase.co/rest/v1/rpc/<fonction>` | ce que la plateforme sait calculer : gates, attention, ordre du jour, imports… |

**La RLS s'applique intégralement.** n8n ne voit que ce que son rôle permet,
et les déclencheurs métier (alertes, actions ouvertes, garde-fous) se
déclenchent exactement comme si un humain avait agi par l'écran.

**Il n'existe pas de webhook sortant.** AIGMS n'émet rien vers l'extérieur :
c'est n8n qui **interroge**, sur un *Schedule*. Conséquence à assumer : une
latence égale à la période d'interrogation (15 minutes est un bon compromis).
Voir l'annexe D.

---

## 4. Les cinq scénarios

Chacun est écrit en deux colonnes de travail : **ce que vous faites dans
AIGMS** et **ce que vous montez dans n8n**. Les identifiants d'exemple sont
ceux du jeu de démonstration.

---

### Scénario 1 — Une action bloquante ouvre un ticket ITSM, et son statut revient

*Pourquoi celui-ci d'abord : AIGMS sait qu'une action retient une mise en
production, mais il n'ouvre pas de ticket chez l'exploitant. C'est le premier
endroit où l'automatisation crée de la valeur.*

#### Dans AIGMS

1. **Fiche du cas d'usage → Actions et incidents → Actions → Ouvrir une
   action.** Renseignez l'intitulé, le responsable, l'échéance, et cochez
   **bloquante** si elle retient la production.
2. Rien d'autre. L'action porte déjà `business_ref` (ACT-2026-xxxx),
   `is_blocking`, `due_date`, son responsable et son cas d'usage.

#### Dans n8n

| Nœud | Réglage |
|---|---|
| **Schedule Trigger** | toutes les 15 minutes |
| **HTTP Request** — « Actions bloquantes sans ticket » | `GET {{$env.AIGMS_URL}}/rest/v1/action` · Query : `select=id,business_ref,title,description,due_date,use_case:use_case_id(name),owner:owner_user_id(email,full_name)` · `status=not.in.(done,cancelled)` · `is_blocking=eq.true` · `description=not.like.*[ITSM:*` · en-têtes : `apikey`, `Authorization: Bearer {{ $json.token }}` (annexe B) |
| **IF** | s'arrêter si la liste est vide |
| **HTTP Request** — création du ticket | l'API de votre ITSM (GLPI, ServiceNow, Jira). Corps : titre = `{{$json.business_ref}} — {{$json.title}}`, description = contexte + lien `{{$env.AIGMS_APP}}/admin/organizations/<org>/suivi?vue=actions&action={{$json.id}}#action-{{$json.id}}` |
| **HTTP Request** — marquer l'action | `PATCH {{$env.AIGMS_URL}}/rest/v1/action?id=eq.{{$json.id}}` · corps : `{"description": "{{$json.description}}\n\n[ITSM: {{ $node['Ticket'].json.id }}] ouvert le {{$now}} par n8n (exécution {{$execution.id}})"}` |

**Le retour de statut**, second workflow : un *Schedule* horaire lit les
tickets fermés chez l'ITSM, retrouve l'action par le marqueur `[ITSM: …]`,
et **n'écrit rien d'autre qu'un commentaire**. La clôture de l'action reste
un geste humain dans AIGMS : c'est elle qui libère le jalon de production.

> **Garde-fou.** Ne clôturez jamais l'action depuis n8n. Une action bloquante
> close, c'est une précondition de production levée : cela se décide.

**Recette** : créez une action de test bloquante, vérifiez le ticket, vérifiez
le marqueur dans la description, fermez le ticket, vérifiez le commentaire, et
vérifiez qu'AIGMS n'a **pas** clos l'action.

---

### Scénario 2 — Collecter une preuve technique chez un tiers et la déposer

*AIGMS ne se connecte à rien. Une preuve d'exploitation — journal
d'accès, extraction de configuration, rapport de vulnérabilité — se dépose
aujourd'hui à la main. C'est là que n8n libère le plus de temps.*

#### Dans AIGMS

1. **Registre des contrôles → un contrôle → « Avec quoi il se tient »** :
   retenez le produit employé (Outillage, migration 0088). C'est lui qui dit
   *où prendre la preuve*.
2. Notez le **`code`** du contrôle (ex. `CTL-09`) : n8n s'en servira.
3. Laissez le contrôle avec sa **fréquence de test** et sa date de prochain
   test : c'est le rythme que n8n suivra.

#### Dans n8n

| Nœud | Réglage |
|---|---|
| **Schedule Trigger** | mensuel, le 1er à 6 h |
| **HTTP Request** — source technique | l'API du produit (Azure, Entra, M365, SIEM…) : export, rapport, extraction |
| **Code** | mettre en forme un fichier lisible (CSV ou PDF), nommer `PREUVE-{{code}}-{{AAAA-MM}}` |
| **HTTP Request** — déposer le fichier | `POST {{$env.AIGMS_URL}}/storage/v1/object/evidence/<tenant>/<org>/<uuid>/<nom>` avec `Authorization: Bearer <jeton>` |
| **HTTP Request** — déclarer la preuve | `POST {{$env.AIGMS_URL}}/rest/v1/evidence` · corps : `tenant_id`, `organization_id`, `title`, `evidence_type: "document"`, `source: "n8n — <produit> (exécution {{$execution.id}})"`, `storage_bucket: "evidence"`, `storage_path`, `valid_until` (fin de la période couverte) |
| **HTTP Request** — rattacher au contrôle | `POST {{$env.AIGMS_URL}}/rest/v1/control_evidence` · corps : `tenant_id`, `control_id`, `evidence_id` |

**Ce qui se passe ensuite, tout seul** : la preuve arrive
`validation_status = pending`, et AIGMS **alerte l'AI Governance Officer**
(`evidence_to_validate`). Il vérifie pertinence, fraîcheur et périmètre, puis
valide. Tant qu'il n'a pas validé, le contrôle ne compte pas comme couvert.

> **Garde-fou.** Ne posez jamais `validation_status: "validated"` depuis n8n.
> Ce serait signer à la place de l'officer — et vider la couverture de son sens.

**Recette** : lancez une fois, vérifiez que la preuve apparaît au registre en
attente, que l'officer reçoit l'alerte, que le contrôle la montre, et que le
taux de couverture **ne bouge pas** avant validation.

---

### Scénario 3 — Faire signer une politique, et rapatrier la preuve

*La signature électronique est hors périmètre d'AIGMS. Le cycle
« document figé → signataires → relances → preuve » se conduit dehors et
revient en preuve.*

#### Dans AIGMS

1. **Registre des preuves → Déposer** : versez la politique approuvée,
   `evidence_type = document`, avec sa version. C'est **la version figée** :
   une nouvelle version = une nouvelle preuve, jamais un remplacement discret.
2. Rattachez-la au contrôle qu'elle démontre (ex. `AIGMS-GOV-001`, politique
   de gouvernance de l'IA).
3. Notez l'`id` de la preuve.

#### Dans n8n

| Nœud | Réglage |
|---|---|
| **Manual Trigger** ou **Webhook** | lancé par l'officer quand la campagne s'ouvre |
| **HTTP Request** — lire la politique | `GET {{$env.AIGMS_URL}}/rest/v1/evidence?id=eq.<id>&select=title,version,storage_path` |
| **HTTP Request** — télécharger le fichier | `GET {{$env.AIGMS_URL}}/storage/v1/object/evidence/<storage_path>` |
| **HTTP Request** — créer la transaction | API du service de signature (Yousign, DocuSign…), liste des signataires |
| **Wait** + **HTTP Request** | interroger l'état toutes les 24 h ; relancer **uniquement** les signataires dont l'état est incomplet |
| **HTTP Request** — preuve de campagne | à la fin : `POST /rest/v1/evidence` avec le rapport de transaction (qui a signé, quand, avec quel certificat), `source: "Campagne de signature <id externe> (n8n {{$execution.id}})"` |

**Ce qu'AIGMS n'a pas** : l'objet « campagne ». Le taux de complétion vit
chez le service de signature ; AIGMS garde **la politique** et **le rapport de
signature**, ce que demande un auditeur.

> **Garde-fou.** Une nouvelle version de la politique ouvre un nouveau cycle :
> ne réutilisez jamais la transaction précédente.

---

### Scénario 4 — Porter dans Teams ou Slack ce qui attend une décision

*Le courriel est natif (immédiat pour ce qui bloque, synthèse à la cadence de
chacun). Ce qui manque, c'est le canal d'équipe — là où les gens sont.*

#### Dans AIGMS

1. **Paramètres → Notifications** : chacun règle son courriel. n8n ne s'y
   substitue pas, il ajoute un canal.
2. Rien d'autre à configurer.

#### Dans n8n

| Nœud | Réglage |
|---|---|
| **Schedule Trigger** | toutes les 30 minutes, heures ouvrées |
| **HTTP Request** — décisions à statuer | `GET /rest/v1/governance_decision?select=business_ref,subject,decision_type,expected_approver:expected_approver_user_id(email,full_name),use_case:use_case_id(name)&status=eq.submitted` |
| **HTTP Request** — actions échues | `GET /rest/v1/action?select=business_ref,title,due_date,owner:owner_user_id(email)&status=not.in.(done,cancelled)&due_date=lt.{{$today}}` |
| **HTTP Request** — incidents ouverts | `GET /rest/v1/incident?select=business_ref,title,severity,status&status=neq.CLOSED` |
| **Code** | dédupliquer avec l'exécution précédente (n8n *Static Data*) : **ne poster que ce qui est nouveau** |
| **Microsoft Teams / Slack** | un message par destinataire, avec le lien direct vers l'objet |

> **Garde-fou.** Aucune action depuis le message : pas de bouton « Approuver ».
> Le lien conduit dans AIGMS, où l'acte est nominatif et tracé.

---

### Scénario 5 — Le contrôle de cohérence hebdomadaire

*Ce qu'aucune alerte ne dit, parce que ce n'est l'échéance de personne : un
risque sans contrôle, un contrôle sans preuve, un actif qu'aucun usage
n'emploie. Un auditeur, lui, le verra.*

#### Dans AIGMS

Rien à préparer. Tout se lit par l'API.

#### Dans n8n

| Nœud | Requête |
|---|---|
| **Schedule Trigger** | lundi 7 h |
| Cas d'usage sans responsable | `GET /rest/v1/ai_use_case?select=business_ref,name&owner_user_id=is.null&status=not.in.(RETIRED,REJECTED)` |
| Risques élevés ouverts sans traitement | `POST /rest/v1/rpc/attention_by_organization` → champ `high_risks_open` ; détail par `GET /rest/v1/risk?...` |
| Contrôles sans preuve | `POST /rest/v1/rpc/controls_awaiting_evidence` avec `{"p_organization_id":"<uuid>"}` |
| Actifs sans cas d'usage | `POST /rest/v1/rpc/asset_register` puis filtrer `use_cases` vide |
| Exigences sans décision (SoA) | `attention_by_organization` → `soa_undecided` |
| **Code** | assembler un rapport court, une ligne par écart, avec le lien vers l'objet |
| **Send Email** / **Teams** | à l'AI Governance Officer |
| **HTTP Request** *(optionnel)* | ouvrir **une** action par écart persistant depuis trois semaines : `POST /rest/v1/action` avec `source: "manual"`, `title`, `description` portant `{{$execution.id}}` |

> **Garde-fou.** N'ouvrez pas une action à chaque passage : l'écart doit
> persister. Sinon le registre se remplit de bruit, et plus personne ne le lit.

---

## 5. Catalogue d'idées, retrié par faisabilité

### Faisable aujourd'hui, sans développement

- Ticket ITSM depuis une action bloquante, et retour de statut *(scénario 1)*.
- Collecte de preuves techniques chez Azure, Entra, M365, SIEM *(scénario 2)*.
- Signature d'une politique et rapport de transaction *(scénario 3)*.
- Canal Teams/Slack pour les décisions à statuer *(scénario 4)*.
- Contrôle de cohérence hebdomadaire *(scénario 5)*.
- **Import de masse** après un atelier : `POST /rest/v1/rpc/import_use_cases`,
  `import_ai_assets`, `import_vendors` (compte d'administration requis).
- **Préparation d'un comité** : `POST /rest/v1/rpc/review_agenda` avec
  `{"p_organization_id":"<uuid>","p_since":"2026-07-01"}` → ordre du jour
  complet, à mettre en forme et à envoyer aux présents attendus.
- **Veille sur un portefeuille** : `attention_by_organization` pour toutes les
  organisations, et un message au consultant dès qu'un compteur franchit un seuil.
- **Export périodique** pour archivage : registre, journal, SoA (routes
  d'impression et d'export).

### Faisable, mais à faire avec discernement

- Créer une action depuis une alerte d'un outil externe (SIEM, supervision) :
  utile, à condition de qualifier humainement avant d'en faire un incident.
- Réconcilier un inventaire externe avec le registre des actifs : proposer les
  écarts, ne pas les appliquer.

### À ne pas faire

- Approuver une décision, accepter un risque, viser une étude d'impact, valider
  une preuve, franchir un jalon : la base les refuse, et c'est la raison d'être
  de la plateforme.
- Relancer par courriel sur des objets qu'AIGMS relance déjà (§1).
- Écrire dans le journal d'audit : il est *append-only* et alimenté par la base.

### Demande d'abord un développement

- **Webhook sortant** : passer de l'interrogation à l'événement (annexe D).
- **Campagnes de collecte** dans AIGMS : aujourd'hui, ce sont des actions une
  à une.
- **Rapport annuel consolidé** : huit impressions séparées existent.

---

## Annexe A — Le compte d'automatisation

1. **Administration → Comptes et rôles → Déclarer un compte**
   - adresse : `automation@<votre-domaine>` ;
   - nom : « Automatisation n8n » ;
   - rôle : **Porteur de l'IA** pour un usage de lecture et de dépôt de
     preuves ; **AI Governance Officer** seulement si les workflows doivent
     écrire des objets de gouvernance ;
   - organisation : celle sur laquelle les workflows agissent ;
   - **décochez « Notification par courriel »** : ce compte n'a pas de boîte.
2. Notez le mot de passe : il vivra dans les identifiants n8n, nulle part ailleurs.
3. **Vérifiez le principe de moindre privilège** : Comptes et rôles → matrice
   « Ce que chaque rôle peut faire ». Un compte qui n'a pas à écrire ne doit
   pas porter un rôle qui écrit.

> Les écritures de ce compte sont **nominatives au journal d'audit** :
> Administration → Journal, ou Journal de l'organisation, famille
> « Modifications ». C'est ce qui rend une preuve déposée par un robot
> opposable.

---

## Annexe B — Authentification dans n8n

### Les trois valeurs à poser

| Variable n8n | Valeur | Où la trouver |
|---|---|---|
| `AIGMS_URL` | `https://xahqdxwmlewyjpsiuzux.supabase.co` (préprod) | Supabase → Project Settings → API |
| `AIGMS_ANON_KEY` | la clé `anon` (publique, sans danger) | idem |
| `AIGMS_APP` | `https://demo.aigms.eu` ou l'URL de production | — |

Le mot de passe du compte d'automatisation se met dans les **Credentials** de
n8n, jamais dans un nœud.

### Le workflow d'authentification, à mettre en tête de chaque scénario

| Nœud | Réglage |
|---|---|
| **HTTP Request** — « Jeton » | `POST {{$env.AIGMS_URL}}/auth/v1/token?grant_type=password` · en-tête `apikey: {{$env.AIGMS_ANON_KEY}}` · corps `{"email":"automation@…","password":"…"}` |
| **Set** | conserver `access_token` |

Le jeton vaut **une heure**. Deux façons de faire : le redemander à chaque
exécution (le plus simple, recommandé), ou conserver `refresh_token` et
appeler `grant_type=refresh_token`.

Toute requête suivante porte **deux** en-têtes :

```
apikey: {{$env.AIGMS_ANON_KEY}}
Authorization: Bearer {{ $node["Jeton"].json["access_token"] }}
```

### Écrire : deux en-têtes de plus

```
Content-Type: application/json
Prefer: return=representation
```

`Prefer: return=representation` renvoie la ligne créée — c'est ainsi qu'on
récupère le `business_ref` engendré par la base (ACT-2026-0008…).

---

## Annexe C — Tables et fonctions utiles

### Lire (GET `/rest/v1/<table>`)

| Table | Ce qu'elle porte | Filtres utiles |
|---|---|---|
| `ai_use_case` | registre des usages | `status=eq.PRODUCTION`, `criticality=in.(high,critical)` |
| `risk` | risques cotés | `status=not.in.(accepted,mitigated,closed)` |
| `control` | contrôles opérationnels | `status=eq.operating` |
| `evidence` | preuves | `validation_status=eq.pending`, `valid_until=lt.<date>` |
| `action` | actions | `is_blocking=eq.true`, `due_date=lt.<date>` |
| `incident` | incidents | `status=neq.CLOSED` |
| `governance_decision` | décisions | `status=eq.submitted` |
| `vendor` | fournisseurs | `review_status=not.in.(approved,approved_with_conditions)` |
| `ai_asset` | actifs d'IA | `contains_personal_data=eq.true` |
| `notification` | alertes (les siennes) | `read_at=is.null` |

Jointures : `select=business_ref,owner:owner_user_id(email,full_name),use_case:use_case_id(name)`.

### Calculer (POST `/rest/v1/rpc/<fonction>`)

| Fonction | Paramètres | Rend |
|---|---|---|
| `attention_by_organization` | — | par organisation : risques élevés, preuves échues, actions en retard, incidents, revues dues, exigences sans décision |
| `governance_health` | `p_organization_id`, `p_activity_id` | indice 0–100 et causes nommées |
| `evaluate_gate` | `p_use_case_id`, `p_target` | les huit préconditions, satisfaites ou non, avec leur motif |
| `controls_awaiting_evidence` | `p_organization_id` | contrôles sans preuve valide |
| `evidence_matrix_gaps` | `p_organization_id` | typologies de preuves attendues et manquantes |
| `review_agenda` | `p_organization_id`, `p_since` | ordre du jour d'un comité |
| `review_cadence` | `p_organization_id` | cadence attendue selon criticité, rôle, taille |
| `impact_studies` | `p_organization_id` | études d'impact : exigée, conduite, achevée |
| `asset_register` | `p_organization_id` | actifs avec mesures et usages |
| `organization_tooling_map` | `p_organization_id` | outillage : familles et produits déclarés |
| `import_use_cases` · `import_ai_assets` · `import_vendors` | `p_organization_id`, `p_rows` (liste d'objets) | créés, mis à jour, signalements |
| `my_notifications` | `p_limit` | les alertes du compte connecté |

### Écrire (POST/PATCH `/rest/v1/<table>`)

Autorisé et utile : `action` (ouvrir), `evidence` + `control_evidence`
(déposer et rattacher), `incident` (déclarer depuis un signal externe),
`ai_asset`, `vendor`, commentaires dans `description`.

**Refusé par la base, et c'est voulu** : `ai_use_case.status` (passe par
`transition_use_case`), `governance_decision.status` vers approuvé (garde
d'approbation nominative), `risk.status = accepted` par un autre que le
responsable, `impact_assessment` signée par une seule personne, `audit_log`
(append-only).

---

## Annexe D — Ce qui manque, et la latence que cela impose

**Il n'existe pas de webhook sortant.** Conséquence directe : tout scénario
repose sur une interrogation périodique.

| Période | Latence moyenne | Appels par jour et par workflow |
|---|---|---|
| 5 minutes | 2,5 min | 288 |
| **15 minutes** | 7,5 min | **96** — recommandé |
| 1 heure | 30 min | 24 |
| Quotidien | 12 h | 1 |

Pour un incident à qualifier sous 24 heures ou un arrêt d'urgence, 15 minutes
suffisent largement : AIGMS envoie déjà un courriel **immédiat** sur ces
natures. n8n n'est pas le canal d'urgence.

**Ce qui changerait la donne** : une table `webhook_endpoint` et une
expédition depuis la route planifiée qui existe déjà (`/api/alertes/envoi`),
ou l'extension `pg_net`. Une à deux journées de développement. Les scénarios
deviendraient instantanés et les appels inutiles disparaîtraient. C'est une
décision de feuille de route, consignée dans
`03_Commercial/AIGMS_SERVICE_OFFER_VALIDATION_V1.md` (backlog P2).

---

## Annexe E — Recette et mise en service

Pour **chaque** workflow, avant activation :

1. **Sur un objet de test**, jamais sur un objet réel.
2. Vérifier le **déclencheur** : se lance-t-il ? à la bonne heure ?
3. Vérifier les **droits** : que se passe-t-il si le compte n'a pas le rôle ?
   (attendu : une erreur 401/403 explicite, pas un silence).
4. Vérifier le **comportement en erreur** : l'ITSM ne répond pas — le workflow
   s'arrête-t-il proprement sans laisser AIGMS dans un état incohérent ?
5. Vérifier l'**idempotence** : relancer deux fois ne doit pas créer deux
   tickets, deux preuves, deux actions.
6. Vérifier la **trace** : l'identifiant d'exécution figure-t-il dans l'objet
   AIGMS ? Le journal d'audit le montre-t-il ?
7. Vérifier l'**arrêt** : quand l'objet est soldé, le workflow cesse-t-il de
   le traiter ?

**Critère de réussite** : depuis AIGMS seul, on peut reconstituer ce qui a
déclenché l'action, qui devait décider, ce qui a été exécuté, avec quel
résultat, quelle preuve a été conservée — et par quel workflow.
