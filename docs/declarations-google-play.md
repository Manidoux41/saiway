# SAIWAY — Déclarations Google Play / Google Play disclosures

Établi le / Prepared on: 12 novembre / November 2026.

> **DOSSIER DE PRÉPARATION, PAS DÉCLARATION CERTIFIÉE / PREPARATION WORKSHEET,
> NOT CERTIFIED DISCLOSURES.** Les réponses certaines sont distinguées des
> points non vérifiés. Ne pas recopier une case « à confirmer » en réponse
> définitive dans Play Console. L'opérateur reste responsable des déclarations
> de l'AAB exact, de ses SDK, prestataires et configurations.

## FR — 1. Réponses établies et limites

| Rubrique | Réponse fondée sur le projet |
|---|---|
| Application | SAIWAY, Android `com.saiway.app`. Vérifier l'AAB final et la fiche choisie. |
| Service | Intermédiation de transport physique, client et chauffeur dans un binaire. |
| Collecte de données | **Oui.** Comptes, réservations, localisation selon fonction, documents et données professionnelles, paiement et identifiants de notifications. |
| Création de compte | Email et mot de passe ; inscription client, comptes chauffeurs créés par l'administration. Choisir la catégorie équivalente dans la console. |
| Présence de publicités | **Oui.** Offres partenaires ; absence d'Ad ID ne change pas cette réponse. |
| Identifiant publicitaire Android | Permission bloquée dans la configuration. Répondre définitivement après contrôle du manifeste fusionné et des SDK de l'AAB. |
| Localisation en arrière-plan | Non prévue dans le code examiné ; GPS chauffeur au premier plan. Confirmer les permissions du binaire final. |
| Photos | Sélection ponctuelle via sélecteur système, pas accès étendu à toute la bibliothèque. Vérifier le manifeste et le comportement de la version soumise. |
| Paiement | Transport physique et PayWay ; pas de vente de biens numériques observée. Ne pas confondre cette exemption de Play Billing avec une exemption de déclaration financière. |
| Suppression | Demande en application et procédure externe `https://saiway.vercel.app/account-deletion`. Traitement manuel, pas effacement immédiat automatique. |
| URL de confidentialité | `https://saiway.vercel.app/privacy` et complément `/mobile-privacy` : textes publics à aligner sur une version réellement validée avant soumission. |
| Chiffrement en transit | HTTPS requis par le client mobile en production. La réponse globale « toutes les données » exige aussi la vérification des SDK et prestataires. |
| Audit de sécurité indépendant | Non attesté. Ne pas déclarer une certification/audit indépendant sur la base de tests de code. |
| Public cible et enfants | **Bloquant : âge minimal non défini et mineurs autorisés par l'exploitant.** Ne pas déclarer « adultes uniquement » pour contourner ce point. |

## FR — 2. Matrice Sécurité des données

La table indique la collecte observée et une catégorie candidate, **pas une
certification des cases de partage, de caractère obligatoire ou de traitement
éphémère**. Déclarer l'ensemble des rôles et versions distribuées.

| Données / catégorie Play candidate | Collecte et finalité | Décision nécessaire |
|---|---|---|
| Nom, email, identifiants utilisateur | Compte, connexion, attribution et assistance | Gestion du compte et fonctionnalités ; champs requis selon rôle. |
| Téléphone, adresses | Contact, réservation, départ/destination | Distinguer adresse personnelle enregistrée et simple lieu du trajet ; caractère facultatif selon écran. |
| Localisation précise | GPS, points de prise en charge, trajets chauffeur | Fonctionnalité de l'application ; conservée côté serveur, donc pas globalement éphémère. |
| Localisation approximative | Permission coarse et position obtenue selon réglage utilisateur | Vérifier les flux si seule la localisation approximative est accordée. |
| Photos, autres informations personnelles | Permis, documents professionnels et QR choisis | Vérifier si « Photos » et/ou « Fichiers et documents » s'appliquent selon les fichiers réellement transmis. |
| Informations financières / historique des achats | Réservations payées, montants, états et remboursements | Examiner les catégories financières exactes, dépenses/rémunérations chauffeur et le flux PayWay. |
| Identifiants d'appareil ou autres | Jeton Expo, identifiants opaques transmis à Expo/FCM/APNs | Fonctionnalité ; pas un identifiant publicitaire. Évaluer les SDK et les exceptions de partage. |
| Autres contenus générés par l'utilisateur | Instructions et besoins particuliers | Évaluer les informations sensibles effectivement collectées, dont santé si des besoins d'assistance sont saisis. Ne pas affirmer « aucune donnée sensible ». |
| Activité dans l'application | Historique de réservation et actions de trajet | Déterminer les sous-catégories applicables ; distinguer historique d'achat, interaction et analytics. |
| Informations de diagnostic | Pas de SDK dédié d'analytics/crash reporting identifié dans le manifeste npm examiné | Cela ne prouve pas l'absence de diagnostics collectés par des SDK, l'hébergeur ou le binaire ; inventorier avant réponse. |

### Collectées / partagées

- La transmission hors appareil à l'API constitue généralement de la collecte.
- L'accès du chauffeur attribué, les prestataires, le CDN, les cartes, PayWay et
  les liens externes doivent être évalués selon les définitions Google.
- Un prestataire de traitement peut relever d'une exception de « partage » si
  les conditions Google sont réellement réunies ; **ne pas appliquer cette
  exception sans vérifier le contrat et l'usage des données**.
- Une transmission déclenchée par l'utilisateur n'est pas automatiquement exclue
  de toutes les obligations. Vérifier la définition applicable à chaque parcours.
- Ne pas répondre « aucune donnée partagée » ou « uniquement éphémère » par défaut.
- Fonction facultative et donnée facultative ne se déduisent pas simplement l'une
  de l'autre. Vérifier les blocages réels pour chaque rôle.

## FR — 3. Mineurs : blocage à résoudre

L'exploitant souhaite autoriser les mineurs, mais n'a pas fixé d'âge minimal ni
précisé si les moins de 13 ans font partie du public visé. Aucun mécanisme parental
n'a été vérifié. Réserver un transport n'établit pas à lui seul une exemption.

Avant de choisir les tranches d'âge :

1. Définir les utilisateurs réellement visés et l'âge minimal de compte.
2. Faire déterminer les obligations selon pays et âge : capacité à contracter,
   données personnelles et éventuelles autorisations parentales.
3. Si le public comprend des enfants, examiner les règles Families, les limites
   sur les identifiants/localisation, l'adéquation des SDK et des offres
   publicitaires, et les mesures de contrôle d'âge éventuellement nécessaires.
4. Adapter le code et les textes au choix validé. Une simple phrase « réservé
   aux adultes » ne suffit pas si le fonctionnement/public visé dit le contraire.
5. Distinguer la classification du contenu IARC, le public cible et la capacité
   à créer un compte : ce ne sont pas la même déclaration.

## FR — 4. Suppression et conservation

- Demande authentifiée avec mot de passe et confirmation dans Mon compte.
- Demande externe par email via une page publique, sans installation requise.
- L'administration reçoit une demande et peut enregistrer une résolution.
  **Ce bouton ne réalise aucun effacement automatique.**
- Vérifier l'email surveillé, la procédure d'identification, le délai de réponse,
  les données réellement effacées, les exceptions justifiées et les sauvegardes.
- La purge GPS à 03 h annoncée concerne les points de plus de **30 jours** si
  activée ; elle n'efface pas toutes les données personnelles chaque nuit.
- Ne pas annoncer un délai d'effacement ou de conservation comptable non décidé.

## FR — 5. Accès examinateur et contrôle avant envoi

- Fournir dans la section privée Play Console des comptes client et chauffeur de
  test, et des instructions pour les fonctions protégées. Ne pas mettre leurs
  mots de passe dans ce fichier ou le dépôt.
- Indiquer les dépendances de parcours : API joignable, attribution de course,
  documents de test, permission GPS/notifications. Ne pas utiliser de données
  réelles de clients pour la revue.
- Vérifier AAB signé, package, versionCode croissant, SDK cible exigé au dépôt,
  architectures et compatibilité 16 Ko des bibliothèques natives.
- Examiner le manifeste fusionné, les SDK inclus, les flux réseau et permissions
  sur le binaire distribué ; les seuls fichiers JavaScript ne suffisent pas.
- Tester inscription, réservation, paiement de test autorisé, accès chauffeur,
  suppression, refus des permissions et push appareil fermé normalement.
- Aligner politique publique, contact, identité Play et déclarations. Les tests
  fermés ne dispensent pas des politiques Google.
- Ne pas annoncer un test, un contrôle juridique ou une certification non effectué.

---

## EN — 1. Established answers and limits

SAIWAY is a physical-transport intermediation application with customer and driver
roles, configured as `com.saiway.app`. Verify the actual AAB.

- **Collects data: yes.** Account, booking, feature-dependent location,
  professional documents/data, payments and notification identifiers.
- **Accounts:** email/password; customer registration and admin-created drivers.
- **Contains ads: yes.** Partner offers count regardless of advertising ID usage.
- **Advertising ID:** permission blocked in source configuration; inspect merged
  manifest and bundled SDKs before the final declaration.
- **Background location:** not implemented in the examined flow; foreground driver
  GPS only. Verify final permissions.
- **Photos:** system picker for occasional selected images, not broad library
  access. Verify released behavior.
- **Payments:** physical transport through PayWay, not observed digital-goods
  sales. Play Billing treatment does not remove financial-data disclosures.
- **Deletion:** in-app request and public external procedure at
  <https://saiway.vercel.app/account-deletion>; verified manual processing required.
- **Privacy URL:** <https://saiway.vercel.app/privacy> with `/mobile-privacy`
  supplement; align with validated text before submission.
- **Encryption:** mobile production requires HTTPS; a global answer covering all
  data still requires provider/SDK verification.
- **Independent security review:** not established; code tests are not certification.
- **Target ages:** blocked until minimum age and intended child audience are defined.

## EN — 2. Data safety worksheet

| Candidate category | Observed use | Remaining assessment |
|---|---|---|
| Name, email, user IDs | Authentication, account, assignment/support | Account management/functionality; mandatory fields differ by role. |
| Phone and addresses | Contact and trip endpoints | Distinguish personal address and trip place; actual optionality. |
| Precise location | Pickup/driver GPS and route history | Functionality; server storage means not generally ephemeral. |
| Approximate location | Coarse permission and approximate user settings | Confirm handling when only approximate location is granted. |
| Photos / personal information / files | Driver licence/document images and selected QR codes | Choose categories matching actual uploaded formats and content. |
| Financial information / purchase history | Trip amounts, payment/refund status, expenses/remuneration | Check exact categories and external PayWay behavior. |
| Device or other IDs | Expo token and opaque account/trip IDs | Functionality; not an advertising ID. Assess SDKs and sharing exceptions. |
| User-generated content | Instructions and special needs | Consider sensitive/health information if users submit assistance needs. |
| App activity | Booking and trip actions/history | Distinguish purchase history, interactions and analytics categories. |
| Diagnostics | No dedicated analytics/crash SDK identified in examined npm manifest | Not proof of absence in SDKs, hosting or the actual artifact. |

Transmission off-device to SAIWAY generally constitutes collection. Evaluate
assigned-driver disclosures, hosting, Expo/FCM/APNs, maps/CDN, PayWay and external
links using Google's definitions. Service-provider or user-initiated-transfer
exceptions require evidence; do not assume all transfers are exempt.
Do not default to “no sharing”, “all optional” or “ephemeral processing”.
All distributed roles and versions must be covered.

## EN — 3. Children and target audience

The operator intends to permit minors but has not defined a minimum age or
whether under-13s are targeted. No parental mechanism was verified. Physical
transport is not itself proof of a child-privacy or consent exemption.

Define actual users and ages, obtain applicable legal guidance, assess contractual
capacity and privacy requirements, and review Families rules if children are
included. Review location/identifier limits, SDK suitability, partner advertising
and any required neutral age checks. Implement the chosen policy rather than
only changing text. Content rating, target audience and account eligibility are
separate questions. Do not select adult-only solely to bypass requirements.

## EN — 4. Deletion and retention

The in-app request requires authentication, password and confirmation; the public
page permits external email requests. Administrators track requests and record
resolutions; **resolution does not automatically erase data**.

Confirm monitored contact, verification process, response deadline, actual
erasure, justified retention and backups. Daily 03:00 GPS cleanup removes
records older than **30 days** when enabled/executed, not all personal data
overnight. Other retention periods remain undefined.

## EN — 5. Reviewer access and release checks

Supply customer/driver review accounts and instructions privately in Play Console,
not in repository documents. Use synthetic data and explain API, trip-assignment,
GPS and notification prerequisites.

Verify signed AAB, package, increasing versionCode, target API required at upload,
architectures and 16 KB support. Inspect merged permissions, bundled SDKs,
network behavior and the released artifact. Test registration, bookings,
authorized test payments, driver flows, deletion, permission refusal and
normally closed-app push. Align live policy, operator identity and disclosures.
Closed testing does not waive Google policies; do not claim unperformed legal,
security or device validation.

## Sources et justificatifs / Sources and evidence

- [Google — Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Google — Families](https://support.google.com/googleplay/android-developer/answer/9893335)
- [Google — Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Mobile permissions](../mobile/app.json)
- [Dependency manifest](../mobile/package.json)
- [GPS retention](../app/api/cron/driver-location-retention/route.ts)
- [Manual deletion](../app/api/account/deletion/route.ts)
- [Admin resolution](../app/api/admin/account-deletions/route.ts)
- [Privacy draft](./politique-confidentialite.md)
- [Legal notice draft](./mentions-legales.md)
