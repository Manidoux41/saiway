<div align="center">

<img src="./public/icons/saiway-mark.svg" width="88" height="88" alt="Logo SAIWAY">

# SAIWAY

**Your easy way to Siem Reap**

🔵 Réservations · 🟢 Chauffeurs & GPS · 🟠 Comptabilité · 🔴 Administration

**Transferts privés, trajets urbains et découvertes touristiques à Siem Reap.**

🇬🇧 English · 🇫🇷 Français · 🇰🇭 ខ្មែរ

</div>

---

## 🧭 Sommaire

- [Fonctionnalités intégrées](#-fonctionnalités-intégrées)
- [Parcours et espaces](#-parcours-et-espaces)
- [Style, accessibilité et chargement](#-style-accessibilité-et-chargement)
- [Suivi GPS : possibilités et limites](#-suivi-gps--possibilités-et-limites)
- [Démarrer le projet](#getting-started)
- [Installation mobile et identité visuelle](#mobile-app-branding)
- [Base de données et administration](#database-and-administration)
- [Documentation technique détaillée](#-documentation-technique)

## 🌈 Fonctionnalités intégrées

Ce catalogue décrit ce qui est implémenté, pas une promesse de disponibilité
des services tiers. Certaines fonctions nécessitent une configuration, des
autorisations ou des migrations dans l’environnement déployé.

| Espace | Fonctionnalités |
|---|---|
| 🔵 **Accueil & réservation** | Accès prioritaires visibles dès l’ouverture : commande sans inscription, réservation et suivi chauffeur, dans un bloc compact adapté au mobile avec icônes et focus clavier. Formulaire unifié ; transfert aéroport, trajet urbain, transfert privé, hôtel et circuit touristique ; départ GPS/carte ou adresse, suggestions de lieux, destination, passagers, bagages, vol, date/heure et besoins particuliers. |
| 📍 **Commande immédiate sans inscription** | Bouton « Commander sans inscription » : position GPS actuelle uniquement, sans nom, téléphone, email ni compte. Référence privée, suivi chauffeur/véhicule et annulation depuis le même navigateur ; destination, capacité et tarif confirmés avec le chauffeur avant le départ. |
| 💰 **Tarification** | Devis calculé côté serveur, politique tarifaire versionnée, zones et circuits, distance/temps et suppléments selon les règles configurées ; détail du prix et confirmation des ajustements. |
| 👤 **Compte client** | Inscription et connexion, profil, réservations personnelles, prochaines courses, historique, annulation selon les règles applicables, choix du paiement et suivi du chauffeur affecté. |
| 🏨 **Professionnels** | Présentation et inscription des hôtels, guesthouses et agences ; validation/refus/suspension depuis l’administration. Réservation au nom de l’établissement pour ses clients, nom du voyageur obligatoire, téléphone facultatif et contact de l’établissement accessible au chauffeur. Tarifs habituels, paiement course par course, sans commission ni facturation mensuelle. |
| 🟢 **Disponibilité & attribution** | Interrupteur disponible/indisponible, véhicule actif sélectionné, statut en service ; attribution automatique d’une nouvelle réservation au chauffeur éligible le plus proche avec GPS fiable, puis ancienneté de disponibilité ; contrôle des places et conflits d’horaires. Attribution manuelle si aucun candidat ne convient. |
| 🚘 **Espace chauffeur** | Planning, recherche/filtres, acceptation et progression de la course, trajet vers le client, arrivée, départ, fin de course, observations et encaissement. Mode démonstration distinct des données réelles. |
| 🧳 **Courses autonomes** | Départ d’une course sans réservation préalable, passager de passage, type de trajet/circuit, itinéraire et points GPS, estimation puis tarif final ; confirmation explicite si le GPS ne suffit pas pour calculer la distance. |
| 🗺️ **Flotte & GPS** | Carte Leaflet, positions et véhicules, statuts opérationnels, hubs, itinéraires et estimation d’arrivée, plein écran ; un seul flux GPS chauffeur alimente la supervision et le suivi client autorisé. |
| 📍 **Reprise du suivi** | Nouvelle acquisition GPS au retour au premier plan, à la restauration de page et au retour du réseau ; nouvelles tentatives après échec ; horodatage réel conservé ; positions périmées explicitement signalées. |
| 💳 **Paiements** | Paiement en ligne ABA PayWay/KHQR selon configuration ou paiement au chauffeur ; méthode réelle espèces/carte/ABA/autre saisie après la course ; QR ABA affiché dans le parcours concerné ; contrôle de confirmation, rapprochement et prévention des doublons. |
| 🧾 **Factures & PDF** | Facture client après confirmation d’un paiement réel, contrats de travail et bulletins de paie ; en-tête SAIWAY avec logo et slogan, contrôles d’accès et versions de documents adaptées au parcours. |
| 🟠 **Comptabilité** | Recettes issues des paiements validés, écritures datées, filtres par mois/période/type/catégorie/véhicule/description, soldes enregistrés et encaissés distincts ; corrections manuelles auditées, sources financières automatiques protégées. |
| ⛽ **Carburant & entretien** | Saisie chauffeur du véhicule, kilométrage, litres, plein complet/partiel, montant, devise et date ; maintenance côté administration ; approbation/rejet motivé et inscription en dépense seulement après validation. |
| 👥 **Paie & personnel** | Salaire contractuel et prorata, commission configurée par les règles de paie existantes, primes/retenues motivées ; brouillon, recalcul, validation, PDF et paiement effectif distincts. Coordonnées employeur administrables. |
| 🪪 **Documents & cartes de visite** | Profil chauffeur, photos et permis recto/verso, contrats ; cartes de visite avec logo, photo et téléphone de réservation, QR WhatsApp/Telegram chargés par le chauffeur, génération et impression depuis l’administration. |
| 🔔 **Notifications push** | Activation volontaire par appareil, désactivation et test ; événements de réservation, affectation et progression pris en charge par une file persistante avec tentatives de livraison. Destinataires limités aux personnes concernées. |
| 🔴 **Gestion administrateur** | Comptes et rôles, statut actif/suspendu, véhicules et icônes de carte, hubs, tarifs, réglages, finances, documents et historique d’audit ; menus latéraux et sous-menus dépliants. |
| 🗃️ **Archivage des courses** | Retrait réversible des listes administrateur, y compris courses terminées ; annulation atomique des courses non commencées ; protection des courses en service ; restauration sans réactivation, finances et historique conservés. |
| 📝 **Blog touristique** | Création/modification/suppression d’articles, brouillons et publication, langue de rédaction FR/EN/KM, photos/légendes/remplacement, liaison privée à une course terminée ; jusqu’à trois articles publiés à la une sur l’accueil. |
| ✉️ **Contact & partenariats** | Page contact avec QR WhatsApp/Telegram du chauffeur de contact sélectionné et email administrable ; invitations aux hôtels, agences et chauffeurs partenaires, sans fausses statistiques ni partenariats inventés. |
| 📣 **Publicités & contrats** | Rubrique administrateur dédiée : annonceur, coordonnées privées, montant USD, conditions et notes, dates/heure du Cambodge, image, lien HTTPS et contrat PDF SAIWAY à signer ; modification versionnée, archivage motivé et audit. Activation manuelle, emplacements sélectionnables accueil/blog/réservation/chauffeur, tri et filtres ; six annonces maximum par emplacement, ordre par priorité croissante. Aucun paiement ni écriture comptable automatique. |
| 📱 **Installation mobile** | PWA, manifeste, service worker, icônes Android/iOS, favicon et écrans de lancement utilisant la marque du header ; mise à jour des ressources statiques sans cache des données privées/API. |
| 🌍 **Langues & ergonomie** | Interface en anglais, français et khmer, dates/nombres localisés, horaires métier au Cambodge, navigation responsive, formulaires conservés dans les rubriques repliées et interactions accessibles au clavier. |
| 🎨 **Décor & interactions** | Bleu/rouge du Cambodge, silhouette locale d’Angkor et motifs dorés dans l’espace public ; administration sobre sur fond gris-bleu et espace chauffeur distinct. Parallaxe CSS progressive sur grand écran compatible, cartes qui se soulèvent au survol et apparition au défilement dans les navigateurs compatibles ; contenu accessible sans animations, respect de la réduction des mouvements et focus clavier visibles. |
| ⚙️ **Exploitation** | Prisma/PostgreSQL, pool borné de connexions, API avec permissions, contrôle des versions concurrentes et transactions métier ; tâches planifiées authentifiées pour livraison push et rétention GPS, activables/configurables selon leur documentation. |

## 🛣️ Parcours et espaces

| Destination | Accès et usage |
|---|---|
| `/` | Accueil, réservation rapide, prestations, articles à la une et partenariats. |
| `/booking` | Réservation et revue du trajet/prix ; connexion nécessaire pour enregistrer une réservation personnelle. |
| `/ride` | Demande immédiate sans compte : GPS uniquement, référence et suivi privés dans le navigateur. |
| `/auth` | Inscription client et connexion ; le rôle provient du compte, jamais d’un choix libre donnant des droits. |
| `/account` | Réservations, paiements et profil du client connecté. |
| `/professionals` | Présentation, inscription et statut de validation des établissements ; réservation pour leurs clients après approbation. |
| `/booking/track` | Suivi de la course du client autorisé. |
| `/driver` | Espace chauffeur : disponibilité, GPS, courses, carburant, paie et documents. |
| `/admin` | Répartition, comptes, flotte/gestion, blog/photos, publicités/contrats et sécurité ; API réservées aux administrateurs actifs. |
| `/blog` et `/blog/<postId>` | Journal public et articles publiés ; les brouillons/photos privées ne sont pas publics. |
| `/contact` | Contacts de réservation configurés par l’administration. |
| `/about`, `/help`, `/install` | Présentation, aide et installation mobile. |
| `/terms`, `/privacy`, `/cancellation-policy` | Conditions, confidentialité et politique d’annulation. |

### 🏨 Établissements partenaires

Depuis le bouton de l’accueil ou **Professionnels**, un hôtel, une guesthouse,
une agence ou un autre établissement renseigne sa société, sa catégorie, son
adresse, son contact, son téléphone de réservation, son email et son mot de passe.
L’inscription crée un compte client professionnel **en attente**, sans droits
chauffeur ni administrateur. Dans **Administration → Inscriptions
professionnelles**, l’administrateur peut rechercher, trier par date/société/
catégorie/statut, corriger la fiche, valider, refuser ou suspendre les nouvelles
réservations. Ces changements sont audités et les modifications concurrentes
sont signalées plutôt qu’écrasées.

Après validation, l’établissement utilise `/booking` : nom du voyageur
obligatoire, téléphone facultatif, mêmes tarifs et choix de paiement que les
clients particuliers. Le voyageur n’a pas à créer de compte. La réservation,
les notifications, le suivi et les paiements appartiennent au compte de
l’établissement. Nom et téléphone de la société sont conservés dans chaque
course ; modifier ensuite la fiche ne réécrit pas les anciennes réservations.
Le chauffeur affecté et l’administration voient distinctement le voyageur et
le contact de l’établissement. Une suspension bloque les nouvelles commandes,
pas l’accès à l’historique, aux paiements ou aux courses existantes.

API : `POST /api/professionals` (inscription), `GET /api/professionals` (fiche du
client connecté uniquement), `GET /api/admin/professionals` et
`PATCH /api/admin/professionals/<id>` (administrateurs actifs uniquement).
L’approbation est contrôlée côté serveur, y compris si l’administration réserve
pour ce compte ou si un chauffeur le sélectionne pour une course autonome.
L’envoi de champs société, tarif, propriétaire ou statut falsifiés dans la
réservation client est refusé. Pas de commissions, tarifs négociés, facturation
mensuelle, conversion automatique d’un ancien compte ou invitation email.
La migration additive `20261110060000_professional_bookings` est requise.

> 🟢 **Paiement validé ≠ course attribuée.** L’affectation ou la fin d’une course
> ne prouvent jamais un paiement. Un PDF généré ne prouve pas non plus le
> versement d’un salaire.
>
> 🟠 **Services à configurer.** Le paiement en ligne dépend du compte marchand
> et des paramètres ABA ; les push dépendent du consentement, de VAPID et de
> leur exécution planifiée ; la cartographie dépend de fournisseurs adaptés à
> la charge et aux exigences de confidentialité.
>
> 🔴 **Pas de promesse GPS en arrière-plan.** Une PWA fermée ou suspendue ne
> peut pas garantir l’envoi de positions. Une application native avec les
> permissions appropriées est nécessaire pour ce besoin.

## 🎨 Style, accessibilité et chargement

- Couleurs de marque : 🔵 bleu `#032EA1`, 🔴 rouge `#E00025`, surfaces claires
  et accents de paysage inspirés de Siem Reap.
- Décor vectoriel local par défaut : aucun téléchargement de grande photo
  externe pour ce décor. Une image d’accueil explicitement configurée en
  administration reste prioritaire.
- Parallaxe sans écouteur JavaScript de défilement, sur grand écran uniquement
  si les animations pilotées par le scroll sont supportées. Décor statique sur
  les autres navigateurs, sur mobile et avec `prefers-reduced-motion`.
- Navigation clavier avec focus visibles ; aucune animation ne bloque un
  formulaire ou ne retarde artificiellement l’accès au contenu.
- Chargement à la demande des outils administrateur secondaires, sans perdre
  leurs formulaires après première ouverture. Les cartes conservent leurs
  chargements différés.
- Requêtes indépendantes de l’accueil exécutées en parallèle ; squelette léger
  pendant les navigations de réservation. Les données privées restent fraîches :
  aucun cache partagé de comptes, paiements ou positions.
- La rapidité réelle dépend également du réseau, de la base et des fournisseurs
  cartographiques. Aucun score Lighthouse ni pourcentage de gain n’est inventé.

## 📍 Suivi GPS : possibilités et limites

Le chauffeur autorise la localisation et garde sa webapp ouverte lorsqu’il est
disponible, affecté à une course ou en retour au hub. Le maintien de l’écran allumé
est demandé si le navigateur le permet, sans en garantir l’acceptation.

La webapp réacquiert un point **frais** à son retour au premier plan, lors d’un
événement de restauration de page ou après reconnexion. Un échec initial est
réessayé automatiquement ; une permission refusée reste à rétablir par le
chauffeur. Un point ancien n’est jamais re-daté pour simuler un signal GPS neuf.
Les requêtes et abonnements du suivi sont nettoyés au changement de session.

Dans l’administration :

- statuts distincts **Disponible**, **Indisponible**, **Course attribuée**,
  **En route vers le client**, **En attente du client**, **Client à bord** et
  **Retour au hub** ;
- dernière course terminée et heure de fin (si renseignée) affichées séparément du statut de
  disponibilité actuel ;
- heure réelle de la dernière mesure GPS ; après deux minutes, le point est
  signalé périmé, atténué et exclu du nombre de positions récentes ;
- les points périmés en service restent visibles comme **dernière position
  connue**, sans estimation d’itinéraire présentée comme actuelle ;
- aucune position n’est exposée dans la flotte lorsqu’un chauffeur n’est plus
  disponible, n’a pas de course active et n’est pas en retour au hub ;
- le suivi client reste limité à sa réservation autorisée et s’arrête à sa fin.

Les limites iOS/Android ne sont pas contournées par un service worker, un ping ou
une notification push. L’indication de fraîcheur est une mesure de la réception
GPS, pas une preuve que l’application est ouverte ou fermée.

## Getting Started

Projet [Next.js](https://nextjs.org), React, TypeScript et Prisma/PostgreSQL.
Avec les dépendances installées et l’environnement configuré :

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000), ou le port choisi avec
`npm run dev -- --port 3001`.

```bash
npx prisma generate
npx tsc --noEmit
npm run lint
npm run build
```

`npm test` inclut des tests d’intégration qui écrivent dans une base : utiliser
une **base de validation isolée**, un serveur de test et les deux variables
`DATABASE_URL` et `PRISMA_DATABASE_URL` pointant sur cette base. Ne jamais lancer
ces tests contre les données d’exploitation. `VALIDATION_URL` désigne le serveur
de validation. Les migrations sont à appliquer séparément après sauvegarde et
vérification de la base ciblée.

## 📚 Documentation technique

La référence ci-dessous conserve les contrats API, règles métier, variables,
limites et procédures détaillées. Les sections historiques de migration
décrivent ce qu’il faut appliquer à chaque environnement, pas une autorisation
de rejouer des migrations ou de remettre une base à zéro.

## Mobile app branding

The header, favicon, installed Android/iOS app icon and mobile launch screens
share the SAIWAY mark from `public/icons/saiway-mark.svg`. Raster PNG icons are
provided for mobile compatibility, including a padded maskable Android icon and
an opaque 180 px Apple touch icon. Android generates its launch screen from the
web manifest; iOS uses device-matched portrait/landscape startup PNGs with the
SAIWAY mark and name. No artificial loading delay or full-page overlay is added.

After editing the source mark or supported Apple device sizes in
`lib/pwa-assets.mjs`, run `npm run generate:pwa-assets` (uses the existing Sharp
dependency) and commit the generated icons, startup screens and favicon.
The service-worker shell cache is versioned to replace old branding without
caching account pages or API data. Deploy these files together. An already
installed home-screen shortcut may retain its OS-cached icon: reopen the app,
and remove/reinstall the shortcut if the operating system does not refresh it.
Native launch appearance depends on browser/OS support; ordinary browser tabs
do not display an installed-app splash screen.

## PostgreSQL connections on Vercel Hobby

The application reuses one Prisma client per running process in development and
production. Its PostgreSQL adapter allows at most two connections per process,
releases idle connections after five seconds, recycles connections after one
minute, and fails connection acquisition after five seconds rather than hanging.
This is a per-instance limit, not a global limit across Vercel functions.

Configure the existing `PRISMA_DATABASE_URL` in Vercel **Production** with the
provider's pooled runtime connection URL for the same database (for example,
Supabase's transaction pooler). Keep `DATABASE_URL` appropriate for Prisma
migrations. Do not invent a hostname, password or port: copy the provider's exact
connection settings. Redeploy after changing environment values.

Prisma `P2037` / PostgreSQL `53300` means the database user's connection limit
has been reached. The homepage reads its background from the database, so this
can appear as a Next.js server error even for visitors without an account.
Do not clear authentication or disable database checks to hide it. After deploying
the bounded-pool fix, inspect provider connection usage and Vercel runtime logs if
it persists. Old deployments and other clients may still occupy connections;
do not terminate unknown sessions. A provider pooler avoids multiplying direct
connections across serverless instances without requiring Vercel Pro.

## Homepage and partnership opportunities

The homepage highlights airport arrivals, city trips and sightseeing instead of
unverified availability, arrival-time or driver-count statistics. The airport
example links to the booking quote rather than advertising a hard-coded fare.
Partnership invitations address hotels/guesthouses, travel agencies and local
drivers, with a map link to the principal Siem Reap hub for a discussion.
These are opportunities, not claims of signed partnerships or guaranteed terms.
All new copy is available in English, French and Khmer.

The reservation page uses one unified form instead of separate booking and trip
details panels. Five illustrated trip-type choices and short descriptions appear
at the start of the form; circuit/duration options appear for sightseeing.
Passengers, route, pickup time, fare breakdown and payment remain in the same
card. The review shows the exact selected transfer type, including private and
hotel transfers. Existing booking steps and server-side pricing are preserved.

## Database and administration

### GPS-only immediate pickup without registration

The homepage and booking page link to `/ride`. Visitors explicitly obtain a fresh
GPS fix (at most two minutes old, accuracy within 100 metres) and confirm pickup.
No name, telephone, email, password or customer account is created. GPS itself is
location data: consent text explains sharing with SAIWAY and the assigned driver.

A separate random, HttpOnly, SameSite=Lax cookie (Secure in production, seven
days) grants access to this single request. Only its SHA-256 hash is stored in
`GuestRideAccess`, never exposed by booking lists. A reference is not an access
credential. Reloading the page recovers the request in the same browser; clearing
cookies or changing browser loses access. It cannot be recovered by phone/email.
The anonymous endpoint exposes only reference, status, pickup, confirmed
destination/fare, assigned driver name/vehicle, and that ride's latest driver
position while operationally active. Closed rides stop location sharing.

Requests reuse existing booking dispatch and admin/driver lists with origin
`GUEST`; no separate queue or fictional customer is created. Automatic assignment
uses FIFO availability (oldest available first, then creation/id) among active,
available, conflict-free drivers with an active selected vehicle of sufficient
capacity. Driver GPS is not required for assignment. Assignment is immediately
accepted (`DRIVER_ACCEPTED`). Ordinary registered bookings keep proximity dispatch.
Without an eligible driver, only administrators are alerted for manual assignment;
manual admin assignment keeps its normal driver acceptance step.
There is no promised arrival time. The passenger must stay at the pickup and
show the reference: there is no telephone or email contact.

`AWAITING_DESTINATION` is an unknown fare, not a free ride. The driver travels to
pickup, marks arrival, checks passenger/vehicle capacity and presses **Passenger on
board**. A driver GPS fix within 15 seconds and 50 metres is required. No destination
entry is necessary. `GPS_METER` snapshots the tariff and start point, excluding the
approach to the passenger. The driver sees a server-calculated provisional distance
and price refreshed every five seconds. At completion, a recent accurate GPS fix
records the drop-off; GPS kilometres use the configured city rate, pickup/minimum
and supplements (also outside configured city zones for this GPS-only product).
The existing airport package/cap applies when either endpoint is at SAI Airport.
Other autonomous trips keep their existing outside-zone agreed-fare rules.
Incomplete GPS never silently produces a final fare: the driver must explicitly
confirm a road estimate between the meter start and the GPS drop-off.
Final amounts, destination and receipt remain on the original booking/reference.

After completion and before payment starts, the assigned driver can edit the final
guest-meter fare **without a mandatory reason**. Old/new amounts and the actor are
audited and visible in status history. Airport fares remain capped at USD 30.
Paid/processing fares and stale edits are rejected. Normal collection/accounting
rules use the saved final amount.

New guest assignments open their details in an active driver dashboard. Push taps
deep-link to that exact booking; a closed webapp cannot be forcibly opened by the
server, and continuous GPS cannot be guaranteed when the OS suspends/closes it.
Keep the driver app visible during metering. No additional database migration is
required for this FIFO/meter extension.

The browser can cancel until the trip starts, refresh status every five seconds,
and begin another request only after closure. POST retries reuse the existing
request, including after a lost response. Same-origin mutation checks and
transactional database limits prevent obvious cross-site or repeated creation:
100 requests per ten-minute global bucket; on Vercel, five per network per bucket
using only its trusted forwarding header and a short-lived HMAC, never raw IP.
Expired throttle buckets are pruned on creation. These limits are basic abuse
controls, not proof that a device is physically at the submitted coordinates.
No payment, paid receipt or accounting entry is created when requesting pickup.

Deployment requires additive migration `20261110050000_guest_gps_requests` after
a verified backup and explicit approval, plus the matching Prisma client/app.
The pre-existing customer booking and authentication flows remain unchanged.

### Advertising contracts and selectable placements

Administration → **Publicités et partenaires / Advertising & partners** manages
internal agreements with agencies and other providers. Set the advertiser,
contact person, optional email/phone, agreed USD amount, Cambodia start/end
date-times, private notes and contractual terms. The downloadable, branded PDF
includes the agreement, employer settings and signature spaces; enabling a
campaign is not an electronic signature, invoice or payment confirmation.

Each contract selects one or more locations: homepage, blog/articles, booking
page and driver workspace. Save as a draft, then explicitly enable it. Public
queries only select enabled, non-archived contracts with
`startsAt <= now < endsAt`. Cards are placed after the main content and before
the footer, clearly labelled sponsored, with HTTPS destination links opening in
a new tab (`sponsored noopener noreferrer`). There are no tracking pixels,
autoplay, third-party scripts or automatic accounting entries.

Up to six cards appear per location, ordered by ascending priority, then newest
contract and ID. Open pages refresh placements every 60 seconds and when
returning to the foreground; cards are removed locally at their end time.
Contact details, amounts, internal notes and terms never appear in the public
API. Images use checked, uncached endpoints and stop being available publicly
when the contract is paused, expires or is archived.

An optional JPEG/PNG/WebP image (5 MB maximum original) can be added after saving.
Large images are reduced in the browser to at most 2000 px and 3 MB before
upload; the server validates, resizes to at most 1200×800, converts to WebP and
removes metadata. Editing, image changes and motivated archival are audited and
protected by optimistic timestamps. Archival retains contractual history.
Filters cover status and placement; dates, advertiser, status, amount and
priority can be sorted in either direction.

Deployment requires additive migration
`20261110040000_advertising_contracts` after a verified backup and explicit
approval. Generate the matching Prisma client and deploy the application;
include the local PDF fonts in the deployment (configured in `next.config.ts`).
No new environment variable, payment provider or scheduled task is required.

### Tourism journal and homepage articles

Public `/blog` lists published articles; `/blog/<postId>` shows their text and
photo gallery. Articles retain their original French, English or Khmer language
for every visitor. Public pages never include linked reservation/customer data.
The header and footer link to the journal. Only published articles marked
**Feature on the homepage** appear on the homepage (latest three).

Administration → **Blog & photos** creates drafts, edits/publishes/unpublishes
articles, links a completed trip internally (including archived completed trips),
and deletes articles without changing the related trip or financial records.
Save buttons are available at the top and bottom of the article form.
Only a title is required to save a draft; introduction and text are required for
publication. Photos can be selected before the first save: the editor creates a
private draft first. Multiple JPEG/PNG/WebP files can be selected together
(20 MB maximum per original). The browser reduces large images to at most
2000 px and 3 MB before sequential uploads, staying below the hosting request
limit. The server still accepts at most 5 MB per image, validates and resizes
with Sharp, converts to WebP and removes metadata including GPS.
Successful photos are retained if a later file fails; retry only failed files.
Photos can be replaced, captioned, deleted and reordered with the earlier/later
buttons. Select an explicit header photo for the article and its public card;
without one, cards use the first gallery photo. Choose text then photos, a
two-column gallery, or alternating paragraphs/photos. Blank lines delimit
paragraphs for the alternating layout. Layout and header selection are saved
with the article. Deleting its header photo clears the selection.
Only publish photos and passenger stories with permission.

Admin APIs: `GET/POST /api/admin/blog`, `PATCH/DELETE /api/admin/blog/<postId>`,
`POST /api/admin/blog/<postId>/photos`,
`PUT/PATCH/DELETE /api/admin/blog/<postId>/photos/<photoId>`.
`PATCH /api/admin/blog/<postId>/photos/order` takes `expectedUpdatedAt` and
the complete, unique `photoIds` array belonging to the article.
Article edits/deletion require `expectedUpdatedAt` to prevent stale overwrites.
Draft images require an admin session and `?preview=true` on
`GET /api/blog/photos/<photoId>`; published images are public, uncached and become
unavailable immediately when the post is unpublished/deleted.
Mutations are audited. Apply migration `20261110010000_tourism_blog` before deployment.

### Removing trips from the administrator list

Admins can use **Remove from list** on unassigned, assigned-but-not-started,
cancelled or completed trips. This archives the trip rather than deleting it.
Non-terminal trips are cancelled atomically before archiving; trips in service
must first be explicitly cancelled or completed. Payments, invoices, accounting,
payroll sources and customer/driver history are retained. The **Archived trips**
view supports the existing filters and **Restore to list**; restoration does not
change the trip status or reassign the driver. Archive/restore actions are audited.

API: admin-only `PATCH /api/admin/bookings` with `{ id, action: "ARCHIVE" }`
or `{ id, action: "RESTORE" }`. Default admin GET excludes archived trips;
`GET /api/admin/bookings?archived=true` lists archives. The existing DELETE
cancellation contract is unchanged. Apply migration
`20261110000000_booking_admin_archive` before deploying this version.

### Organized administrator and driver workspaces

The public `/contact` page shows the uploaded WhatsApp and Telegram QR codes of
Rean Sokun by default, plus the contact email. Administrators can change the
email and selected active driver (or choose email only) in Fleet & management →
Settings & tools → Public contact page. Settings use the existing `SystemSetting`
store; no migration is needed. Saving this setting publishes only the selected
driver's contact QR images, not their private licence or account information.
`GET /api/contact/qr/WHATSAPP` and `/api/contact/qr/TELEGRAM` serve those images
without authentication or caching; other drivers' existing QR endpoints remain
restricted. Missing QR images are explicitly reported with email as an alternative.

Both workspaces have a sticky left sidebar on wide screens and a compact
expandable menu on mobile/tablet. Administration has five main destinations
(dispatch, accounts, management, blog & photos, security). Management groups navigation into Vehicles & locations,
Accounting & payroll, and Settings & tools. Each tool has a labelled collapsible
section instead of all forms/tables being expanded on one long page.
The record correction editor is included in this navigation.

The driver workspace groups shortcuts into Trips & availability, Accounting &
payroll, and Documents & account. Availability, live GPS status and assigned-trip
planning/actions remain visible. Autonomous trip creation, fuel, payslips and
personal documents can be expanded only when needed. Demo mode hides live
finance shortcuts and keeps its existing mutation restrictions.

Menus and sections use keyboard-accessible native disclosures; selecting a
submenu opens the target section and moves focus to it. Closing a section does
not unmount forms or stop trip polling/location sharing. Admin account and
management tools load on first visit and then stay mounted while switching main
destinations to retain draft input and filters.
No API permissions, dispatch, payment or accounting rules are changed.
Labels are available in English, French and Khmer.

### Administration list sorting

Each administration list has **Sort by** and **Order** selectors (ascending or
descending): dispatch including archived trips, live fleet, both account
directories, vehicles, hubs, driver licences/cards, accounting, receipts, monthly
forecasts, rental/financing contracts, expenses, payslips, employment contracts,
tariff history, record selectors and blog articles. Available criteria match the
list: dates, name/reference, category/type, status, vehicle and numeric amounts.
Existing filters are preserved and financial totals are unaffected.

Dates use timestamps, amounts use numeric values, and client-side text uses
natural ordering in the selected EN/FR/KM locale. Missing dates/relations stay
last in either direction. Expense amounts are compared in their recorded USD
equivalent; other monetary lists compare their displayed nominal amounts, not
currency conversions. Blog sorting runs in the database **before** its 20-item
pagination; changing its criterion/order returns to page one without discarding
the open article editor. Other lists sort the loaded records (tariff history
retains its existing latest-100-version limit). Choices remain while switching
main admin sections; they are not saved across a full page reload. Editable
tariff rules and article-photo sequences retain their explicit business order.

### Monthly accounting, vehicle costs and driver payroll

Financial records use an explicit entry date, category and optional vehicle.
Admin Fleet & management offers date ordering, month/date-range, category, type,
vehicle and description filters. Monthly recorded balance and paid balance are
distinct; credits/financing are not operating earnings and currencies are never
added together. These totals are not certified profit or tax statements.

Verified real trip payments now create a linked revenue entry in the same
transaction as confirmation, with a stable `Payment.confirmedAt` date. The
source key `payment:<paymentId>` prevents duplication. Existing paid records
without a linked entry remain visible once using their historical update date,
explicitly labelled as such; the exact historic confirmation date cannot be
reconstructed. Do not manually enter the same receipts again.

Administrators can add manual revenue/expense/purchase/credit entries and
edit or delete entries directly in **Monthly accounts**, including linked
trip receipts, approved vehicle-cost entries and paid salary entries.
Amounts, dates, paid dates, notes and vehicle association are editable.
Linked sources retain their type/category/currency and original payment,
expense declaration or payslip: this changes **bookkeeping only**, not the
receipt, driver commission or payroll calculation. The separate receipt list
continues to show the actual original payment.

Every correction/deletion requires a reason and `expectedUpdatedAt`.
Concurrent stale writes are rejected. Deletion retains the database record and
an audit snapshot, removes it from balances and keeps its source key occupied.
The original receipt therefore cannot silently reappear through the legacy
receipt fallback or payment synchronization. Audit snapshots include the
administrator, reason and complete before/after values.

Monthly forecasts can also be added, edited and deleted in their own section.
**Vehicle rentals & financing** manages contracts of both kinds for any
registered vehicle, including historical records for an inactive vehicle.
Dates classify them as current, upcoming or past; inactive contracts are past.
Deleting a contract removes it from the list while retaining its audit/history.
Contracts and forecasts do not automatically generate paid expenses or receipts.
Migration files: `20261110020000_financial_record_management` and
`20261110030000_blog_editor_layout`. Existing contracts default to rental;
their kind can be corrected explicitly. Existing article layout is preserved
as text followed by photos until changed by an administrator.

Fuel declarations record the vehicle, date, odometer, litres, total amount and
currency. KHR declarations require a captured KHR-per-USD exchange rate; the
USD accounting amount does not change when a later tariff changes. The driver
declares, the administrator reviews: a pending or rejected declaration is not an
accounting expense. Approved fuel and maintenance costs are classified as vehicle
expenses, with their own unique source. Repeated approval does not book the cost
again. A fill is not proof of full-to-full fuel consumption; odometer readings
and partial fills must be interpreted accordingly.
Drivers use **Fuel log** on their dashboard; administrators enter maintenance
and approve/reject declarations in **Fleet & management**. A rejection requires
a reason; approved declarations cannot be overwritten. Incorrect declarations
must be rejected and resubmitted. The driver journal shows the latest 200 entries;
the admin journal shows all pending entries and the latest 100 reviewed entries.
Approved accounting entries remain available in the full dated ledger.

Authenticated vehicle APIs: `GET/POST /api/driver/vehicle-expenses` (own allowed
vehicle fuel entries), `GET/POST /api/admin/vehicle-expenses` (maintenance), and
`PATCH /api/admin/vehicle-expenses` with `{ id, action: "APPROVE" | "REJECT",
reason? }`. POST requires a UUID `requestId`, `vehicleId`, ISO offset
`occurredAt`, decimal-string `odometerKm`, `amountCents`, `currency`, optional
`khrPerUsd` and `notes`; fuel additionally requires decimal-string `liters` and
boolean `fullTank`. **For USD, `amountCents` is cents; for KHR it is whole riels**,
preserved with the historic conversion rate. Reusing an ID with changed values
returns 409. Odometers must remain consistent with earlier and later non-rejected
declarations of the same vehicle.

Payroll rules selected for salaried drivers: monthly contractual salary,
prorated by calendar days employed, plus **80% commission** on eligible paid
receipts for trips completed during that full calendar month. Payment must be
confirmed before closure; unpaid trips and sandbox payments are excluded.
Month boundaries use Asia/Phnom_Penh. The scheduled payday is the **26th of the
following month**, not an automatic bank transfer. Bonuses, deductions, taxes
and contributions are manually identified and approved; no statutory rules are
invented. Company earnings are not the driver's salary.

Create/recalculate a draft, review it, finalize its immutable source snapshot,
then separately mark actual payment. Only actual salary payment creates a salary
expense. PDF generation alone does not pay an employee. Late settlements or
corrections after closure require administrator review rather than silently
changing a finalized payslip. Documents use SAIWAY branding; legal and payroll
compliance still requires a qualified local review.
The admin payroll panel retains existing draft adjustments when recalculating.
Finalization checks the reviewed version and current sources: if contracts,
receipts or employer details changed, recalculate and review the draft again.
The PDF includes the logo and slogan used in the header, salary proration,
commission, manual adjustments and trip sources. Only the owning driver can
download their finalized/paid statements; administrators can also download drafts,
clearly marked as drafts. Employer information comes from Personnel settings,
not fabricated registration details.

Authenticated payroll APIs: `GET /api/admin/payroll?month=YYYY-MM`,
`POST /api/admin/payroll` with `{ driverId, month, bonusCents, deductionCents,
adjustmentNotes }`, and `PATCH /api/admin/payroll` with either
`{ id, action: "FINALIZE", expectedUpdatedAt }` or
`{ id, action: "PAID", paidAt }` (actual ISO date with offset). Adjustment notes
are mandatory for non-zero bonuses/deductions. `GET /api/driver/payroll` returns
only the owner's finalized/paid statements. PDF downloads:
`GET /api/admin/payroll/:id/pdf?language=en|fr|km` and
`GET /api/driver/payroll/:id/pdf?language=en|fr|km`.

Before deploying these features, back up the intended database and apply
`20261108050000_finance_vehicle_payroll` with `npx prisma migrate deploy`, then
deploy the matching generated Prisma client/application. This additive migration
does not fabricate old fuel logs, salaries, or payment confirmation dates.
No new paid service, cron job or environment variable is required.
Applying the database migration does not deploy the new UI or API code:
redeploy the matching branch on Vercel after applying it.

### Push notifications

Signed-in customers, drivers and administrators can use the bell in the header
to enable push **on each device**, disable it or send a test (maximum one test
per minute). Consent is required; there is no unsolicited permission prompt.
On iPhone, install SAIWAY on the Home Screen first (iOS 16.4+). Other supported
browsers require HTTPS, except localhost for development.

| Event | Recipient |
|---|---|
| Customer or administrator creates a reservation | Customer owning the reservation (receipt acknowledgement, not payment confirmation), active administrators |
| GPS-only request without registration | Active administrators immediately; only the assigned driver if automatically dispatched and accepted. Without a compatible free driver, admin decides; no driver broadcast |
| A booking is assigned or reassigned to a driver | Newly assigned driver, active administrators |
| Driver changes availability or their selected vehicle | Active administrators |
| Driver confirms `DRIVER_ARRIVED`, manually or through backend GPS arrival detection | Customer owning that reservation |
| Driver changes to `DRIVER_EN_ROUTE`, `TRIP_STARTED`, `TRIP_COMPLETED` | Active administrators |
| Autonomous driver trip starts | Active administrators |
| Reliable GPS shows movement of at least 50 m over approximately one minute | Active administrators, at most once per minute per driver |

Backend arrival detection runs only for `DRIVER_EN_ROUTE`: received GPS fixes must
remain within 50 m of the saved pickup, with accuracy at most 20 m, spanning at
least 15 seconds and with no gap over 20 seconds. Only the last 45 seconds since
the latest booking update are eligible. One fix, poor accuracy, an interruption
or fixes from another booking/driver cannot confirm arrival. The driver sends
the acquisition timestamp (`capturedAt`); the backend validates it and stores it
as `recordedAt`. Replayed/out-of-order acquisitions are ignored, and the final
arrival fix must be at most 10 seconds old. Legacy API clients may omit the
timestamp and retain server receipt-time semantics. Pickup must have
explicit GPS/map coordinates or a valid saved route; a text-only address keeps
the manual arrival button rather than trusting an ambiguous geocoder result.
Editing an address invalidates any saved route. No external geocoder is called
for GPS updates. Keep the driver's page open and GPS enabled: a browser cannot
guarantee background location collection when closed or locked.
The conditional transition, history, audit and customer push outbox commit in
one transaction; concurrent manual/GPS confirmations create only one arrival.
Automatic arrival does not start the trip, change the price or confirm payment.
Completion does **not** confirm payment. GPS alerts reuse both existing position endpoints;
no additional GPS transmission or polling connection is introduced. Poor accuracy
or a GPS interruption suppresses movement alerts rather than inventing movement.
Each push is translated into the language last selected on its subscribed device.
Push payloads contain no coordinates, phone numbers, addresses or passenger names.

Setup:

1. Apply additive migration `20261107020000_push_notifications` after testing
   against a restored database backup: `npx prisma migrate deploy`.
2. Generate stable VAPID keys locally with
   `node scripts/setup-push.mjs mailto:contact@example.com`.
   It writes the ignored local environment file without printing private keys or
   duplicating entries. Existing complete keys are preserved.
3. Set `VAPID_PUBLIC_KEY`, **server-only** `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`
   in production's environment settings, using the same stable pair. Only the
   public key is returned by the authenticated subscription API. Restart the app.
4. Configure the two free external schedules below. `vercel.json` deliberately
   declares **no Cron Jobs**: deployment remains on Vercel Hobby, with no paid
   scheduler requirement. No schema migration is required for this scheduling/
   automatic-arrival change.

#### Scheduling audit and free external setup (Vercel Hobby)

The audit found exactly two periodic jobs. Neither detects booking changes or
monitors GPS: those operations run inside the existing authenticated mutations.

| Existing endpoint | Previous Vercel expression | Dependency retained | Free external schedule |
|---|---|---|---|
| `/api/cron/push-notifications` | `* * * * *` (incompatible with Hobby Cron) | Recover interrupted/provider-failed deliveries, drain backlog and delete delivery history expired over 7 days ago | Every minute |
| `/api/cron/driver-location-retention` | `0 2 * * *` | Delete GPS positions older than 30 days when the admin retention switch is enabled | Daily 03:00 Asia/Phnom_Penh / 20:00 UTC the previous day |

Assignments, trip lifecycle, movement throttling and pickup arrival use the
existing PostgreSQL transactions and immediate Next.js `after()` dispatch.
Existing UI synchronization is HTTP polling (fleet/customer positions every
5 seconds, booking lists every 15 seconds while visible), **not** Supabase
Realtime or WebSockets. The application uses Prisma PostgreSQL; that alone does
not provide Supabase Cron. No Supabase account, migration, paid service or
additional real-time connection is introduced.

For production `https://saiway.vercel.app`, create a free
[cron-job.org](https://cron-job.org/) account and configure **two** jobs:

1. Choose timezone **Asia/Phnom_Penh** and method **GET**. Leave the request body
   empty and HTTP Basic Authentication disabled: the custom Bearer header is used.
2. Push recovery URL: `https://saiway.vercel.app/api/cron/push-notifications`,
   every minute (`* * * * *`).
3. GPS cleanup URL: `https://saiway.vercel.app/api/cron/driver-location-retention`,
   daily at **03:00 Asia/Phnom_Penh** (`0 3 * * *` in that timezone).
   If the scheduler is instead set to UTC, use `0 20 * * *`.
4. For **each** job, add the custom header `Authorization` with value
   `Bearer <CRON_SECRET>`, using exactly the server-only secret configured in
   Vercel's **Production** environment. Enter it privately in the dashboard;
   never put it in a URL, source code, screenshot or exported job configuration.
   Generate a new secret if needed with
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`;
   keep the same value in the server and scheduler, and redeploy after changing
   production environment settings.
5. Enable failure/recovery/automatic-disable email alerts. Test without mutation
   first: temporarily append `?dryRun=true` to each URL, then inspect its last
   execution status. This does not send pushes, claim deliveries, remove expired
   push history or delete GPS points. Remove `?dryRun=true` for the scheduled jobs
   after a successful check. A missing/wrong secret returns 401; missing push keys
   or a database/processing failure returns 503, not a false success.
6. Confirm push recovery returns 200 with `configured: true`; GPS cleanup returns
   200 with its deletion count or `skipped: true` when paused. Retain one source
   of schedules only; remove any old/manual duplicate jobs.

The provider documents a free one-minute minimum interval and a 30-second HTTP
timeout ([FAQ](https://cron-job.org/en/faq/)). Push dispatch starts batches of five
within a 15-second processing budget, with a 5-second transport timeout per push;
remaining jobs stay persisted for the next event/tick. Database/network delays
can still cause an external timeout: retries safely reclaim abandoned leases.
Do not treat a timeout as proof that no processing occurred.

No external jobs are created automatically by the app or the admin switch.
`cron.configured` means only that `CRON_SECRET` is present, **not** that an external
schedule is active. Without an external recovery tick, normal event-driven sends
continue, but recovery during inactivity and periodic cleanup are not guaranteed.
External account creation, private header configuration and production execution
must be completed/verified in the operator's dashboard.

Locally, keep the application running and use an OS scheduler calling the same
endpoints on localhost with the same private header; an external scheduler cannot
reach localhost. Do not run local tests against the production database.

After deploying this version, run
`node scripts/check-cron.mjs https://saiway.vercel.app` using the matching
`CRON_SECRET` stored privately in your local environment. It checks missing/wrong
credentials and authenticated **dry runs**, prints no secret, and refuses to send
valid credentials to a deployment that does not advertise dry-run support via
`OPTIONS`. It does not configure cron-job.org or Vercel.
See [the configuration and audit report](docs/cron-job-configuration.md) for the
exact environment table, diagnostics and operational checklist.

Authentication uses **`process.env.CRON_SECRET`**, not `CRON_API_KEY` or
`INTERNAL_API_SECRET`. Configure `CRON_SECRET` in Vercel **Production** and put
the exact same value in both cron-job.org `Authorization: Bearer …` headers.
Changing a Vercel environment variable requires a new deployment. Never copy a
secret into frontend code, logs or this README. `HEAD` verifies authentication
without executing a task; `OPTIONS` advertises safe-check support. Neither
replaces an authenticated `GET ?dryRun=true` check of the database/Push setup.

Subscriptions and per-device deliveries reuse the existing database and User/
DriverProfile relationships. Events are queued within the booking/GPS transaction.
`after()` attempts delivery after the API response, so a provider outage does not
roll back a trip or falsely report a failed booking. The cron retries with backoff,
claims jobs atomically and removes expired history after seven days. Stable
event keys and a per-device unique constraint deduplicate the same event; leases
and due-time checks prevent concurrent scheduler ticks from claiming it twice.
An interrupted lease becomes reclaimable after 60 seconds. Physical exactly-once
delivery cannot be guaranteed if a provider accepted a push immediately before
the server stopped; retries use the same notification tag to replace an existing
notification rather than create a separate card. Provider
404/410 removes the invalid subscription; transient failures retry at most five
times. Status notifications expire after 15 minutes; movement/test notifications
after one minute. Reassigned, cancelled or already-started arrival/assignment
notifications are discarded before sending. Delivery is best-effort: browsers,
offline devices and operating-system settings can prevent
or delay receipt. Queue failures are logged with identifiers/status codes, never
endpoint tokens or encryption keys.

GPS requests trigger a booking-scoped delivery pass so old fleet movement or test
alerts cannot occupy their first batch. Queue passes select up to 100 deliveries,
urgent GPS/assignment/arrival events first, in batches of five within the existing
15-second budget. Urgent messages use Web Push `urgency: high`; the worker requests
a persistent notification where supported. This requests prompt delivery from the
provider; it is not proof of receipt or an override of silent/focus modes.
Pending-request alerts are rechecked before sending and discarded when assigned,
cancelled, or when the driver is no longer available. They do not assign a trip,
give access to its GPS coordinates, or authorize a driver to leave.

The service worker validates a short-lived signed device proof carried inside the
encrypted push against the still-active server subscription and account role,
without requiring a current login cookie. A temporarily expired login therefore
does not suppress the alert; opening its dashboard still requires authentication.
The authorization fetch retries one transient network/server failure (four-second
timeout per attempt) and fails closed if the server cannot confirm the device.
Explicit revocation is never retried. Proofs are bound to one subscription and expire
with the delivery; they are neither logged nor copied into click data.
Legacy payloads still use the authenticated device check.
Logging out removes that
device's server subscription and queued deliveries, then unsubscribes the browser.
Other devices remain subscribed. Permission revoked in system settings may
require re-enabling from the bell. A private key rotation requires resubscribing
devices; do not regenerate keys on every deployment. The bell detects changed
VAPID keys and offers renewal. An existing browser subscription with permission
granted is resynchronised on app return, focus, reconnection or language change;
missing server bindings can be restored without another permission prompt.
Subscription ownership conflicts are not silently reassigned.

App closure or minimisation does not stop server-side delivery or service worker
push reception. Each recipient must first enable notifications on that device.
On iPhone, the installed Home Screen web app requires iOS 16.4 or newer. Offline
devices, OS battery restrictions, focus modes, or a force-stopped browser may
delay/block reception. Configure the authenticated one-minute recovery job above
to retry provider failures even when nobody has the app open; no Vercel Cron or
external scheduler is enabled automatically by this code change.

New existing-API extensions:

- `GET /api/notifications/subscriptions?endpoint=...`: own device state and public
  VAPID key; returns no private keys or another account's subscription.
- `POST /api/notifications/subscriptions`: `{ endpoint, keys: { p256dh, auth },
  language: "en" | "fr" | "km" }`. Authenticated owner only, up to 20 devices,
  HTTPS browser-provider allowlist and encryption-key validation.
- `DELETE /api/notifications/subscriptions`: `{ endpoint }`, only the signed-in
  owner's device is removed.
- `POST /api/notifications/test`: `{ endpoint }`, authenticated own device only.
  HTTP 202 means queued, not proof of OS display; 429 means wait one minute.
- `GET /api/notifications/device?id=...`: service-worker device check, with an
  expiring `Authorization: Bearer <device-proof>` from encrypted push, or the
  existing authenticated owner cookie for legacy workers.
- `GET /api/cron/push-notifications`: `CRON_SECRET` only; retries and retention.
- `POST /api/auth/logout` also accepts optional `{ pushEndpoint }` for device cleanup.

Rollback SQL is provided under `prisma/rollbacks/`; it deliberately discards push
data only and must not be run without a backup and migration-state reconciliation.

Push policy/worker tests run without a database:
`node --test tests/push-policy.test.mjs tests/push-worker.test.mjs`.
For push API tests and the canonical suite, start a server on an **isolated local
validation database** with disposable VAPID keys and
`NODE_OPTIONS="--import=./tests/push-transport-fixture.mjs"` plus
`PUSH_VALIDATION_LOG=/absolute/private/path/push.jsonl`. Pass the same database,
`VALIDATION_URL`, `CRON_SECRET` and log path to `npm test`. This fixture never
contacts a real push service and rejects non-local/non-validation databases;
never load it in normal development or production. It exercises successful,
temporary-failure and expired-subscription delivery through the real API.

### Driver business cards and contact QR images

In **Admin → Fleet & management**, business cards reuse the homepage SAIWAY logo
and display the driver's photo, booking phone number and online booking QR code.
Drivers upload, replace or delete their personal WhatsApp and Telegram QR images
under **My WhatsApp & Telegram QR codes** on their driver dashboard. Administrators
can also upload, replace and delete both QR images using the WhatsApp and Telegram
controls directly below each card. Refresh the admin dashboard after driver uploads.
Cards use a locally rendered Angkor Wat illustration and gold accents; no external
background image request is required.

Uploads accept JPEG, PNG or WebP up to 5 MB. Use the complete QR image with its
white border, not a screenshot containing the rest of the app interface, and
verify the contact in WhatsApp/Telegram before uploading. Images are stored in
the database, accessible only to the owning driver and active administrators;
mutations are audited. Deploy schema changes with `npx prisma migrate deploy`.

**Download PDF · 8 cards / A4** generates one A4 page with eight copies of the
selected driver's 85 × 55 mm card (two columns, four rows), including the logo,
background, photo and QR images. **Download all · A4 PDF** exports the drivers'
cards eight per A4 page, continuing onto further pages as needed. SAIWAY,
WhatsApp and Telegram logos identify their respective QR codes below each code,
without covering QR modules or their white borders.
The company header includes its slogan and “Airport transfers & private transport”
service description. QR images measure 14 × 14 mm; white backgrounds and quiet
zones are preserved for scanning.
Driver photos use a centered cover crop inside their circular frame in both the
browser print view and downloaded PDFs, for portrait and landscape uploads.
Downloads are restricted to administrators and audited.
PDF labels follow the selected English, French or Khmer language, using embedded
Khmer fonts and script-aware text sizing.
JPEG, PNG and WebP uploads are converted for PDF compatibility; invalid images
produce an explicit error rather than an incomplete PDF.

Cards also print at 85 × 55 mm, eight per A4 page. Use 100% print scale, disable browser
headers/footers and enable background graphics. Printing waits
for photos and contact QR images to load and reports a failure rather than
printing incomplete cards.

Saiway uses PostgreSQL through Prisma. Configure `DATABASE_URL` for migrations and
`PRISMA_DATABASE_URL` (or `DATABASE_URL` as a fallback) for the application; both
must point to the same database. Set `AUTH_SECRET` to a private, strong value.
Never commit database credentials or account passwords.

### Environment configuration

Keep local values in the ignored `.env.local` file and configure production
values in the hosting provider's environment settings. Next.js and the Prisma
CLI use the same environment-file precedence: process environment, environment-
specific local file, `.env.local`, environment-specific file, then `.env`.
`NODE_ENV=test` skips `.env.local`; set `NODE_ENV=development` for Prisma CLI
commands that must also load `.env.development.local`. Shell or hosting-provider
variables take precedence over files. Restart the server after changing values.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection for migrations and application fallback. |
| `PRISMA_DATABASE_URL` | Optional application connection, e.g. a pooled URL for the same database. |
| `AUTH_SECRET` | Private session-signing secret; changing it invalidates existing sessions. |
| `NEXT_PUBLIC_APP_URL` | Public site origin, e.g. `http://localhost:3000` locally; set the actual HTTPS origin in production. |
| `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` | Map tile template and required provider attribution. |
| `NEXT_PUBLIC_ROUTING_URL`, `NEXT_PUBLIC_GEOCODING_URL` | OSRM-compatible routing root and Photon-compatible geocoding endpoint. |
| `NEXT_PUBLIC_REVERSE_GEOCODING_URL` | Optional Photon-compatible reverse endpoint. Defaults to the geocoding URL with its trailing `/api` replaced by `/reverse`. |
| `CRON_SECRET` | Private bearer secret for GPS retention and push-delivery retries. Configure the same value in the scheduler. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Stable Web Push key pair and public contact (`mailto:` or HTTPS URL). Keep the private key server-only; generate using `scripts/setup-push.mjs`. |
| `PAYWAY_ENVIRONMENT`, `PAYWAY_MERCHANT_ID`, `PAYWAY_API_KEY`, `PAYWAY_PUBLIC_URL` | Optional PayWay configuration; all four are needed for online checkout. |
| `VALIDATION_URL` | Optional base URL for integration tests; defaults to `http://localhost:3000`. Use an isolated test database. |

The repository's `.env.example` contains placeholders only, with one entry per
supported variable. Real `.env` and `.env.local` files remain ignored.

`NEXT_PUBLIC_` values are exposed to browsers and embedded at build time:
set the correct values **before** building each deployment, never put secrets
in them, and rebuild after changing them. For production use suitable map
providers and a separate production database and secrets. PayWay requires a
public HTTPS callback origin, including when testing it locally; leave its
credentials empty until configured. `DIRECT_URL`, `POSTGRES_URL`,
`PAYMENT_PROVIDER`, and `EMAIL_API_KEY` may exist in older environment files,
but the current application and Prisma configuration do not read them.

Sign in at `/auth` with an existing administrator account to access `/admin`.
Public registration only creates customer accounts; there is no default working
administrator password.

### Separate access areas

| Role | Dashboard | Permitted operations |
|------|-----------|----------------------|
| Administrator | `/admin` | Create customer/driver/admin accounts; manage fleet, fares, contracts, financial records and homepage image; create, edit, assign and cancel trips |
| Driver | `/driver` | Start autonomous trips, read only own assigned/created trips, advance authorized stages and record collection |
| Customer | `/account` | Manage personal details; reserve at `/booking`; read only personal bookings; cancel before the driver accepts |

Roles come from the database and cannot be changed through account editing.
Every protected API verifies the signed cookie **and** the current active database
account. Wrong-role page requests redirect to that role's own dashboard. Public
registration creates customers only. Sign out before switching accounts.
Suspension or a changed database role invalidates an existing session immediately.
Browser storage cannot grant permissions. Booking buttons and links are hidden
for administrators and drivers, including on the help page.

### Persistent operations and history

Administrators and drivers can use **Change my password** on their own dashboard.
`POST /api/account/password` requires an active staff session, the current password,
a different new password (8–128 characters) and matching confirmation. Only the
authenticated account is updated; account IDs and roles cannot be supplied.
The new password uses the same salted scrypt format as login and account creation.
The update and password-free audit entry are transactional; concurrent stale
changes are rejected. Existing sessions remain valid, but the old password no
longer works for subsequent sign-ins. Deploy these files to enable this feature on
Vercel; writes then use the database configured for that deployment.

Customer reservations are written to PostgreSQL and receive a unique reference.
The server supplies the displayed quote and recalculates it on submission using
the automatic transport tariff described below. Existing bookings keep their
stored amounts; published legacy `PricingRule` rows no longer set new customer fares.
Administrators can set an unpaid trip price, assign an active/available driver and an active
vehicle with sufficient seats. Editing the same assignment preserves trip progress;
an ongoing trip cannot be reassigned. Assignment is possible before payment or
payment-method selection; paid and processing fares cannot be changed.

Drivers advance only their own trips through:
`DRIVER_ASSIGNED -> DRIVER_ACCEPTED -> DRIVER_EN_ROUTE -> DRIVER_ARRIVED -> TRIP_STARTED -> TRIP_COMPLETED`.
Invalid/skipped transitions, foreign bookings and concurrent stale updates are rejected.
Trip changes retain status history and audit records. Assignment does not confirm payment.

### Administrator dispatch and shared data

#### Driver availability and automatic assignment

The real driver dashboard has a persisted availability switch and a vehicle
selector. Select an active vehicle to opt into automatic assignments; simply
having an existing `isAvailable` flag is not enough without a selected vehicle.
One vehicle cannot be selected by two active available drivers through this API.
During `DRIVER_EN_ROUTE`, `DRIVER_ARRIVED` or `TRIP_STARTED`, the dashboard displays
**In service**. Availability remains a preference for new assignments: disabling
it does not cancel existing trips or prevent their completion. A driver in
service may receive a future reservation only if the occupied intervals do not
overlap. Vehicle changes are blocked during service.

On `POST /api/bookings`, the backend immediately assigns the nearest eligible
active/available driver and their selected active vehicle, without requiring
administrator confirmation or payment. Capacity and both the driver and
vehicle schedules are checked. Distance is straight-line distance to the saved
pickup, using the latest GPS fix (at most two minutes old, accuracy at most 50 m).
Explicit coordinates, a saved road route or the known SAI airport location are
used; automatic dispatch never geocodes an ambiguous pickup label. Reliable
located candidates precede candidates without usable GPS. If no usable GPS/pickup
is available, the driver available since the earliest time is selected, with
stable creation-time/id tie breakers.

Occupied intervals use the saved route duration, or the tourist package's booked
hours, plus **30 minutes**. A non-tour trip without a route duration uses
**180 minutes plus 30 minutes**; a legacy tourist booking without a snapshot uses
the default eight-hour package plus the margin. Historical bookings need no
destructive backfill. Still-running trips reserve at least the next 30 minutes,
even when their planned end has passed. These are schedule estimates, not
guarantees against traffic delays. Departure is rejected if that driver or
vehicle is already servicing another trip. Autonomous starts and administrator
assignment/rescheduling also check occupied intervals.

If no compatible driver is available at creation, the reservation stays in the
existing unassigned workflow for **manual administrator assignment**. Switching
availability back on or completing a trip does not auto-assign that backlog.
Administrator-created trips preserve explicit manual dispatch.

Assignments, history, audits and notification outbox entries commit together in
serializable database transactions with bounded retries of PostgreSQL
serialization/deadlock conflicts (including Prisma's driver-adapter conflict
shape). Failed transactions do not retain partial assignments or notifications.
Reservation acknowledgement goes to its customer, new-reservation and assignment
alerts to active administrators, and assignment alerts only to the selected
driver. Payment is never confirmed by reservation, assignment or completion.
Device consent and the existing VAPID/retry configuration still apply; no new
Cron or paid service is required.

API:

- `GET /api/driver/availability`: own persisted availability and active vehicle
  options; authenticated active driver only.
- `PATCH /api/driver/availability`: `{ isAvailable: boolean,
  selectedVehicleId: string | null }`; own profile only. Enabling requires an
  active vehicle. Repeating unchanged values is idempotent.
- `GET /api/driver/bookings` also returns `driverAvailability`; the existing
  15-second refresh is reused, without a second availability polling loop.

Deployment: apply additive migration
`20261107030000_driver_availability_dispatch` with `npx prisma migrate deploy`
against the intended database after backup/testing, then deploy the application.
No new environment variable is required. Production migration/deployment must
be performed separately for each target environment.

If trips or fleet positions return a service-unavailable error after updating
the app, check `npx prisma migrate status` and apply pending migrations after
backup. This version requires `DriverProfile.availableSince`,
`DriverProfile.selectedVehicleId` and `Booking.dispatchEndsAt`; generating the
Prisma client alone does not add those columns. Check the database actually used
by the server: `PRISMA_DATABASE_URL` takes precedence over `DATABASE_URL`, while
the migration CLI uses `DATABASE_URL`. Target the same intended database without
printing or committing either connection string. Do not reset the database.

`/admin` opens on the operational dispatch view, with database-backed counters,
search, pickup-date and driver filters, trip maps, and driver workloads. Accounts,
fleet/financial management and password security have separate sections.

Administrators can create and edit requests, validate an unassigned future pending
trip using `PATCH /api/admin/bookings` with `{ id, status: "CONFIRMED" }`, assign
an active/available driver and a suitable active vehicle, or cancel an open trip.
Validation is operational only: it does not create or mark a payment as paid.
Confirming an already validated, assigned, ongoing or closed trip is rejected.
Confirmation, assignment and driver progress retain database history and audits.

Admin and driver views read the same PostgreSQL bookings through role-scoped APIs.
Both refresh every 15 seconds while the document is visible, and on focus/return.
Polling pauses during mutations; failures are shown without replacing data with
invented records. Driver updates appear in admin, and admin assignments appear
in the assigned driver's schedule. Demo driver trips remain page-local and never
contribute to admin counts. New/edit pickup inputs explicitly use Cambodia time,
independently of the administrator's browser timezone.

Trip-list refreshes wait for an in-flight request instead of aborting it on each
15-second poll or focus event. Requests have a 30-second timeout. Authentication,
temporary service, timeout and invalid-response failures are shown separately;
customers can retry loading without resubmitting a saved reservation.

### Automatic transport tariffs

**Admin → Fleet & management → Automatic transport fares** publishes immutable
full-policy versions in the existing `PricingRule.policy` JSON field. Only
administrators may change tariffs. `SystemSetting.transportFarePolicy` remains
the compatibility baseline until the first version is published; its current
value is then preserved as a baseline version. The latest effective active
version is selected; scheduled versions do not change today's tariff. Dates
and time supplements use Cambodia time. Old versions cannot be edited or archived.
Defaults: airport USD 30 per vehicle in either direction (hard maximum USD 30);
city USD 0.65/km with no starting fee and a USD 3.75 minimum; Small Circuit USD 35 per vehicle
including 8 continuous hours, the 35 km Small Circuit, waiting, driver meal and
water. Passenger meals are excluded. Grand Circuit is USD 45. Remote circuit
pricing starts unset and requires an administrator to enter an agreed amount.
Extra tourist service is USD 5 per additional started hour beyond 8 hours;
the greater of booked duration and actual service duration is billed.
Circuit extensions use an agreed higher package, not a distance surcharge.
Drivers confirm a package upgrade at completion; remote upgrades require a
price in the booking's tariff snapshot. There is no automatic geographic
inference of temple circuits from GPS alone.

`GET /api/bookings/quote` now requires `fromAddress`, `toAddress`, `direction`
and `tripType`; optional `tourCircuit=SMALL|GRAND|REMOTE` and `tourHours` select a
tour package. `POST /api/bookings` accepts the same optional tour fields.
New `TripType` values are `CITY_TRANSFER` and `TOURIST_TOUR`. Other non-airport
private/hotel transfers use the city rate; an airport-labelled endpoint or
coordinates within 2 km of SAI airport use the airport tariff. Road kilometres
come from the configured OSRM-compatible provider, calculated server-side.
No straight-line or default-price fallback is used if routing fails. Amounts
are rounded to the nearest cent. Reservation creation recalculates the quote.
`Booking.fareDetails` records the policy, distance source, circuit, start time
and finalization state. Changes to the tariff never rewrite existing snapshots.
Legacy administrator fare/route edits retain their existing semantics; autonomous
routes and original estimates are immutable. Use the justified correction
operation below rather than rewriting the snapshot. Airport fares cannot exceed
USD 30; existing legacy amounts are not rewritten.

From the driver's real activity view, **Start a new trip** opens a mobile-friendly
GPS departure, vehicle and destination form. It reuses the existing single GPS
stream, attempts reverse geocoding and preserves exact coordinates separately
from the address label. GPS permission refusal, timeout, provider/network errors
are shown; manual addresses or `GPS: latitude, longitude` remain usable without
a GPS fix. English/Khmer Photon searches are scoped to a Cambodia bounding box
in this flow (other existing place searches retain their previous scope).
Selecting a remote suggestion retains its coordinates; editing clears them.
OSRM calculates and signs the server-authoritative road route, distance,
duration and tariff snapshot, shown on a map before confirmation. No live
traffic information is supplied. Optional reverse geocoding needs a
Photon-compatible endpoint with browser CORS support; configure
`NEXT_PUBLIC_REVERSE_GEOCODING_URL` when it is not derived from `/api`.

The initial city zone is a 20 km circle around **13.36, 103.85**. Every route
vertex and both endpoints must remain inside an active configured zone; otherwise
the intracity rate is not applied. Airport endpoints take precedence, including
trips outside the circle. Administrators can edit/add/deactivate city circles,
pickup/minimum charges, vehicle, Cambodia-hour (including overnight) and
exceptional supplements. Defaults remain zero supplements/pickup; the city minimum is USD 3.75.
USD is the settlement currency; **KHR is indicative only**, using the
administrator's snapshotted exchange rate. It remains unset until configured.
Each city uses the common published tariff; there is no separate per-city rate.

**Outside-zone trips do not require administrative approval:** the driver must
enter the fare agreed with the passenger and a reason before departure.
They may finish and collect independently; the agreed amount, justification
and receipt are visible to administrators. Drivers cannot override automatic
city/airport fares. A passenger may have no account; name and phone are optional.
An optional customer email must refer to an existing active customer. No fake
customer account is created.

Existing API extensions:

- `POST /api/driver/bookings` with
  `{action:"preview", selection:{vehicleId,fromAddress,toAddress,fromPoint?,toPoint?}}`
  returns `route`, `fareDetails`, nullable `priceCents`, and `token`.
  Points use `{latitude,longitude}`; route coordinates use `[longitude,latitude]`.
  Quotes are account-bound, signed using domain-separated `AUTH_SECRET` HMAC,
  and valid for 10 minutes. Provider failure never produces a guessed route/fare.
- Confirm with `{quoteToken,passengers,customerEmail?,passengerName?,contactPhone?}`.
  Outside-zone confirmations also require `agreedPriceCents` and `priceReason`
  (at least three characters). Price and geometry cannot be supplied by clients.
  Each token carries a unique `startRequestId`: replay returns the same booking,
  even after quote expiry. A concurrent conflict may require retrying the same
  token. Vehicle activity/capacity/category and driver availability are rechecked.
  Changes to tariffs after preview do not invalidate a still-valid signed quote.
- The previous city `POST` body with `vehicleId`, `fromAddress`, `toAddress`,
  `direction`, `tripType=CITY_TRANSFER`, `passengers` and optional customer fields
  remains supported; new clients should use the preview/confirmation workflow.
- `PATCH /api/driver/bookings` completion accepts `observations` (max 2000 chars)
  and optional `finalPoint:{latitude,longitude}`. Start/end server timestamps,
  actual duration, optional final GPS and observations are persisted.
- `PATCH /api/admin/bookings` accepts
  `{id,finalPriceCents,priceReason}` for a justified correction, including on
  completed unpaid trips. Initial estimate/policy/route remain intact; an
  explicit adjustment is included at finalization. Paid/processing amounts
  cannot change and the airport USD 30 ceiling remains enforced.
- `POST /api/admin/management` with `entity:"setting"` and
  `data:{key:"transportFarePolicy",value:<full policy>,effectiveAt?:<ISO date>}`
  creates a version, never rewrites an existing one. GET includes active
  `farePolicy` and the latest 100 `tariffHistory` versions.
- Existing booking GET responses now include nullable `customer`, optional
  passenger details, `originType`, `routeDetails`, `estimatedPriceCents`,
  `pricingStatus`, lifecycle fields and ordered `statusHistory`. Guest trips
  remain accessible only to their own driver and administrators; they are
  not made public. `priceCents` is the current/final amount.

The booking starts at server time with `TRIP_STARTED`, `originType=DRIVER`
and payment at driver; only city-zone trips have `metered=true`. Driver/vehicle
overlaps are rejected in a serializable transaction. The existing single GPS
stream supplies positions; stale fixes are not replayed indefinitely by
heartbeats. Completion calculates
the distance from this driver's recorded trip positions. Samples with missing/
poor accuracy (over 50 m), gaps over 60 seconds, stale start/end or speeds over
160 km/h require an explicit fallback confirmation. Segments below 5 m are
ignored, and movement must exceed the combined reported accuracy since the
last accepted point to reduce stationary jitter without discarding cumulative
slow motion; GPS remains an approximate, non-certified meter.
If incomplete, completion returns `409 GPS_INCOMPLETE_CONFIRM_ROUTE`; retrying
with `confirmEstimatedDistance=true` uses the saved server-computed route distance
(or computes it for older bookings) and
records `CONFIRMED_ROUTE`, explicitly excluding unknown detours.
If GPS coverage is complete but records zero movement on a positively priced
metered trip, completion retains the original road estimate and any justified
price adjustment instead of replacing the fare with zero. The fare snapshot,
trip history and audit record identify this case explicitly. Completion does
not confirm payment: the driver must still record received or unpaid separately.
Positive, complete GPS distance still determines the final city fare, including
an increase when the driver travels farther than the estimated route. The
original estimate remains visible and the receipt uses the final amount.
For an unpaid completed USD trip, including a reservation, selecting ABA in the driver's
payment section displays the existing static ABA QR, final fare and trip
reference. The passenger enters the amount manually; the driver (or account
holder) must verify the transfer in the receiving account before confirming
receipt. Showing or scanning the QR does not record payment.
Tour completion may supply `tourCircuit` to confirm an agreed upgrade.
Final fare and status are saved atomically before the existing driver payment
endpoint collects that amount. Metered trips and tours cannot start online
payment because their final amounts may change. No extra payment API is created.

The additive migration `20261106070000_distance_fares` adds two enum values,
`Booking.metered` (default false) and nullable `Booking.fareDetails` JSON.
It leaves existing bookings unchanged. Apply with `prisma migrate deploy`
after testing against an isolated database. Enum additions do not have a safe
automatic down migration; do not remove them while referenced by bookings.
No new dependencies or environment variables are required.

The additive migration `20261106120000_autonomous_trips` allows nullable
`Booking.customerId`, adds passenger/provenance/idempotency/route/estimate/
pricing-status/start/end/duration/observation/final-GPS fields and indexes, and
adds `PricingRule.policy`. It neither drops records nor resets existing data.
`routeDetails` holds endpoint coordinates, geometry, distance and duration;
`fareDetails` holds pickup/km/supplement/zone/version snapshots. Existing
`BookingStatusHistory`, `AuditLog` and `Payment` preserve trip events, justified
price changes and collections. No parallel API or replacement ledger was added.
Back up and verify on a restored copy before `npx prisma migrate deploy` on a
target environment. There is no destructive automatic rollback: reverting
nullable customer IDs is unsafe while anonymous trips exist, and dropping added
columns would discard history. Prefer a forward fix or a verified backup restore.

In **Admin → Bookings**, the existing auto-refresh (10-second polling) includes
autonomous trips, receipt status, vehicle, distance/duration, original/current
prices, timestamps and origin. Filter by driver, vehicle, date/range, status,
city/zone and origin. Select a trip for its saved route/GPS, fare breakdown,
events/observations and justified correction. Existing payment/financial
sections show driver receipts. There is no new WebSocket infrastructure.

Fare integration tests use the deterministic provider in
`tests/fixtures/fare-provider.mjs` (5 km / 10 minutes for each requested route).
Start it with `node tests/fixtures/fare-provider.mjs`, then build with
`NEXT_PUBLIC_ROUTING_URL=http://127.0.0.1:4369` and
`NEXT_PUBLIC_GEOCODING_URL=http://127.0.0.1:4369/api`; public Next.js settings are
baked into the build, so overriding them only at `next start` is insufficient.
Start the application on `127.0.0.1:4370` with **both** `DATABASE_URL` and
`PRISMA_DATABASE_URL` pointing to the same isolated migrated PostgreSQL database.
`npm test` includes autonomous guest/idempotency/ownership, outside-zone
agreement/collection, scheduled-tariff/correction and tariff-zone/supplement
journeys. The provider is a deterministic contract fixture, not evidence of
live-provider uptime or real-world GPS accuracy; validate production routing
coverage and operational map-provider quotas separately.
Run `VALIDATION_URL=http://127.0.0.1:4370 npm test` with the same database overrides.
Never use the production database for these tests. Stop the fixtures and rebuild
without test provider overrides before running the application normally.
Pure fare tests run separately with `node --test tests/fare-policy.test.mjs`.

Interface translations cover English, French and Khmer, including operational
dashboards, account settings, business cards, installation and legal pages.
Names, user-entered addresses, free-text notes and brands are not automatically
translated. Generated booking-history descriptions are localized at display time;
their stored audit text and passenger observations remain unchanged.
Legal translations retain the original draft notice and require
qualified local review before publication. Shared date/number formatters supply
Khmer output even on browsers without Khmer Intl locale data. Language preference
is restored after hydration to avoid server/client text mismatches.
`node --test tests/translations.test.mjs tests/localized-content.test.mjs` checks
translation coverage and legal/formatting regressions without a database.

### Customer pickup and place suggestions

#### Responsive application layout

Public pages and the customer, driver and administrator dashboards use wrapping
navigation and controls that can shrink within their cards. Booking steps use
two columns on phones and four on wider screens; fleet/GPS forms avoid narrow
five-column layouts on tablets. Installation QR codes scale to the available
width. Push and vehicle-preview dialogs stay within the viewport and scroll on
short screens; fullscreen fleet maps share the available height with the driver
list. Mobile driver progress labels are larger and empty map panels are shorter.
Header actions and dashboard navigation offer 44-pixel-high touch targets.
Tables and business-card previews may scroll horizontally **inside their own
panels**; printable cards retain their exact 85 x 55 mm dimensions.
These changes do not alter fares, permissions, GPS consent or task execution.

The homepage reservation card stacks pickup and destination on small screens
and gives them separate, wider columns on desktop. Date/time have their own row;
GPS controls and coordinate inputs wrap inside the card, including in French
and Khmer. The price button spans the available width on mobile/tablet instead
of forcing a fixed minimum width. These layout changes preserve pickup consent,
place suggestions, map selection, route reversal and navigation to booking.

At `/booking`, pickup and destination are independently editable. Pickup can use
an address, one permission-based current GPS fix, manually entered latitude and
longitude, or a point selected on the Leaflet map. The client reviews the pickup
before submitting; no GPS request is made automatically and no continuous
customer tracking is started. Share uses the device share sheet or copies the
coordinates and an OpenStreetMap link; sharing does not submit a booking.

Exact locations are stored in the existing `fromAddress` / `toAddress` fields as
`GPS: latitude, longitude` (seven decimal places). The booking API validates this
format and coordinate ranges. All shared maps resolve it directly without
geocoding, and navigation links use plain coordinate pairs. Existing address-only
bookings remain unchanged; no database migration is required.

Address suggestions combine the existing place list, Photon-compatible online
search and the signed-in customer's own recent booking addresses.
`GET /api/bookings/places` returns only that customer's distinct pickup and
destination strings from their latest 100 bookings, with `Cache-Control: no-store`;
other roles and anonymous requests are rejected. Suggestions are keyboard
accessible, debounced and cancellable. Text searches go to
`NEXT_PUBLIC_GEOCODING_URL`, biased toward Siem Reap but not restricted to it.
Free-text entry remains available on provider failure; suggestions do not expand
the service coverage or change the existing fare calculation.

### Open-source fleet mapping and live tracking

The existing Next.js API and Prisma/PostgreSQL models power fleet tracking; this
feature does not add a separate backend. Leaflet renders the maps, OpenStreetMap
provides tiles, OSRM calculates routes, and Photon geocodes addresses. Provider
URLs are centralized in `lib/map-client.ts` so compatible tile, routing, and
geocoding services can be substituted without changing the map components.

The administrator dispatch dashboard includes a persistent fleet map, a driver
and status list, hub markers, selectable vehicle markers, and a full-screen view.
Positions refresh every five seconds while the admin page is visible. On-duty
positions older than two minutes remain visible only as dated stale positions;
they are dimmed and excluded from live counts and route estimates. Off-duty
positions are hidden. The list distinguishes waiting for the customer from
heading to pickup and shows the latest completed trip separately from availability.
The driver dashboard's GPS button opens a
full-screen map; the driver sends one GPS stream while on duty, which feeds the
admin map and the authorized customer's booking view. Customers can follow only
their own assigned booking; their map refreshes every four seconds and stops
exposing live location when that booking closes. GPS requires browser permission
and an open driver dashboard. The configured browser map/routing providers
receive coordinates and/or addresses; use self-hosted or appropriately
contracted providers when production privacy or capacity requires it.

Map paths use dark gold (`#D6A000`) to the pickup, orange (`#F58220`) during a
trip, and green (`#2E9D50`) for a return to a hub. Vehicle icon categories and
optional JPEG, PNG, or WebP custom icons are managed under **Admin → Fleet &
management**; administrators can preview the selected icon on a map. The same
vehicle marker is used on admin, driver, and customer maps. The category marker
remains visible until a custom image loads, or if no custom image is available.
Hubs are managed in
the same section and are deactivated rather than deleted.
The principal SAIWAY hub is **Tiara Air Tour & Travel, Taphul Village, Sangkat
Svai DongKom, Siem Reap**, at **13.358859, 103.853188**, from the operator-provided
[map pin](https://maps.app.goo.gl/fmXwg25Kor5XGM8f8). Register it as an active hub
in each intended database; it is configuration data, not automatically recreated
by a schema migration. It remains editable in Fleet & management.
The "add an active hub" and "no drivers" notices appear only after a successful
fleet response, not when loading has failed.

| Endpoint | Access | Purpose |
|----------|--------|---------|
| `GET /api/admin/fleet-locations` | Admin | Active drivers, dated on-duty positions, freshness, status, last completed trip, vehicles, fresh route targets, and hubs |
| `GET, PUT /api/driver/location` | Driver | Read sharing state/hubs; submit the driver's single GPS stream |
| `GET /api/bookings/{id}/location` | Owning customer/driver or admin | Read an authorized booking's live location and active-trip history |
| `/api/admin/management` | Admin | Create/edit/deactivate hubs and set vehicle icon categories |
| `PUT, DELETE /api/admin/vehicles/{id}/icon` | Admin | Upload or remove a vehicle marker image |
| `GET /api/vehicles/{id}/icon` | Admin or user associated with the vehicle's booking | Read a custom marker image |
| `GET /api/cron/driver-location-retention` | Bearer `CRON_SECRET` | Delete GPS points older than 30 days |

The additive Prisma migration
`prisma/migrations/20261106010000_fleet_mapping` adds vehicle icon metadata,
hub records, driver return-to-hub state, GPS heading, and an index for retention
cleanup. It does not delete existing records. Apply it with `npx prisma migrate
deploy` only after review against the deployment database. Set `CRON_SECRET` to a
long random secret. Configure the free external daily authenticated schedule at
03:00 Asia/Phnom_Penh as described above; `vercel.json` contains no scheduled jobs.
Without that external schedule, old GPS records are not automatically purged.

In **Admin → Fleet & management → Scheduled tasks (Cron)**, administrators can
enable or pause GPS retention. The existing `SystemSetting` record
`gpsRetentionEnabled` stores `"true"` or `"false"`; absence preserves the previous
enabled behavior. No schema migration is needed. `POST /api/admin/management`
with `{ "entity": "setting", "data": { "key": "gpsRetentionEnabled", "value": false } }`
pauses cleanup; use the boolean `true` to enable it. Changes are admin-only and
audited. The management response includes `cron.gpsRetentionEnabled` and
`cron.configured` (secret presence only; no secret is returned). An authenticated
scheduled call while paused returns `{ "skipped": true, "reason": "DISABLED",
"removed": 0 }` without deleting positions. The external schedule remains active;
enabling does not run an immediate purge, and an already running cleanup may
finish. Invalid stored settings fail explicitly rather than deleting data.

The vehicle registration form appears above driver documents and business cards
in the same management section. Enter the model/name, unique registration plate,
1–50 passenger seats and vehicle icon category. Vehicles are active on creation
and available through the existing dispatch assignment APIs. Duplicate plates
are rejected; custom map icons can be uploaded after registration.

Configure these optional public map settings in the deployment. The defaults
work for development only; public OSM/OSRM/Photon services do not provide an
unlimited production SLA. `NEXT_PUBLIC_GEOCODING_URL` is the complete Photon API
endpoint; `NEXT_PUBLIC_ROUTING_URL` is the OSRM-compatible root URL, to which
`/route/v1/driving` is appended. `NEXT_PUBLIC_MAP_TILE_URL` uses Leaflet's
`{z}`, `{x}`, and `{y}` placeholders.

```env
NEXT_PUBLIC_MAP_TILE_URL="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
NEXT_PUBLIC_MAP_TILE_ATTRIBUTION='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
NEXT_PUBLIC_ROUTING_URL="https://router.project-osrm.org"
NEXT_PUBLIC_GEOCODING_URL="https://photon.komoot.io/api/"
CRON_SECRET="use-a-long-random-secret"
```

### Customer accounts and ABA PayWay / KHQR

Public registration at `/auth` requires only name, email and an 8-128 character
password. The server always creates a CUSTOMER, signs the session and redirects
to `/account`. The customer dashboard contains only that customer's requests,
upcoming trips, payment actions, history and personal profile. `/booking` saves
a PENDING_PAYMENT request with its server-calculated fare and Cambodia pickup
time, immediately makes it visible to administrators, then links to payment-method
selection in the customer dashboard. The admin may assign it before the customer
chooses how to pay.

Customer sessions use random opaque tokens stored only as SHA-256 hashes in
`CustomerSession`. They do not expire automatically on the server. The HttpOnly,
SameSite=Lax cookie persists across browser restarts and is renewed on visits,
return to a visible tab, and daily while the app is open (400-day browser maximum).
Clearing browser data or browser privacy policies may still require signing in
again. Explicit logout revokes the current token in the database before clearing
the cookie; replaying that token is rejected. Staff retain their seven-day signed
sessions. Existing signed customer sessions migrate on renewal while still valid.
Suspension and role changes are checked on every protected request.

The admin dispatch GET lists all real reservations, including unpaid requests.
The driver API lists only bookings assigned to that driver, regardless of payment.
Neither operational confirmation nor assignment implies that money was received.

Customers choose ONLINE or DRIVER during the booking review, or later through
`POST /api/bookings/payment-method`. Requests without a choice remain UNDECIDED
for backwards compatibility; the choice never creates a payment.
For DRIVER, the customer pays the assigned driver at the end of the trip. After
TRIP_COMPLETED, only that active assigned driver can submit
`POST /api/driver/payments` with
`{ bookingId, received: true, collectionMethod: "CASH" | "CARD" | "ABA" | "OTHER" }`.
The actual method must be explicitly selected; it is not inferred from the booking choice.
The server uses
the stored fare and currency, creates one PAID/DRIVER_DIRECT transaction and
records the actor, amount and payment ID in a DRIVER_PAYMENT_CONFIRMED audit.
The driver must actually receive the full fare before confirming; completing the
trip does not confirm receipt. Repeated/concurrent confirmations cannot create
multiple receipts. The driver UI opens History after completing a real trip.
Paid or processing online payments block method changes and duplicate collection.
Customers and administrators cannot confirm a driver receipt. This is an audited
driver attestation, not an independently verified bank transaction.

The assigned driver may also declare `{ bookingId, received: false }` after
completion: this adds a `DRIVER_PAYMENT_NOT_RECEIVED` audit without creating a
receipt or any revenue. It cannot reverse an already confirmed receipt.
For manual ONLINE QR transfers, collectionMethod ABA is recorded as
PAID/ABA_QR_MANUAL after verification in the receiving bank account. If an ONLINE
customer actually pays by another method, the driver selects that actual method
and records a DRIVER_DIRECT receipt only after checking no prior transfer was
received. UNDECIDED bookings can also be collected after completion with an explicit
method. Any PROCESSING online payment blocks manual confirmation.

Administrator financial management includes a read-only receipt ledger derived
from PAID transactions, with reference, actual method, driver, timestamp and amount.
It includes existing receipts, excludes ABA_PAYWAY_SANDBOX and unpaid/processing
transactions, and groups totals by currency. USD receipts are included once in
actual revenue alongside manual revenue entries, not copied into editable entries.
Do not manually re-enter these receipts. Old driver receipts retain their
unspecified method rather than being retroactively labelled cash. The ledger
shows booking status for cancellation/refund review; refunds require a separate
accounting adjustment and never silently erase a receipt.

PayWay checkout is prepared server-side with HMAC-SHA512 using the stored USD
amount, a 15-minute lifetime and an allowed PayWay hosted KHQR URL. The callback
signature is checked, then the server independently calls Check Transaction.
Only APPROVED (not PRE-AUTH), matching amount/currency/reference and no refund
can record PAID and confirm the booking in one transaction. Repeated callbacks
are idempotent. Late, cancelled or duplicate payments receive a review audit;
cancellation does not automatically refund money. Sandbox payments are labelled
by provider and must use a separate test database/deployment from live payments.

Configure these **server-only** environment variables in your deployment:

```dotenv
PAYWAY_ENVIRONMENT=sandbox
PAYWAY_MERCHANT_ID=your-merchant-id
PAYWAY_API_KEY=your-private-api-key
PAYWAY_PUBLIC_URL=https://your-authorized-domain.example
```

Use a public HTTPS origin, whitelist it with ABA, enable the KHQR checkout option
on the merchant account, and register `/api/payments/payway/callback` as the
callback. Run `npx prisma migrate deploy` on each deployment database before
using checkout. Use `production` with production merchant credentials only
after an ABA sandbox acceptance test. Never prefix these secrets with NEXT_PUBLIC.
Missing configuration returns PAYWAY_NOT_CONFIGURED; no simulated success or
real charge is claimed. No live payment was tested without merchant credentials.
Checkout/verify APIs require the authenticated booking owner, not a supplied
amount or customer ID. Automatic refunds and reconciliation of later refunds
made directly in the merchant portal are not implemented.

Official integration references: [Checkout](https://developer.payway.com.kh/folder-3158159),
[Purchase](https://developer.payway.com.kh/purchase-14530820e0.md),
[Check Transaction](https://developer.payway.com.kh/check-transaction-14530826e0.md).
Run the isolated signing/amount checks with `node --test tests/payway.test.mjs`.

The supplied static ABA QR image is displayed unchanged on future unpaid ONLINE USD
bookings, with the exact fare, a copyable booking reference, original-image link
and download. Customers can scan it or import the downloaded image into their
banking app. This is a direct bank transfer, not a PayWay transaction: displaying,
downloading or scanning it never marks a booking PAID.
The manual QR is hidden while a PayWay payment is processing to reduce the
risk of paying twice; the driver also cannot record a manual receipt then.
The static QR contains bank account data, not a payment URL. Its USD amount must
be entered manually; the image is never rewritten to fabricate a dynamic payment
link. The assigned driver verifies this transfer after the trip, as described
above. Keep the receipt and never pay both the static QR and PayWay for the same
trip. PayWay checkout generates the official exact-amount link and remains a
separate option requiring merchant configuration.

### Driver dashboard and trip maps

`/driver` includes daily trip/passenger totals, booking values by currency, a
searchable schedule, status filters, history, passenger and vehicle details,
and the authorized trip-stage controls. Dates use `Asia/Phnom_Penh` (UTC+7).
Booking values are not driver earnings or confirmation of payment.

The **Demo trips** view provides five fictional trips for the signed-in driver,
including four scheduled transfers and one completed transfer. It opens by
default only after a successful empty booking response. Demo updates are local
to the page, reset on reload, and never create bookings or call the update API.
The **Assigned trips** view always uses the existing authenticated driver API.

Leaflet displays OpenStreetMap tiles, Photon locates real addresses in the
Siem Reap region, and OSRM estimates road routes. External services receive
addresses/coordinates, not passenger names or account details. Routing failures
show only located endpoints, not a fabricated road route. Navigation can also
be opened in Google Maps. These public services require a network connection,
have no availability guarantee, and should be replaced with contracted or
self-hosted services for production volume. Route estimates do not include traffic.

Run the isolated dashboard checks with Node.js 22.18+ using
`node --test tests/driver-dashboard.test.mjs` (no database required).

### Live driver tracking

When the driver taps **Depart** (status *Driver en route*), the driver dashboard
starts sharing the phone's GPS position (`navigator.geolocation.watchPosition`,
high accuracy). Sharing continues through *Arrived* and *Trip started* and stops
automatically once the trip is completed, cancelled or marked no-show; the stored
position is then erased. Only the latest point per trip is kept (no route history).
Positions are sent at most every 5 seconds, sooner when the car moves more than
15 m, and re-sent every 15 seconds while stationary. Demo trips never share.

Customers open **Track My Driver** (`/booking/track`, or the button on a trip in
`/account`). The page polls `GET /api/bookings/{id}/location` every 4 seconds while
visible and shows the driver, the customer's own position (if the browser grants
location permission; it never leaves the device), pickup/destination, the distance
between them and the age of the last update, with a warning after one minute
without news. Before departure it explains that tracking starts when the driver leaves.

`PUT /api/driver/bookings/{id}/location` accepts only the assigned active driver
during the three tracking statuses. `GET /api/bookings/{id}/location` is limited to
the owning customer, the assigned driver and administrators; other accounts get 404.

Browser limits: location requires HTTPS (or localhost) and permission on both phones.
The driver page must stay open in the foreground; the screen is kept awake when the
browser supports the Wake Lock API, but a web app cannot share GPS in the background
or once the phone locks. Polling was chosen over WebSockets/SSE so it works on
serverless hosting without long-lived connections.

### Contacting the passenger

The booking form stores the passenger phone in `Booking.contactPhone` (digits,
spaces, `+ ( ) . -`, max 30 characters). Booking APIs return it, with the
customer's profile phone as a fallback, only to the customer, administrators and
the driver assigned to that booking. In a real trip, **Contact passenger** shows:

- a WhatsApp / Telegram choice, remembered in the driver's browser;
- **Call on WhatsApp/Telegram**, which opens `https://wa.me/<number>` or
  `https://t.me/+<number>`. Those apps open the conversation; the driver then
  taps their call button. Telegram works only if the passenger has Telegram and
  their privacy settings allow being found by phone number;
- **Send SMS**, which opens the phone's own SMS app (`sms:`) with a prefilled
  message. The SMS is sent from the driver's phone plan; SAIWAY uses no SMS
  provider and stores no message;
- the number itself as a `tel:` link for a normal phone call.

Numbers entered with a leading `0` are treated as Cambodian (+855); `00` and `+`
prefixes are kept as international numbers. Demo trips have no contact actions.

### Driving licence and employment contract

On `/driver`, **Driving licence** lets the driver upload or replace one front and
one back photo (JPEG, PNG or WebP, 5 MB maximum). The server checks the file
signature rather than trusting its name or MIME type, and stores the image in
PostgreSQL (`DriverLicenseImage`, one row per side, bytes in `BYTEA`). Each upload
is recorded in the audit log.

Photos are served only by `GET /api/drivers/{driverId}/license/{FRONT|BACK}` to
that driver or an administrator, with `Cache-Control: private, no-store`,
`nosniff` and a restrictive CSP. Each administrator view is audited. Other
drivers, customers and anonymous visitors receive 403.

Administrators set the licence number, category and expiry date in the account
profile (see below). The driver sees them read-only. **Fleet & management** lists
every driver with these details, links to both photos, and marks the file
**Ready for contract** when the number, a future expiry date and both photos are
present. Images live in the main database, so include it in backups and remember
that it stores personal identity data.

### Administrator account profiles

In `/admin` → **Accounts**, **Edit profile** on any row opens the full profile
(administrators only; `GET`/`PATCH /api/admin/accounts/{userId}`):

- **Identity and access** for every role: name, email, phone and status. Accounts
  are never erased: **Suspended** archives the account, blocks sign-in, closes
  customer sessions and keeps bookings, payments and contracts. Changing a
  driver's or administrator's email signs them out. Administrators cannot edit
  their own account here.
- **Customer details** not asked at sign-up: address, nationality, preferred
  language, company/hotel/agency and internal notes.
- **Driver details**: date of birth, nationality, ID card/passport number,
  address, emergency contact, licence number/category/expiry, availability and
  internal notes.
- **Driving licence photos**: view, upload/replace or delete each side
  (`PUT`/`DELETE /api/drivers/{driverId}/license/{FRONT|BACK}`, audited).

Every field has a clear (×) button; an empty field is stored as `NULL`.
Each change is audited with the field names only (not the values).

### Employment contracts (PDF)

The driver profile lists permanent employment contracts (CDI). The lifecycle is
**Draft** (editable, deletable) → **Active** (signed, read-only) → **Terminated**
(end date on or after the start date). Activation is refused (409 with a
`missing` list) until the employer details and the driver's date of birth,
nationality, ID number, address, phone, licence number and a valid licence expiry
are filled in. A driver can have only one active contract at a time. Signed
contracts are never deleted.

**Download PDF** (`GET /api/admin/contracts/{contractId}/pdf`, audited) generates
an A4 bilingual English/Khmer contract on the server with `pdfkit`: parties,
position, duration and probation (max 3 months), working hours (max 48 h/week),
salary, leave (min 18 days), licence obligations, termination, optional
additional terms (printed as entered) and signatures. Drafts carry a DRAFT
watermark. Employer details (name, registration number, address, legal
representative and title) are set once under **Employer details for contracts**
in the same section (`GET`/`PUT /api/admin/employer`, stored in `SystemSetting`).

> ⚠️ The contract wording is a template. Have both languages reviewed by a
> Cambodian labour lawyer and a native Khmer speaker before using it. The Khmer
> version is declared to prevail.

Fonts are bundled in `assets/fonts/` (Noto Sans for Latin, Battambang for Khmer,
both under the SIL Open Font License, see the `OFL-*.txt` files) and traced into
the PDF route by `next.config.ts`. Schema changes are in the migration
`20261023010000_admin_profiles_employment_contracts`
(run `npx prisma migrate deploy`).

Accounts, vehicles and fares are deactivated rather than deleted.
Trips may be cancelled and reversibly archived. Accounting entries, monthly
forecasts and vehicle contracts can be edited or soft-deleted in their respective
finance sections, with version checks and a mandatory audited reason.
Use **Edit records and settings** for accounts, vehicles, fares and homepage
settings; account roles remain immutable, and administrators cannot
suspend themselves. Driver availability and license details are editable.
Use **Edit profile** in the Accounts section for the complete customer and driver files.
Homepage image settings are now shared through the database.

ABA PayWay payment processing requires the merchant configuration above.
In-app driver messaging is not connected (drivers contact passengers through
WhatsApp, Telegram, SMS or phone; see above). Live tracking is described above.
Static marketing content is not a general-purpose CMS.
The service worker caches only local icons and the manifest, never APIs, pages or
authenticated navigation/RSC payloads; protected areas require a server connection.

### Integration checks

With the application running (`npm run dev`) and database variables configured,
run `npm test`. The tests exercise driver creation and login, customer profiles,
fleet, accounting and forecasts against the real application and database.
They also exercise the role/page/API access matrix, booking ownership, dispatch,
driver progression, concurrent updates, fare/contract editing and archival history,
plus driver licence photo storage/access isolation, passenger phone visibility,
administrator profile editing, licence photo management, the employment
contract lifecycle with PDF generation, and live driver location sharing
(permissions, throttling, read isolation and erasure when the trip ends).
They create uniquely named test accounts and records, then remove them in cleanup.
Prefer a dedicated test database and run the application against that same database.
Integration files run sequentially to limit simultaneous remote database connections;
the concurrency-conflict test still submits simultaneous updates within its journey.
Set `VALIDATION_URL` to test a local server on a different port.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
