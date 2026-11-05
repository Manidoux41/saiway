export type ContactBrand = "SAIWAY" | "WHATSAPP" | "TELEGRAM";

export const contactBrandArt = {
  SAIWAY: { color: "#032ea1", path: "M12 6 A6 6 0 1 0 12 18 A6 6 0 1 0 12 6 Z", phone: "", label: "SAIWAY" },
  WHATSAPP: {
    color: "#25d366",
    path: "M12 3 A8.5 8.5 0 1 1 7 18.5 L3 21 L4.5 16 A8.5 8.5 0 0 1 12 3 Z",
    phone: "M8 7 L10 7 L11 10 L9.5 11 C10.5 13 11.5 14 13.5 14.5 L14.5 13 L17 14 L17 16 C12 19 5 12 8 7 Z",
    label: "WhatsApp",
  },
  TELEGRAM: {
    color: "#229ed9",
    path: "M4 11 L20 5 L17 20 L11 15 L8 18 L8 13 L17 8 L10 14 Z",
    phone: "",
    label: "Telegram",
  },
} as const;
