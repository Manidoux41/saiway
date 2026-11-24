# SAIWAY — Politique de confidentialité / Privacy policy

Date de rédaction / Prepared: 12 novembre / November 2026.

> **FR — VERSION DE TRAVAIL, NON PRÊTE POUR PUBLICATION.** Le texte est fondé
> sur le code et les renseignements fournis par l'exploitant. Il ne constitue pas
> une validation juridique. Les points bloquants ci-dessous doivent être résolus
> avant de remplacer la politique publique ou de déclarer ce document finalisé.
>
> **EN — WORKING DRAFT, NOT READY FOR PUBLICATION.** Based on repository evidence
> and operator-provided information, not legal certification. Resolve the blockers
> below before replacing the public policy or describing this document as final.

## Points bloquants / Publication blockers

- Dénomination communiquée : **Saway Co Limited**. Confirmer cette orthographe
  distincte de la marque **SAIWAY**, l'immatriculation, l'adresse professionnelle
  complète et l'email public du responsable des données.
- Fournisseurs, régions d'hébergement, transferts internationaux et conditions
  de traitement non confirmés par l'exploitant.
- Durées de conservation des comptes, réservations, paiements, documents
  professionnels, demandes de suppression et sauvegardes non définies.
- L'exploitant autorise les mineurs, sans âge minimal ni dispositif parental
  précisés. Les exigences applicables et le public Google Play restent à déterminer.
- La tâche GPS supprime les points **de plus de 30 jours**, seulement si elle est
  activée et exécutée. Le passage quotidien à 03 h est une fréquence annoncée,
  **pas une suppression de toutes les positions chaque nuit**. Son exécution
  effective en production n'a pas été vérifiée pour ce document.
- Le traitement manuel effectif des suppressions et son délai doivent être
  définis. Enregistrer une résolution dans l'administration n'efface pas les données.

**EN:** Confirm the exact legal name “Saway Co Limited”, registration, full public
address and privacy email; actual processors, regions and international transfers;
retention periods and manual deletion deadlines; minimum account age and child
protection requirements. GPS cleanup only removes records older than 30 days when
enabled and executed. A daily 03:00 run is not overnight deletion of all locations.
Production execution and effective manual erasure are not certified here.

---

## Français

### 1. Responsable et périmètre

SAIWAY est un service d'intermédiation de transport à Siem Reap, au Cambodge.
Selon les informations communiquées, l'exploitant est Saway Co Limited, établi
à Taphul Village, Sangkat Svai Dongkom, Siem Reap City. L'identification juridique
complète et le contact direct restent à confirmer avant publication.

Cette politique couvre le site SAIWAY, l'application Android/iOS et les espaces
client, chauffeur et professionnel. Le contact public est accessible sur
<https://saiway.vercel.app/contact>.

### 2. Données traitées et finalités

- **Compte et sécurité :** nom, email, téléphone lorsqu'il est renseigné,
  identifiant, rôle, statut, mot de passe sous forme de condensat sécurisé et
  sessions. Utilisation : connexion, gestion du compte et contrôle des accès.
- **Réservations :** départ, destination et coordonnées associées, dates,
  passagers, bagages, vol, instructions, références, historique et état du trajet.
  Utilisation : devis, organisation, attribution, suivi et assistance.
- **Informations libres :** instructions et besoins particuliers peuvent contenir
  des renseignements personnels sensibles si l'utilisateur les saisit. Ne fournissez
  que ce qui est nécessaire au transport ; évitez les diagnostics et documents
  médicaux. Les catégories exactes à déclarer doivent tenir compte de ces champs.
- **Localisation :** position demandée pour une prise en charge choisie et,
  pour les chauffeurs, partage GPS explicitement activé au premier plan pour
  exploitation, suivi et compteur. Le suivi chauffeur s'arrête en arrière-plan
  et à la déconnexion ; cela ne supprime pas l'historique déjà enregistré.
- **Chauffeurs et professionnels :** informations de société et contact,
  documents/permis et images choisis, QR de contact/paiement, dépenses et éléments
  de rémunération accessibles selon le rôle. Utilisation : vérification,
  administration professionnelle et comptabilité du service.
- **Paiement :** montant, référence et état des paiements ou remboursements.
  Le parcours en ligne s'ouvre auprès de PayWay ; les données saisies chez ce
  prestataire relèvent aussi de sa politique. Ne pas déduire de cette séparation
  qu'aucune donnée financière ne doit être déclarée dans Google Play.
- **Notifications :** jeton d'appareil, plateforme, langue, identifiant opaque
  de compte/course et informations de livraison. Utilisation : événements de
  réservation, attribution, arrivée et tests demandés.
- **Assistance et suppression :** demandes, vérification, référence et
  traitement administratif. Les utilisateurs ne doivent pas envoyer leur mot
  de passe ni de pièce d'identité par email.
- **Technique :** les services d'hébergement, cartographie et livraison peuvent
  traiter des adresses IP et métadonnées de requêtes. Les journaux effectifs,
  leurs destinataires et leurs durées doivent être confirmés.

### 3. Autorisations et choix

Les permissions de localisation et de notification sont demandées dans le contexte
des fonctions choisies. Les images sont sélectionnées par le sélecteur système ;
il ne s'agit pas d'une autorisation générale d'explorer toute la photothèque.
Les conséquences d'un refus doivent être expliquées pour chaque fonction : les
fonctions GPS ne peuvent pas fonctionner sans localisation autorisée.

Les notifications peuvent être désactivées dans Mon compte ou les réglages
système. Les sessions et inscriptions natives sont stockées dans le stockage
sécurisé de l'appareil. Les cookies web de session et le stockage de préférence
de langue servent au fonctionnement ; l'inventaire des autres traceurs réellement
déployés doit être confirmé avant publication.

### 4. Destinataires et prestataires

Les informations nécessaires sont accessibles aux personnes autorisées : équipe
SAIWAY, chauffeur attribué, client concerné et professionnel habilité selon le
parcours. Elles peuvent également être traitées par les prestataires nécessaires :

- hébergement et base PostgreSQL, avec Vercel/Prisma indiqués par la configuration,
  sous réserve de confirmation des contrats et régions ;
- Expo Push Service puis Google FCM sur Android ou Apple APNs sur iOS ;
- PayWay pour le paiement en ligne ;
- OpenStreetMap pour les tuiles, unpkg pour Leaflet et les services de recherche
  d'adresse/itinéraire réellement configurés.

Les alertes de course ne contiennent ni nom, téléphone, adresse ni coordonnées
GPS ; elles peuvent contenir des identifiants techniques opaques. Les requêtes
cartographiques exposent notamment l'IP et les zones demandées aux fournisseurs.
Les transmissions internationales, garanties et bases légales applicables doivent
être documentées selon les contrats réels ; aucune résidence exclusive au Cambodge
n'est affirmée.

### 5. Publicités et liens externes

L'application propose des offres partenaires ouvertes sur action volontaire.
Cette fonctionnalité n'utilise pas l'identifiant publicitaire Android dans la
configuration examinée. Les partenaires et services externes disposent de leurs
propres politiques ; leurs éventuels traceurs doivent être évalués. L'absence
d'identifiant publicitaire ne signifie pas l'absence de collecte par les sites ouverts.

### 6. Conservation et suppression

| Catégorie | Comportement établi / décision manquante |
|---|---|
| Historique GPS chauffeur | Purge des points de plus de 30 jours si le réglage de rétention et le planificateur sont actifs. Passage annoncé à 03 h ; fuseau prévu par la documentation : Asia/Phnom_Penh. |
| Journaux de livraison push | Suppression des livraisons expirées depuis plus de sept jours, si la tâche s'exécute. Ce délai part de l'expiration, pas de la création. |
| Inscriptions push natives | Retrait sur désactivation/déconnexion authentifiée ou révocation du jeton, sous réserve de réussite des échanges. Des notifications déjà remises au fournisseur peuvent subsister. |
| Compte, réservations, paiements, documents et sauvegardes | Durées et exceptions à définir ; aucune purge automatique générale n'est attestée. |
| Demandes de suppression et audit | Durée à définir. La demande liée disparaît lors d'une suppression physique du compte ; les autres journaux doivent être traités séparément. |

Une demande peut être initiée dans **Mon compte → Demander la suppression de mon
compte**, ou sans application via <https://saiway.vercel.app/account-deletion>.
Elle est traitée manuellement après vérification. La demande n'efface pas
immédiatement le compte ; SAIWAY doit expliquer les données effacées ou conservées,
les motifs applicables et les durées. Aucune durée légale chiffrée non vérifiée
n'est imposée par ce document.

### 7. Droits, sécurité et mineurs

Les utilisateurs peuvent demander l'accès, la correction ou la suppression par
le contact public. Les fondements juridiques, recours et limites de ces droits
dépendent des lois applicables et doivent être validés.

La configuration mobile exige HTTPS en production et utilise un stockage sécurisé
pour les sessions. Ces mesures ne constituent ni une certification ni une garantie
de sécurité absolue de tous les prestataires.

L'exploitant souhaite permettre les comptes de mineurs. L'âge minimal, la capacité
à contracter et les mécanismes de protection ne sont pas encore déterminés.
**Le fait de proposer des transports ne démontre pas une exemption des règles
relatives aux enfants, aux données personnelles ou au consentement parental.**
Cette section doit être complétée et le parcours adapté avant publication.

### 8. Mise à jour

La politique publiée devra indiquer sa date effective, les coordonnées confirmées
et les changements importants. Ce Markdown n'actualise pas automatiquement les
pages du site ni les déclarations Play Console.

---

## English

### 1. Controller and scope

SAIWAY provides transport intermediation in Siem Reap, Cambodia. According to
operator-provided information, the operator is Saway Co Limited, at Taphul Village,
Sangkat Svai Dongkom, Siem Reap City. Full legal identification and a direct
privacy contact must be confirmed before publication.

This notice covers the website and Android/iOS customer, driver and professional
features. Public contact: <https://saiway.vercel.app/contact>.

### 2. Data and purposes

- Account identity, email, optional phone, role/status, password hash and sessions:
  authentication, account management and access control.
- Pickup/destination and coordinates, trip dates, passengers, luggage, flight,
  instructions, references and history: quotes, bookings, assignment, tracking
  and support.
- Free-text instructions and special needs may contain sensitive personal
  information if entered. Provide only transport-relevant details; avoid medical
  diagnoses and documents. These fields must be considered in store declarations.
- Optional pickup location and explicitly enabled foreground driver GPS:
  operations, tracking and metering. Driver sharing stops in the background or
  on sign-out; recorded history is not thereby deleted.
- Driver/professional details, selected licence/document images, contact/payment
  QR codes, expenses and role-restricted remuneration information: verification,
  professional administration and accounting.
- Amounts, payment/refund references and status: payment management. PayWay's
  external payment flow is also subject to its own notice. External processing
  does not automatically remove financial-data disclosure obligations.
- Device push token, platform, language, opaque account/trip identifiers and
  delivery information: booking, assignment, arrival alerts and requested tests.
- Support/deletion requests and processing records: assistance and verified
  manual handling. Never email passwords or identity-document copies.
- IP addresses and request metadata may be processed by hosting, map and delivery
  providers. Actual logging, recipients and retention require confirmation.

### 3. Permissions and choices

Location and notification permissions relate to selected features. Images are
selected through the system picker, not general access to the whole library.
GPS features require location permission. Notifications can be disabled in My
account or system settings. Sessions and push registrations use device secure
storage. Web session cookies and language preferences support operation; other
deployed trackers require an actual inventory.

### 4. Recipients and providers

Necessary data is available to authorized SAIWAY staff, assigned drivers, the
relevant customer and authorized professionals according to the workflow.
Technical services include hosting/PostgreSQL (Vercel/Prisma indicated in the
configuration, contracts and regions unconfirmed), Expo followed by Google FCM
or Apple APNs, PayWay, OpenStreetMap tiles, unpkg for Leaflet and configured
address/routing services.

Trip alerts contain no names, phones, addresses or GPS coordinates, but may
contain opaque technical identifiers. Map providers receive IP addresses and
requested areas. Actual international transfers, safeguards and legal grounds
must be documented; no exclusive Cambodian data residency is claimed.

### 5. Advertising and external links

Partner offers open after user action. The examined configuration does not use
the Android advertising ID for this feature. External partner/payment websites
have their own policies and may use trackers. No advertising ID does not mean
no third-party data collection.

### 6. Retention and deletion

Driver location cleanup removes records older than **30 days** only when enabled
and scheduled. The operator reports a daily 03:00 run; documentation specifies
Asia/Phnom_Penh, but actual production scheduling is not certified here.
Push delivery logs are deleted more than **seven days after expiry** when the
job runs. Native registrations are removed on successful unsubscribe,
authenticated logout or token revocation; already-dispatched notifications may
remain with the delivery service.

Account, booking, payment, document, backup and deletion/audit retention periods
remain undefined. No general automatic account erasure is verified. Physical
account deletion cascades to its linked deletion request, not necessarily every
other record.

Request deletion in **My account → Request account deletion** or at
<https://saiway.vercel.app/account-deletion> without the app. Processing is manual
after verification, not immediate. SAIWAY must explain erasure, any justified
retention and its duration. This draft does not invent statutory retention periods.

### 7. Rights, security and minors

Contact SAIWAY for access, correction and deletion requests. Applicable legal
grounds, remedies and limits require legal validation. Mobile production HTTPS
and device secure storage are safeguards, not independent certification or an
absolute guarantee about every provider.

The operator intends to allow minors to register, but minimum age, contractual
capacity and protective mechanisms remain undefined. **Transport booking is not
proof of an exemption from child privacy, consent or Google Play requirements.**
Resolve this and adapt actual behavior before publication.

### 8. Changes

The published notice must state its effective date and confirmed contact details.
Creating this Markdown does not publish it to the website or update Play Console.

## Sources techniques / Technical evidence

- [GPS cleanup](../app/api/cron/driver-location-retention/route.ts)
- [Scheduler configuration](./cron-job-configuration.md)
- [Push cleanup](../app/api/cron/push-notifications/route.ts)
- [Native push transport](../lib/native-push.ts)
- [Deletion requests](../app/api/account/deletion/route.ts)
- [Mobile configuration](../mobile/app.json)
- [System image picker](../mobile/src/lib/native-files.ts)
