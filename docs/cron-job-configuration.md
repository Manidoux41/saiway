# SAIWAY : configuration et audit cron-job.org

## Audit du backend

Les deux routes sont des Route Handlers Next.js en runtime Node.js, avec une
durée maximale déclarée de 60 secondes. La méthode d'exécution est **GET**.
Elles ne dépendent d'aucun cookie ni session utilisateur.

| Tâche | Fichier | URL de production |
|---|---|---|
| Push Retry | [route.ts](../app/api/cron/push-notifications/route.ts) | `https://saiway.vercel.app/api/cron/push-notifications` |
| GPS Cleanup | [route.ts](../app/api/cron/driver-location-retention/route.ts) | `https://saiway.vercel.app/api/cron/driver-location-retention` |

[cron-auth.ts](../lib/cron-auth.ts) vérifie l'en-tête `Authorization: Bearer …`
avec `CRON_SECRET`, une longueur identique et `timingSafeEqual`. Un secret absent,
incorrect, envoyé sans préfixe Bearer, ou envoyé dans l'URL ne donne aucun accès.
L'authentification est vérifiée avant la lecture des paramètres et de la base.
`CRON_API_KEY` et `INTERNAL_API_SECRET` **ne sont pas utilisés** : ne pas les ajouter.

Aucun middleware/proxy global n'est présent dans le projet. Aucun middleware de
session n'entoure ces routes. Les tests publics du 7 novembre 2026 ont reçu
`401`, `Content-Type: application/json`, `Cache-Control: no-store` et
`{"error":"Unauthorized"}` sur les deux routes, sans redirection. Le refus observé
provient donc du backend, pas d'une page de connexion Vercel.

Cela ne prouve pas lequel de ces problèmes de configuration est présent :
en-tête absent/mal formé, secret différent dans cron-job.org et Vercel, variable
Production absente ou ancien déploiement qui ne contient pas sa dernière valeur.
La présence locale du secret ne prouve pas sa présence dans Vercel Production.

Les traitements utilisent Prisma/PostgreSQL. Push Retry dépend également de la
configuration VAPID et des fournisseurs Web Push. GPS Cleanup dépend de
`SystemSetting.gpsRetentionEnabled` et de la politique de conservation de 30 jours.
Aucun service Supabase ni Vercel Cron n'est nécessaire. [vercel.json](../vercel.json)
ne contient aucune tâche Cron. Vercel Hobby conserve ses quotas ordinaires ;
cron-job.org ne nécessite pas d'abonnement Pro.

## Variables exactes dans Vercel

Toutes les valeurs secrètes sont configurées **côté serveur uniquement**.
Ne jamais créer de variante `NEXT_PUBLIC_` de ces secrets.

| Variable | Utilité | Si absente | Environnements Vercel | Redéploiement |
|---|---|---|---|---|
| `CRON_SECRET` | Autorise les deux tâches | Générer 32 octets aléatoires ; même valeur privée dans les deux en-têtes cron-job.org | Production ; Preview seulement si ce déploiement est volontairement testé, avec secret distinct | Oui |
| `DATABASE_URL` | Connexion PostgreSQL pour Prisma/migrations et repli applicatif | Utiliser la connexion existante, ne pas générer une nouvelle base | Production ; base isolée pour Preview | Oui |
| `PRISMA_DATABASE_URL` | Connexion applicative prioritaire, facultative | Laisser absent/vide pour utiliser `DATABASE_URL` ; sinon connexion à la même base | Production ; base isolée pour Preview | Oui |
| `VAPID_PUBLIC_KEY` | Clé publique de Push | Générer une paire seulement si aucune paire valide n'existe | Production ; paire de test pour Preview | Oui |
| `VAPID_PRIVATE_KEY` | Signature serveur de Push | Partie privée de la même paire, ne pas la divulguer ni régénérer à chaque déploiement | Production ; paire de test pour Preview | Oui |
| `VAPID_SUBJECT` | Contact VAPID | Une URL HTTPS ou `mailto:` valide choisie par l'opérateur | Production ; Preview si Push testé | Oui |

`AUTH_SECRET` reste nécessaire pour les sessions de l'application, mais **n'est pas
utilisé pour authentifier les deux tâches**. Les paramètres PayWay, cartographie
et `NEXT_PUBLIC_APP_URL` ne sont pas requis par ces Route Handlers.

Pour générer `CRON_SECRET` **uniquement s'il manque**, dans votre terminal privé :

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Conserver sa valeur dans Vercel **Production** et dans les deux tâches, sans
guillemets ajoutés, sans crochets ni chevrons et sans retour à la ligne.
Si une valeur existe déjà, la réutiliser plutôt que la changer inutilement.
Pour une paire VAPID manquante :
`node scripts/setup-push.mjs https://saiway.vercel.app`.
Cette commande écrit les clés localement sans les imprimer ; les reporter
privément dans Vercel et préserver toute paire existante.

## Paramètres à copier dans cron-job.org

| Paramètre | Push Retry | GPS Cleanup |
|---|---|---|
| Titre | `SAIWAY - Push Retry` | `SAIWAY - GPS Cleanup` |
| URL | `https://saiway.vercel.app/api/cron/push-notifications` | `https://saiway.vercel.app/api/cron/driver-location-retention` |
| Méthode | `GET` | `GET` |
| Fuseau | `Asia/Phnom_Penh` | `Asia/Phnom_Penh` |
| Fréquence | Chaque minute : `* * * * *` | Chaque jour à 03:00 : `0 3 * * *` |
| En-tête : nom | `Authorization` | `Authorization` |
| En-tête : valeur | `Bearer VOTRE_VALEUR_CRON_SECRET` | `Bearer VOTRE_VALEUR_CRON_SECRET` |
| Corps | Aucun | Aucun |
| Basic Auth | Désactivée | Désactivée |
| Succès | `200`, `configured: true`, compteurs `sent`, `failed`, `removed` | `200`, compteur `removed`, ou `skipped: true` si purge suspendue |

`VOTRE_VALEUR_CRON_SECRET` est une indication à remplacer, **pas** le texte à
saisir. Le nom d'en-tête est `Authorization` ; ne pas le placer dans le corps
ou dans le champ du mot de passe Basic Auth. `Content-Type` n'est pas nécessaire.
Une planification UTC équivalente pour GPS Cleanup est `0 20 * * *` :
03:00 au Cambodge correspond à 20:00 UTC la veille, sans changement saisonnier.

Activer les alertes d'échec, de reprise et de désactivation du planificateur.
Une réponse `200` avec `failed > 0` signifie que des erreurs individuelles Push
ont été traitées et conservées selon la politique de reprise, pas que tous les
appareils ont reçu leur notification. Une configuration Push absente/invalide
ou une défaillance de traitement/base retourne `503`. Un secret absent/incorrect
retourne `401`. Un paramètre de requête inconnu ou invalide retourne `400`.
Les autres méthodes d'exécution comme `POST` ne sont pas prises en charge (`405`).

## Vérification sans effets de bord

Les deux routes acceptent **après authentification** `?dryRun=true`.

- Push : vérifie VAPID et compte les livraisons dues, sans envoi, incrément
  d'essai, verrou ni suppression d'historique.
- GPS : compte les points admissibles, sans suppression ; le bouton administrateur
  de suspension reste respecté.
- `HEAD` est explicitement implémenté : vérifie uniquement le Bearer et n'exécute
  pas le traitement. Il ne vérifie pas la base ni VAPID.
- `OPTIONS` annonce le support de simulation sans accès aux données ni secret.

Déployer cette version **avant** de tester avec des credentials valides :
les anciennes versions peuvent ignorer `dryRun` et exécuter réellement la tâche.
La commande ci-dessous vérifie d'abord la présence du marqueur de support,
puis teste les cas sans secret, mauvais secret et bon secret en simulation :

```bash
node scripts/check-cron.mjs https://saiway.vercel.app
```

Le script lit `CRON_SECRET` dans l'environnement local ; sa valeur doit correspondre
à Vercel Production. Ne pas la passer comme argument CLI. Il refuse les
redirections et les anciennes versions, ne journalise pas les secrets et sort
avec un code non nul si la vérification échoue. Il ne configure ni ne déploie
aucun service externe.

Dans cron-job.org, vérifier une fois avec `?dryRun=true`, puis enlever ce paramètre
pour les deux tâches réelles. Ne pas conserver la simulation sur le job quotidien
en pensant que les anciennes données sont supprimées.

## Idempotence et conservation

- Push : file persistante, unicité appareil/événement, réclamation conditionnelle,
  bail de 60 s, reprise des verrous abandonnés, backoff et expiration conservés.
  Les erreurs individuelles enregistrent des identifiants/statuts, pas les tokens.
  Un envoi accepté juste avant un crash peut être réessayé ; le tag identique
  remplace la carte de notification. Une garantie physique « exactement une fois »
  n'est pas possible auprès d'un fournisseur externe.
- GPS : seuls les points dont `recordedAt` est strictement antérieur à
  l'heure courante moins 30 jours sont supprimés. Les données récentes/futures,
  les courses, paiements et utilisateurs ne sont pas supprimés. Les appels
  répétés ne suppriment pas de points récents. La purge suspendue ne supprime rien.
- Les erreurs globales des endpoints sont journalisées sans en-tête, secret,
  URL de connexion ni message d'erreur susceptible de contenir des credentials.

## Modifications et état opérationnel

- Routes : ajout de simulation, validation stricte des paramètres, HEAD sans
  traitement, OPTIONS de détection et réponses d'erreur non mises en cache.
- Comparaison Bearer existante préservée, aucune suppression d'authentification.
- Script [check-cron.mjs](../scripts/check-cron.mjs) et tests de non-régression.
- Aide administrateur EN/FR/KM et README alignés sur 03:00 au Cambodge.
- **Aucune migration nouvelle**, aucune modification de base de production.

### Fichiers créés ou modifiés

- [cron-auth.ts](../lib/cron-auth.ts).
- [Push Retry](../app/api/cron/push-notifications/route.ts) et
  [GPS Cleanup](../app/api/cron/driver-location-retention/route.ts).
- [check-cron.mjs](../scripts/check-cron.mjs), créé pour le contrôle opérateur.
- [admin-copy.ts](../components/i18n/admin-copy.ts) et [README](../README.md).
- Tests : [cron-auth](../tests/cron-auth.test.mjs),
  [check-cron](../tests/check-cron.test.mjs), [cron-management](../tests/cron-management.test.mjs),
  [cron-recovery](../tests/cron-recovery.test.mjs).
- Ce compte rendu.

### Résultats du 7 novembre 2026

| Vérification | Résultat |
|---|---|
| GET public sans secret, deux URLs de production | `401`, JSON backend ; aucune purge/envoi déclenché |
| GET public avec Bearer volontairement invalide, deux URLs | `401` |
| Script opérateur sur production | Arrêt sécurisé, code 1 : support dry-run non encore déployé ; aucun appel avec le secret valide |
| Authentification, script opérateur, reprise Push et purge GPS sur base locale isolée | 10 tests réussis, zéro échec/ignoré, code 0 |
| Traductions EN/FR/KM et réglage de conservation | 7 tests réussis, code 0 |
| Script opérateur sur serveur réel local isolé | Deux routes PASS : mauvais/sans secret refusés, bon secret en simulation `200`, code 0 |
| Build de production final, ESLint, TypeScript | Réussis, code 0 |
| Build final démarré sans transport simulé, contrôle opérateur et méthodes HTTP | Réussis, code 0 ; `400` paramètres invalides, `401` HEAD anonyme, `200` HEAD valide, `405` POST |

Les tests de reprise utilisent une file persistante PostgreSQL et un transport
Web Push volontairement simulé : aucun push de test envoyé à un fournisseur réel.
La purge réelle a été testée **uniquement sur une base locale jetable**, en
vérifiant conservation des données récentes, suspension, simulation et répétition.
La réception physique des notifications par le système du téléphone n'est pas
prouvée par ces tests.

Environnement : Node.js v26.13.0, Docker indisponible ; PostgreSQL 18 natif utilisé
avec une base isolée et les deux URLs Prisma explicitement remplacées. Le build
final utilise les paramètres de fournisseurs normaux. Aucun changement de mise
en page : les libellés d'horaire sont vérifiés par les tests de traduction, pas
par un nouveau parcours navigateur. Le serveur de validation a été arrêté et la
base, les clés et les journaux jetables ont été supprimés.

La configuration privée Vercel/cron-job.org et le redéploiement restent à effectuer
par l'opérateur : aucun accès connecté à ces services n'est disponible dans cette
session. La valeur de Production n'a pas pu être comparée au secret local. Un
succès authentifié en production **n'est donc pas encore vérifié**.
Ne pas déclarer les jobs réparés tant que leur dernière exécution n'est pas `200`
après alignement des credentials et redéploiement.
