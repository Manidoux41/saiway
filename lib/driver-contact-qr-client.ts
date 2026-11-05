import { z } from "zod";

export const contactQrChannels = ["WHATSAPP", "TELEGRAM"] as const;
export type ContactQrChannel = (typeof contactQrChannels)[number];
export const contactQrImageSchema = z.object({
  channel: z.enum(contactQrChannels),
  uploadedAt: z.string(),
});
export const contactQrSummarySchema = z.object({
  driver: z.object({ id: z.string(), contactQrImages: z.array(contactQrImageSchema) }),
});

export function contactQrImageUrl(driverId: string, channel: ContactQrChannel, uploadedAt: string) {
  return `/api/drivers/${encodeURIComponent(driverId)}/contact-qr/${channel}?v=${encodeURIComponent(uploadedAt)}`;
}
