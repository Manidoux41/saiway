import type { Language } from "./language-provider";

type MobileAppCopy = { title: string; description: string; soon: string };

export const mobileAppCopy: Record<Language, MobileAppCopy> = {
  fr: {
    title: "SAIWAY arrive sur Android et iOS",
    description: "Vos espaces client et chauffeur, bientôt dans votre poche.",
    soon: "Très prochainement disponible",
  },
  en: {
    title: "SAIWAY is coming to Android and iOS",
    description: "Your customer and driver spaces, soon in your pocket.",
    soon: "Coming very soon",
  },
  km: {
    title: "SAIWAY នឹងមានលើ Android និង iOS ឆាប់ៗនេះ",
    description: "មុខងារសម្រាប់អតិថិជន និងអ្នកបើកបរ នឹងមានក្នុងទូរសព្ទរបស់អ្នកឆាប់ៗនេះ។",
    soon: "នឹងមានក្នុងពេលឆាប់ៗនេះ",
  },
};
