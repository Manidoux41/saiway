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
Le formatage réutilise le module pur `../lib/locale-format.ts` du site et les
notes d'historique générées réutilisent `../components/i18n/booking-history-note.ts`
et son dictionnaire, sans les modifier ni importer de code serveur.
`metro.config.js` rend ces dossiers visibles à Metro, notamment pour le repli
khmer des moteurs Intl incomplets. Les observations et motifs libres sont conservés.
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
  après un délai de 1,2 seconde. La reprise d'un écran ou de l'application ne
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
- Le backend ne prend en charge que le Web Push, pas les tokens APNs/FCM/Expo :
  pas de notifications push natives sans évolution serveur. Aucun changement de
  ce type n'est apporté ici.
- Le changement de mot de passe client n'est pas exposé par l'API actuelle.
- Le navigateur web n'est pas une cible de ce projet : utiliser Next.js pour le web.

## Builds natifs

`app.json` contient les identifiants `com.saiway.app` et le schéma `saiway`.
Confirmer les identifiants auprès du propriétaire des comptes Apple/Google avant
publication. `eas.json` fournit des profils preview et production.
La signature, les comptes stores et les builds de distribution restent à configurer.

Pour les cartes Android dans un binaire autonome, activer Maps SDK for Android,
restreindre la clé au package et à son certificat SHA-1, puis renseigner
`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. Le plugin dans `app.config.js` l'applique au
build natif. Aucun paramètre Google n'est nécessaire pour Apple Maps sur iOS.
Après changement d'un plugin natif, reconstruire le binaire.

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
