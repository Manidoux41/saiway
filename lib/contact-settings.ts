import { z } from "zod";

export const contactSettingKey = "publicContact";
export const defaultContactEmail = "manfredparbatia@gmail.com";
export const defaultContactDriverName = "Rean Sokun";
export const contactSettingsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()).refine((value) => !/[\r\n]/.test(value)),
  driverId: z.string().trim().min(1).nullable(),
}).strict();
export type ContactSettings = z.infer<typeof contactSettingsSchema>;

export function contactSettings(value?: string | null): ContactSettings | null {
  return value == null ? null : contactSettingsSchema.parse(JSON.parse(value));
}
