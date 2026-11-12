"use client";

import { useLanguage } from "@/components/i18n/language-provider";

const copy = {
  fr: {
    title: "SAIWAY — Suppression du compte et des données",
    body: "Vous pouvez demander la suppression de votre compte client ou chauffeur et des données personnelles associées. Dans l’application : Mon compte → Demander la suppression de mon compte. Vous pouvez aussi envoyer votre demande ci-dessous, sans installer l’application.",
    verify: "Indiquez l’email du compte, sans mot de passe ni copie de pièce d’identité. SAIWAY vérifiera votre identité par un échange avec l’adresse du compte avant le traitement.",
    retained: "La demande est traitée par SAIWAY, elle n’efface pas immédiatement le compte. Les données de profil, d’appareil et de session non nécessaires seront supprimées ; les réservations, paiements et pièces professionnelles soumis à une obligation légale, comptable, de sécurité ou de litige peuvent être conservés. SAIWAY vous précisera les données conservées, le motif et la durée applicable lors du traitement.",
    action: "Demander la suppression par email",
    subject: "SAIWAY — Demande de suppression de compte et de données",
    unavailable: "Le contact est momentanément indisponible. Réessayez depuis la page Contact ou depuis votre compte dans l’application.",
  },
  en: {
    title: "SAIWAY — Account and data deletion",
    body: "Request deletion of your customer or driver account and associated personal data. In the app: My account → Request account deletion. You can also send your request below without installing the app.",
    verify: "Include your account email, never your password or identity documents. SAIWAY will verify your identity through your account email before processing.",
    retained: "SAIWAY processes requests manually; submitting does not immediately erase your account. Unneeded profile, device and session data will be removed. Booking, payment or professional records required for legal, accounting, security or dispute purposes may be retained. SAIWAY will explain the retained data, reason and applicable retention period when processing your request.",
    action: "Request deletion by email",
    subject: "SAIWAY — Account and personal data deletion request",
    unavailable: "Contact is temporarily unavailable. Retry from Contact or your account in the app.",
  },
  km: {
    title: "SAIWAY — លុបគណនី និងទិន្នន័យ",
    body: "អ្នកអាចស្នើសុំលុបគណនីអតិថិជន ឬអ្នកបើកបរ និងទិន្នន័យផ្ទាល់ខ្លួនពាក់ព័ន្ធ។ ក្នុងកម្មវិធី៖ គណនីរបស់ខ្ញុំ → ស្នើសុំលុបគណនី។ អ្នកក៏អាចផ្ញើសំណើខាងក្រោមដោយមិនចាំបាច់ដំឡើងកម្មវិធី។",
    verify: "សូមបញ្ជាក់អ៊ីមែលគណនី ប៉ុន្តែមិនត្រូវផ្ញើពាក្យសម្ងាត់ ឬឯកសារអត្តសញ្ញាណទេ។ SAIWAY នឹងផ្ទៀងផ្ទាត់អត្តសញ្ញាណតាមអ៊ីមែលគណនីមុនដំណើរការ។",
    retained: "SAIWAY ដំណើរការសំណើដោយបុគ្គលិក។ ការដាក់សំណើមិនលុបគណនីភ្លាមៗទេ។ ទិន្នន័យប្រវត្តិរូប ឧបករណ៍ និងសម័យចូលប្រើដែលមិនចាំបាច់នឹងត្រូវលុប។ កំណត់ត្រាកក់ បង់ប្រាក់ ឬវិជ្ជាជីវៈដែលច្បាប់ គណនេយ្យ សុវត្ថិភាព ឬវិវាទតម្រូវអាចរក្សាទុក។ SAIWAY នឹងពន្យល់ទិន្នន័យដែលរក្សា មូលហេតុ និងរយៈពេលនៅពេលដំណើរការសំណើ។",
    action: "ស្នើសុំលុបតាមអ៊ីមែល",
    subject: "SAIWAY — Account and personal data deletion request",
    unavailable: "ព័ត៌មានទំនាក់ទំនងមិនអាចប្រើបានបណ្ដោះអាសន្ន។ សូមព្យាយាមពីទំព័រទំនាក់ទំនង ឬគណនីក្នុងកម្មវិធី។",
  },
};
export function AccountDeletionPage({ email }: { email?: string }) {
  const { language } = useLanguage();
  const text = copy[language];
  return <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
    <h1 className="text-3xl font-bold">{text.title}</h1>
    <p>{text.body}</p><p>{text.verify}</p><p>{text.retained}</p>
    {email ? <a className="inline-flex rounded-xl bg-[var(--color-primary)] p-4 text-white"
      href={`mailto:${email}?subject=${encodeURIComponent(text.subject)}`}>{text.action}</a>
      : <p role="alert">{text.unavailable}</p>}
    <p><a className="underline" href="/contact">SAIWAY Contact</a></p>
  </div>;
}
