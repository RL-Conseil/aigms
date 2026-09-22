# Notifications par courriel

*25 septembre 2026 — migrations 0085 et 0086. Voir aussi `ALERTES.md`, qui
recense qui est prévenu de quoi.*

« Mes alertes » suppose qu'on ouvre la plateforme. Un responsable d'action qui
ne s'y connecte pas n'apprend rien. Le courriel va chercher la personne là où
elle est — sans jamais transporter de secret : un intitulé, une échéance, un
lien.

## Ce qui part

| Quand | Quoi | Pour qui |
|---|---|---|
| Au passage suivant de la tâche planifiée | **Ce qui ne peut pas attendre** : arrêt d'urgence recommandé, incident à qualifier sous 24 h, clôture d'incident à signer, décision à statuer, jalon bloqué, criticité dépassée par les faits, preuve échue | la personne concernée, une fois (`emailed_at`) |
| À la cadence de chacun | **La synthèse** : actions ouvertes et échues, incidents à faire avancer, alertes non lues, par organisation, avec les liens qui conduisent à la ligne exacte du suivi | les personnes qui l'ont demandée et qui ont quelque chose à faire avancer |

Une alerte qui n'a pas pu partir reste lisible dans « Mes alertes » et
repartira au passage suivant : **l'envoi est une commodité, jamais un point de
passage.**

## Qui règle quoi

- **Chacun**, dans *Paramètres › Notifications* : courriel activé ou non,
  envoi immédiat de ce qui ne peut pas attendre, cadence de la synthèse
  (chaque jour, chaque semaine, aucune). L'écran montre ce que la prochaine
  synthèse dirait.
- **L'administration**, à la déclaration du compte (case « Notification par
  courriel ») et ensuite depuis *Comptes et rôles* — un bouton par compte dit
  d'un coup d'œil si le courriel est actif.
- Sans ligne de préférence, la règle par défaut s'applique : **courriel
  activé, synthèse quotidienne**.

## Configuration du déploiement

Trois variables d'environnement, jamais dans le code :

| Variable | Rôle |
|---|---|
| `RESEND_API_KEY` | clé du service d'envoi |
| `SYSTEM_EMAIL_FROM` | adresse d'expédition |
| `CRON_SECRET` | secret partagé avec la tâche planifiée |

La tâche est déclarée dans `vercel.json` : `GET /api/alertes/envoi`, chaque
jour à 7 h (UTC). Vercel y joint `Authorization: Bearer $CRON_SECRET` ; la
route refuse tout appel qui ne le porte pas. Elle lit la base avec la clé de
service — les fonctions d'envoi (`notifications_to_email`,
`digest_recipients`, `mark_*`) sont **refusées à tout rôle authentifié**, un
test le vérifie.

*Paramètres › Courrier sortant* (administration) dit si tout est posé, quelle
est l'adresse d'expédition et si la tâche est planifiée. Aucune clé n'y est
lisible ni modifiable.

Un autre transport (SMTP d'entreprise) se branchera derrière
`sendSystemEmail` sans toucher aux appels.
