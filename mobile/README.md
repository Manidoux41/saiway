# SAIWAY mobile

Application React Native / Expo SDK 58 pour Android et iOS. Un seul binaire, avec
un espace client ou chauffeur selon le rôle retourné par l'API Next.js existante.
Il n'y a pas de serveur mobile ni de base de données supplémentaire.

## Démarrage

Depuis la racine du dépôt, démarrer l'API :

```bash
npm run dev -- --hostname 0.0.0.0
```

Dans un second terminal :

```bash
cd mobile
npm ci
cp .env.example .env
# Renseigner EXPO_PUBLIC_API_URL dans .env avant de démarrer Expo.
npm start
```

Ouvrir avec Expo Go SDK 58 sur un téléphone, ou utiliser `npm run ios` /
`npm run android` avec un simulateur/émulateur installé. Après une modification
de l'environnement, redémarrer Expo avec `npx expo start --clear`.

`npm run web` affiche uniquement une page d'ouverture de l'application native :
aucun formulaire de connexion, accès SecureStore ni appel API n'est lancé dans
le navigateur. Le bouton « Ouvrir SAIWAY » utilise le schéma `saiway://` d'un
binaire installé. En développement, le bouton Expo Go reprend l'adresse du
serveur Expo ouvert dans le navigateur. Depuis un ordinateur, scanner plutôt
le QR code du terminal sur le téléphone. Pour l'interface web, utiliser le lien
vers le site Next.js existant.

### Quelle URL utiliser ?

`EXPO_PUBLIC_API_URL` est **l'origine de Next.js**, sans suffixe `/api`, sans
identifiants, paramètres ni chemin. Ce n'est pas l'adresse du serveur Metro Expo.

| Environnement | Exemple |
| --- | --- |
| Téléphone physique | `http://192.168.1.111:3000` (remplacer par l'IP Wi-Fi actuelle du Mac) |
| Simulateur iOS sur le Mac | `http://localhost:3000` ou l'IP Wi-Fi du Mac |
| Émulateur Android standard | `http://10.0.2.2:3000` |
| Production | `https://votre-domaine-saiway.example` |

Le `.env` Next.js utilise `NEXT_PUBLIC_APP_URL=http://localhost:3000`. Un téléphone
ne peut pas utiliser cette adresse : son `localhost` désigne le téléphone.
Téléphone et Mac doivent être sur le même réseau ; autoriser le port 3000 dans
le pare-feu. L'adresse locale peut changer lorsque le réseau change.

Le fichier mobile `.env` est ignoré par Git. Ne jamais y copier `DATABASE_URL`,
`AUTH_SECRET`, les clés PayWay, VAPID ou d'autres secrets Next.js : les variables
`EXPO_PUBLIC_*` sont intégrées au binaire et sont publiques.

HTTP n'est accepté qu'en mode développement. Un export/release nécessite une
origine HTTPS et les réglages PayWay existants restent ceux du serveur.

## Parcours disponibles

- Connexion client/chauffeur, inscription client particulier ou professionnel ;
  les chauffeurs sont créés par l'administration, les professionnels restent
  soumis à l'approbation existante.
- Client : réservation aéroport/ville/hôtel/privé/excursion, sélection GPS ou
  carte, adresses récentes, devis serveur, passagers/bagages/vol/instructions,
  paiement en ligne ou chauffeur, annulation autorisée, historique, suivi et reçu.
- Invité sans compte : commande à la position GPS, suivi, annulation et nouvelle
  demande après clôture, avec session indépendante conservée sur l'appareil.
- Chauffeur : planning et recherche, disponibilité et véhicule, acceptation /
  départ / arrivée / démarrage / clôture, navigation et contacts passager,
  course immédiate avec devis signé et prix convenu hors zone, compteur invité,
  confirmation explicite du repli routier si le GPS est incomplet, correction
  autorisée du prix d'un compteur clôturé, encaissement ou déclaration non reçue.
- Chauffeur : déclaration carburant USD/KHR avec identifiant anti-doublon,
  historique des dépenses, bulletins finalisés/payés et partage PDF, photos du
  permis, QR WhatsApp/Telegram, QR ABA et changement du mot de passe.
- Profil client, statut professionnel et liens vers l'aide et les pages légales.

## Langues

Le sélecteur **Français / English / ខ្មែរ** est présent en haut de chaque écran,
avant et après connexion, y compris le parcours invité et la page web d'ouverture.
Le choix s'applique immédiatement sans déconnexion ni remise à zéro des formulaires.
Il est conservé sur l'appareil (SecureStore natif, stockage local sur la page web)
et reste indépendant du compte. Le français est utilisé à la première ouverture.
Une erreur de lecture ou d'enregistrement de ce choix est affichée.

Les interfaces client, chauffeur et invité, les onglets, formulaires, validations,
confirmations, statuts, contrôles publicitaires et libellés d'accessibilité sont
traduits en anglais et en khmer. Les dates et devises utilisent la langue choisie ;
les heures restent au Cambodge (UTC+7) et les valeurs envoyées à l'API restent ISO
et non traduites. Les noms, adresses, instructions des utilisateurs et contenus
publicitaires restent ceux du serveur. Les erreurs API connues sont traduites ;
un nouveau message serveur inconnu est conservé tel quel pour ne pas le masquer.
Les dialogues de permission et les interfaces système suivent la langue du système,
pas nécessairement celle choisie dans SAIWAY.

Les traductions sont dans `src/lib/translations.ts`. Le français sert de clé ;
chaque entrée doit contenir l'anglais et le khmer avec les mêmes paramètres.
Le formatage et les notes d'historique utilisent des copies générées des trois
helpers purs du site dans `src/lib/shared/`, sans modifier Next.js.
Le mobile ne dépend d'aucun dossier parent au moment du build.
Depuis `mobile/`, lancer `npm run sync:shared` après une modification de
`lib/locale-format.ts`, `components/i18n/booking-history-note.ts` ou
`components/i18n/interface-copy.ts` du site, puis versionner les copies générées.
`node scripts/sync-shared.mjs --check` vérifie leur conformité dans le dépôt.
Ne pas lancer cette synchronisation sur EAS : les copies sont déjà incluses.
Le repli khmer des moteurs Intl incomplets et les observations libres sont conservés.
Les tests vérifient les clés, les paramètres, les formats et l'absence de textes
statiques non traduits dans les écrans actifs. Une relecture par un locuteur khmer
est recommandée avant diffusion sur les stores.

## Informations légales

Une page publique accessible depuis la connexion et le compte regroupe les liens
vers les conditions, la confidentialité, l'annulation et le contact existants.
Les documents s'ouvrent sur le site Next.js, qui propose déjà ces pages et leurs
traductions. Les nouvelles mentions de propriété ne sont pas publiées tant que
le texte officiel, l'identité juridique, le rôle du directeur et l'adresse
professionnelle ne sont pas validés. Aucune adresse privée n'est déduite.

## Thème et publicités

Le mobile reprend le bleu `#032EA1`, le rouge `#E00025`, le logo SAIWAY Transfer
et les illustrations Angkor du site. Le paysage est local (disponible hors réseau),
avec un voile clair et des cartes semi-transparentes pour conserver la lisibilité.
Les PNG sont générés depuis les SVG et tracés existants, sans image distante.
Pour les régénérer après une évolution de la marque, avec les dépendances racine
installées : `node mobile/scripts/generate-brand-assets.mjs` depuis la racine.

Les campagnes de l'administration existante alimentent les popups via
`/api/advertising?placement=HOME|BOOKING|DRIVER` :

- HOME : connexion et accueil client ; BOOKING : réservation client ;
  DRIVER : accueil chauffeur uniquement.
- Une popup fermable par emplacement et par session de l'application/compte,
  ouverte uniquement après un appui sur « Voir une offre partenaire ». Aucun
  affichage automatique ni interruption inattendue. La reprise d'un écran ne
  réaffiche pas un emplacement déjà présenté.
- Aucune popup dans une course, une commande invité, une course immédiate, les
  finances ou les documents. Aucune publicité chauffeur dès qu'une course est
  acceptée/en route/arrivée/démarrée, ni si l'état des courses ne peut être vérifié.
- L'ordre et l'éligibilité des campagnes viennent du serveur. Rafraîchissement
  toutes les 60 secondes au premier plan ; les campagnes expirées disparaissent.
  Une absence de campagne ne produit pas de popup de démonstration.
- Liens partenaires HTTPS sans identifiants, ouverture uniquement sur action
  explicite. Les erreurs de liens/images sont visibles ; une panne du service
  publicitaire est journalisée sans bloquer la réservation.

La popup native réutilise les campagnes existantes sans changer leur présentation web.

## Sessions et limites

- L'API existante authentifie avec `saiway_session`. `expo/fetch` lit le
  `Set-Cookie` natif, le cookie est conservé dans SecureStore et envoyé
  explicitement à la seule origine configurée. Aucun mot de passe n'est stocké.
- La session invité `saiway_guest_ride` utilise un stockage sécurisé séparé.
  Changer d'origine API invalide le stockage local correspondant.
- Les données métier ne sont pas mises en cache hors ligne. Les erreurs sont
  affichées ; une session refusée (401/403) au démarrage est supprimée du stockage
  sécurisé pour permettre une nouvelle connexion. Une erreur réseau conserve la
  session et propose de réessayer.
- Le paiement s'ouvre dans le navigateur système, uniquement sur les domaines
  PayWay autorisés. Revenir dans l'application et utiliser « Vérifier le
  paiement » si nécessaire ; seul le serveur confirme l'encaissement.
- Le suivi utilise les mêmes endpoints et un rafraîchissement de 5 à 15 secondes,
  suspendu lorsque l'application passe en arrière-plan.
- Le GPS chauffeur nécessite un consentement explicite et un service autorisé
  par le serveur. Il s'arrête en arrière-plan et à la déconnexion. **Garder
  l'application ouverte pendant une course au compteur** ; le service ne
  garantit pas une facturation GPS continue téléphone verrouillé.
- Les notifications natives utilisent la file existante du backend, après la
  migration et la configuration décrites ci-dessous. Le Web Push reste inchangé.
- Le changement de mot de passe client n'est pas exposé par l'API actuelle.
- Le navigateur web n'est pas une cible de ce projet : utiliser Next.js pour le web.

## Builds natifs

`app.json` contient les identifiants `com.saiway.app` et le schéma `saiway`.
Confirmer les identifiants auprès du propriétaire des comptes Apple/Google avant
publication. `eas.json` fournit des profils preview et production.
La signature, les comptes stores et les builds de distribution restent à configurer.

## Notifications natives Android et iOS

Dans **Mon compte → Notifications de mes courses**, l'utilisateur lit l'explication
avant de demander la permission, puis peut désactiver ou tester les notifications.
Le serveur reprend les mêmes événements et destinataires que le Web Push :
confirmation de réservation et arrivée pour le client, attribution pour le
chauffeur. Aucun nouveau suivi GPS en arrière-plan n'est activé.

### Déploiement obligatoire

1. Tester une sauvegarde et appliquer la migration additive
   `20261111090000_native_push` avec `npx prisma migrate deploy` depuis la racine.
   **Ne pas déployer le nouveau backend avant cette migration.**
2. Garder les clés VAPID existantes pour le web. Dans l'environnement **serveur
   uniquement**, ajouter `NATIVE_PUSH_ENABLED=true` et `EXPO_PUSH_ACCESS_TOKEN`.
   Activer aussi la sécurité renforcée du Push Service dans les paramètres Expo
   du projet et créer le jeton autorisé correspondant. Ne jamais utiliser un
   nom `EXPO_PUBLIC_*` pour ce secret.
3. Android : enregistrer `com.saiway.app` dans Firebase et récupérer son
   `google-services.json`. Sur EAS, créer une variable **de type fichier**
   `GOOGLE_SERVICES_JSON` contenant ce fichier, dans l'environnement du profil
   utilisé. `app.config.js` référence le chemin fourni. En local, définir cette
   variable vers un fichier privé existant.
4. Configurer séparément la **clé de service FCM v1** avec
   `eas credentials --platform android`, rubrique Push Notifications. Ne pas
   confondre cette clé serveur avec `google-services.json`. Ne versionner aucun
   fichier de clé. Firebase est requis pour les push Android, **pas pour les
   cartes Leaflet** : aucune clé Google Maps n'est nécessaire.
5. iOS : configurer la clé APNs et le provisioning pour `com.saiway.app` avec
   `eas credentials --platform ios`. Le plugin notifications ajoute l'entitlement
   APNs ; vérifier sa valeur et le profil dans le binaire distribué.
6. Déployer l'API puis reconstruire et installer les binaires Android/iOS.
   Expo Go ne valide pas les push distants de cette application. Une ancienne
   APK ne reçoit pas les nouveaux modules natifs par simple rechargement Metro.
7. Conserver la tâche existante `/api/cron/push-notifications` chaque minute avec
   son `CRON_SECRET` : retries, reçus Expo après 15 minutes et purge après sept
   jours d'expiration. Un ticket « accepté » n'est pas une preuve de réception
   sur téléphone.

Le jeton est lié au compte et à l'origine API dans SecureStore. La langue et les
changements de jeton sont synchronisés au premier plan. Désactivation et
déconnexion authentifiée suppriment l'inscription de cet appareil. Un appui sur
une alerte ne peut ouvrir qu'une course validée pour le compte courant ; aucun
lien externe du payload n'est exécuté.

Tester sur **deux appareils réels**, client et chauffeur : permission refusée,
activation, réservation/attribution/arrivée, application en arrière-plan puis
fermée normalement, ouverture de la bonne course, changement de langue,
désactivation et déconnexion. Sous Android, un **arrêt forcé dans les réglages**
bloque généralement les push jusqu'à la réouverture ; réseau, batterie et modes
de concentration peuvent retarder les alertes. Ne jamais garantir leur livraison.

## Suppression de compte et Google Play

Le compte propose une demande avec confirmation et mot de passe courant. Une
référence est enregistrée, sans annoncer une suppression immédiate. La procédure
externe publique est `/account-deletion` sur le site ; elle utilise le contact
public défini dans l'administration et permet une demande par email sans APK.
Les administrateurs consultent les demandes dans **Comptes → Demandes de
suppression**. Ils doivent réellement vérifier et traiter les demandes, révoquer
les sessions/push, supprimer ou anonymiser les données non nécessaires et
répondre au demandeur. Clôturer une demande enregistre le traitement et l'audit :
**ce bouton ne réalise pas l'effacement**. Une suppression physique du compte
supprime aussi sa demande liée. Ne pas recopier des données sensibles dans la
résolution ; justifier précisément les seuls documents légalement conservés.

Avant soumission, le propriétaire doit encore :

- Finaliser l'identité juridique, le contact, les durées de conservation et les
  exceptions dans `/privacy` et `/mobile-privacy` : le texte actuel reste un
  **brouillon, pas une politique prête pour les stores**.
- Déployer et vérifier les URL publiques de confidentialité et de suppression,
  puis les renseigner dans Play Console. Garantir un traitement effectif des
  demandes ; une simple page sans traitement ne suffit pas.
- Remplir **Data safety** selon les flux réels : compte/contact, réservations,
  position précise chauffeur au premier plan, documents/photos choisis,
  identifiants de notifications, paiements et prestataires Expo/FCM/APNs,
  cartographie/CDN/recherche/itinéraires, hébergeur et PayWay. Vérifier aussi les
  SDK présents dans le binaire. Les offres partenaires impliquent « contient
  des annonces » même sans identifiant publicitaire.
- Produire le profil production **AAB**, avec une clé d'upload privée et Play
  App Signing ; l'APK preview et la signature locale de test ne conviennent pas.
  Vérifier la cible API exigée au jour du dépôt, les architectures 64 bits, la
  compatibilité des bibliothèques natives avec les pages mémoire **16 Ko**, et
  le manifeste fusionné du binaire final.
- Les permissions galerie étendue, caméra, micro, localisation en arrière-plan,
  superposition et identifiant publicitaire sont bloquées dans la configuration.
  Les photos passent par le sélecteur système. Tester ce sélecteur et le GPS
  sur le binaire réel ; l'introspection de configuration n'est pas une validation
  du manifeste Gradle fusionné.
- Fournir les captures, classification du contenu, public cible, coordonnées et
  vérification du développeur ; renseigner l'accès des examinateurs avec des
  comptes client et chauffeur fonctionnels. Pour les comptes personnels
  concernés, prévoir le test fermé requis (12 testeurs pendant 14 jours
  consécutifs avant la demande d'accès à la production).
- Conserver PayWay pour le service de transport physique ; ne pas présenter
  l'application comme vendant des biens numériques via ce paiement.

Références : [données utilisateur et confidentialité](https://support.google.com/googleplay/android-developer/answer/10144311),
[suppression des comptes](https://support.google.com/googleplay/android-developer/answer/13327111),
[Data safety](https://support.google.com/googleplay/android-developer/answer/10787469),
[cible API](https://support.google.com/googleplay/android-developer/answer/11926878),
[tests fermés](https://support.google.com/googleplay/android-developer/answer/14151465).
Ces corrections réduisent les risques techniques ; elles ne garantissent pas
l'acceptation Google, qui dépend aussi des déclarations et du binaire soumis.

### APK autonome locale, sans Expo Go ni EAS

Installer Java 21 et le SDK Android (plateforme API 37.0, build-tools 37.0.0,
NDK 27.1.12297006 et CMake 3.22.1). Configurer `ANDROID_HOME` avec son chemin.
Depuis `mobile/`, générer le projet natif si `android/` est absent :

```bash
EXPO_PUBLIC_API_URL=https://saiway.vercel.app \
  npx expo prebuild --platform android --no-install
cd android
NODE_ENV=production EXPO_PUBLIC_API_URL=https://saiway.vercel.app \
  ./gradlew app:assembleRelease --init-script ../scripts/android-low-memory.gradle \
  -PreactNativeArchitectures=arm64-v8a -Pkotlin.compiler.execution.strategy=in-process \
  --max-workers=1 --no-parallel --no-daemon
```

La compilation est locale avec Gradle : aucun compte Expo, envoi de code à EAS
ou serveur Metro au démarrage de l'APK n'est nécessaire. Le générateur et le
bundler locaux restent ceux du projet Expo existant ; ce n'est pas une migration
vers un projet sans modules Expo.
Le script Gradle limite la compilation C++ à deux tâches et les liens à une tâche,
pour limiter la pression mémoire pendant la première compilation.

Le fichier produit est `android/app/build/outputs/apk/release/app-release.apk`.
Cette commande cible les téléphones Android ARM64 et utilise la signature de
test du projet natif généré : ne pas publier cette APK sur Google Play.
Une publication nécessite une clé de signature privée dédiée.

### Cartes Leaflet

Android et iOS utilisent Leaflet 1.9.4 dans `react-native-webview`, avec les
tuiles OpenStreetMap et leur attribution visible, sans clé Google Maps.
Les marqueurs de départ, destination, chauffeur et points de prise en charge,
le tracé routier, l'historique GPS et la sélection par toucher sont conservés.
Les trajets et devis proviennent toujours de la même API Next.js.

Leaflet et sa feuille de style sont chargés en HTTPS depuis unpkg, avec version
et empreintes d'intégrité fixes. Les tuiles sont téléchargées depuis
`tile.openstreetmap.org` : une connexion Internet est nécessaire. Ces fournisseurs
reçoivent les requêtes de ressources/cartes, jamais les cookies de l'API.
Les échecs de chargement sont affichés avec un bouton pour réessayer.
Pour une diffusion à grande échelle, prévoir un fournisseur de tuiles adapté
aux conditions et limites du service OpenStreetMap.

`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` n'est plus utilisée. Après ce remplacement
de dépendance native, reconstruire le binaire ; régénérer les dossiers natifs
ignorés avec `npx expo prebuild --clean --platform android --no-install`
(sauvegarder toute personnalisation native manuelle avant `--clean`).

### Archive EAS et API de production

Les profils `preview` (APK) et `production` définissent explicitement
`EXPO_PUBLIC_API_URL=https://saiway.vercel.app`. Le `.env` local n'est pas envoyé.
Le fichier `.easignore` à la racine du dépôt inclut uniquement le mobile, qui
contient les trois copies générées dans `src/lib/shared/`.
Il exclut le serveur Next.js, ses dépendances, les dossiers natifs générés,
les fichiers d'environnement et de signature. EAS doit régénérer Android à
partir de la configuration actuelle (Leaflet/WebView, sans Google Maps).

Depuis `mobile/`, après vérification locale, lancer dans votre terminal :

```bash
npx eas-cli@latest build --platform android --profile preview --clear-cache
```

Si le build échoue, copier le premier bloc d'erreur de la phase en échec :
le résumé « Unknown error » ne suffit pas à établir la cause. Le passage
du bundle local ne garantit pas à lui seul la compilation native distante.

## Vérification

```bash
cd mobile
npm run typecheck
npm run lint
npm test
npx expo export --platform ios --platform android
```

Les tests nécessitent Node.js 22.18+ avec exécution TypeScript native. Ils couvrent
les contrats JSON, règles de transitions/paiement, fuseau Cambodge, isolation des
cookies, uploads multipart et un parcours HTTP login → création → lecture →
refus de rôle → déconnexion sur un serveur de test local. Ils ne constituent pas
un paiement réel ni une validation des courses avec la base de production.

La logique, les routes et les écrans Next.js restent inchangés. Les seules
adaptations racine autorisées sont l'exclusion de `mobile/` de TypeScript et
d'ESLint et son autorisation de versionnement dans `.gitignore`.
