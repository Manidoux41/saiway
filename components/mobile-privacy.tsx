"use client";

import Link from "next/link";
import { useLanguage } from "@/components/i18n/language-provider";

const copy = {
  fr: {
    title: "Confidentialité de l’application SAIWAY",
    paragraphs: [
      "Ce complément décrit les fonctions mobiles Android et iOS. Il complète la politique SAIWAY ; l’identité juridique de l’exploitant et les durées de conservation doivent encore être validées avant publication sur les stores.",
      "Le compte, les coordonnées de contact, les réservations, messages et états de paiement sont traités par l’API SAIWAY pour organiser les trajets. Les chauffeurs peuvent transmettre les documents professionnels et QR de contact qu’ils choisissent. Les sessions et identifiants de notification sont conservés dans le stockage sécurisé de l’appareil.",
      "La position est facultative pour choisir la prise en charge. Pour les chauffeurs, le partage GPS au premier plan est activé explicitement et sert au suivi et au compteur. Il s’arrête quand l’application passe en arrière-plan ou à la déconnexion. Les positions transmises à SAIWAY sont visibles par les personnes autorisées à suivre le trajet.",
      "Les cartes utilisent Leaflet, un CDN et les tuiles OpenStreetMap ; ces fournisseurs reçoivent notamment l’adresse IP et les zones cartographiques demandées. Les services de recherche d’adresse et de calcul d’itinéraire configurés par SAIWAY peuvent traiter les recherches et coordonnées nécessaires au trajet.",
      "Les notifications sont facultatives et désactivables dans Mon compte ou les réglages système. Le jeton d’appareil et des identifiants techniques opaques de compte/course sont transmis au service Expo puis à Google FCM ou Apple APNs. Les alertes ne contiennent ni nom, adresse, téléphone ni coordonnées GPS. Se désinscrire supprime l’enregistrement de notification de cet appareil côté SAIWAY.",
      "Les offres partenaires s’ouvrent uniquement après votre action, sans identifiant publicitaire Android utilisé par cette fonctionnalité. Les sites partenaires et la page de paiement PayWay ouverte dans le navigateur ont leurs propres politiques. Ne transmettez jamais votre mot de passe à un partenaire.",
      "Vous pouvez demander l’accès, la correction ou la suppression des données via le contact SAIWAY. La suppression se demande depuis Mon compte ou la page publique ci-dessous. Le traitement est manuel après vérification ; les exceptions légales et leur durée doivent être précisées par l’exploitant. Les journaux de livraison des notifications sont purgés sept jours après expiration, si la tâche planifiée est active.",
    ],
    policy: "Politique générale", deletion: "Demander la suppression", contact: "Contacter SAIWAY",
  },
  en: {
    title: "SAIWAY mobile app privacy",
    paragraphs: [
      "This supplement describes Android and iOS features and complements SAIWAY's privacy notice. The operator's legal identity and retention periods must still be validated before store publication.",
      "Account details, contact information, bookings, messages and payment status are processed by the SAIWAY API to arrange trips. Drivers may upload their chosen professional documents and contact QR codes. Sessions and notification identifiers are kept in the device's secure storage.",
      "Location is optional when choosing a pickup. Drivers explicitly enable foreground GPS sharing for trip tracking and metering. Sharing stops when the app enters the background or the user signs out. Locations sent to SAIWAY are accessible to people authorized to follow the trip.",
      "Maps use Leaflet, a CDN and OpenStreetMap tiles; these providers receive information including your IP address and requested map areas. Address search and routing services configured by SAIWAY may process searches and coordinates needed for the trip.",
      "Notifications are optional and can be disabled in My account or system settings. The device token and opaque account/trip identifiers are sent to Expo and then Google FCM or Apple APNs. Alerts contain no names, addresses, phone numbers or GPS coordinates. Unsubscribing removes this device's SAIWAY notification registration.",
      "Partner offers open only after your action; this feature does not use the Android advertising ID. Partner websites and the PayWay payment page opened in your browser have their own policies. Never share your password with a partner.",
      "Contact SAIWAY to request data access, correction or deletion. Request deletion from My account or the public page below. Processing is manual after verification; the operator must explain legal exceptions and their duration. Notification delivery logs are purged seven days after expiration if the scheduled task is active.",
    ],
    policy: "General privacy notice", deletion: "Request deletion", contact: "Contact SAIWAY",
  },
  km: {
    title: "ឯកជនភាពកម្មវិធី SAIWAY",
    paragraphs: [
      "ឯកសារបន្ថែមនេះពិពណ៌នាមុខងារ Android និង iOS និងបំពេញគោលការណ៍ឯកជនភាព SAIWAY។ អត្តសញ្ញាណផ្លូវច្បាប់របស់ប្រតិបត្តិករ និងរយៈពេលរក្សាទិន្នន័យត្រូវផ្ទៀងផ្ទាត់មុនផ្សាយក្នុងហាងកម្មវិធី។",
      "API SAIWAY ដំណើរការព័ត៌មានគណនី ទំនាក់ទំនង ការកក់ សារ និងស្ថានភាពបង់ប្រាក់ ដើម្បីរៀបចំដំណើរ។ អ្នកបើកបរអាចផ្ញើឯកសារវិជ្ជាជីវៈ និងកូដ QR ដែលពួកគេជ្រើស។ សម័យចូលប្រើ និងលេខសម្គាល់ការជូនដំណឹងរក្សាក្នុងឃ្លាំងសុវត្ថិភាពឧបករណ៍។",
      "ទីតាំងជាជម្រើសសម្រាប់កន្លែងទទួល។ អ្នកបើកបរបើកការចែករំលែក GPS ពេលកម្មវិធីនៅមុខ សម្រាប់តាមដាន និងគិតថ្លៃ។ វាឈប់ពេលកម្មវិធីនៅផ្ទៃក្រោយ ឬចាកចេញពីគណនី។ មានតែអ្នកមានសិទ្ធិអាចមើលទីតាំងដំណើរ។",
      "ផែនទីប្រើ Leaflet, CDN និងផ្ទាំង OpenStreetMap។ អ្នកផ្ដល់សេវាទាំងនេះទទួលអាសយដ្ឋាន IP និងតំបន់ផែនទីដែលស្នើ។ សេវាស្វែងរកអាសយដ្ឋាន និងគណនាផ្លូវអាចដំណើរការសំណួរស្វែងរក និងកូអរដោនេសម្រាប់ដំណើរ។",
      "ការជូនដំណឹងជាជម្រើស ហើយអាចបិទក្នុងគណនី ឬការកំណត់ប្រព័ន្ធ។ និមិត្តសញ្ញាឧបករណ៍ និងលេខសម្គាល់គណនី/ដំណើរបញ្ជូនទៅ Expo រួច Google FCM ឬ Apple APNs។ ការជូនដំណឹងមិនមានឈ្មោះ អាសយដ្ឋាន ទូរស័ព្ទ ឬទីតាំង GPS ទេ។ ការបិទលុបការចុះឈ្មោះឧបករណ៍នៅ SAIWAY។",
      "ការផ្តល់ជូនដៃគូបើកតែបន្ទាប់ពីអ្នកចុច ហើយមុខងារនេះមិនប្រើលេខសម្គាល់ផ្សាយពាណិជ្ជកម្ម Android ទេ។ គេហទំព័រដៃគូ និងទំព័របង់ប្រាក់ PayWay មានគោលការណ៍ផ្ទាល់ខ្លួន។ កុំចែករំលែកពាក្យសម្ងាត់ជាមួយដៃគូ។",
      "សូមទាក់ទង SAIWAY ដើម្បីចូលមើល កែតម្រូវ ឬលុបទិន្នន័យ។ ស្នើសុំលុបពីគណនី ឬទំព័រសាធារណៈខាងក្រោម។ បុគ្គលិកដំណើរការក្រោយផ្ទៀងផ្ទាត់ ហើយត្រូវពន្យល់ការលើកលែងតាមច្បាប់ និងរយៈពេល។ កំណត់ហេតុជូនដំណឹងលុបប្រាំពីរថ្ងៃក្រោយផុតកំណត់ បើការងារកំណត់ពេលដំណើរការ។",
    ],
    policy: "គោលការណ៍ឯកជនភាពទូទៅ", deletion: "ស្នើសុំលុប", contact: "ទាក់ទង SAIWAY",
  },
};
export function MobilePrivacy({ standalone = false }: { standalone?: boolean }) {
  const { language } = useLanguage();
  const text = copy[language];
  const Heading = standalone ? "h1" : "h2";
  return <section className="space-y-4">
    <Heading className="text-2xl font-bold">{text.title}</Heading>
    {text.paragraphs.map(paragraph => <p key={paragraph} className="leading-7">{paragraph}</p>)}
    <nav className="flex flex-wrap gap-4 underline"><Link href="/privacy">{text.policy}</Link><Link href="/account-deletion">{text.deletion}</Link><Link href="/contact">{text.contact}</Link></nav>
  </section>;
}
