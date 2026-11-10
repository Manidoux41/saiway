import { z } from "zod";

export const advertisingPlacements = ["HOME", "BLOG", "BOOKING", "DRIVER"] as const;
export const advertisingStatuses = ["DRAFT", "ACTIVE", "PAUSED", "ENDED"] as const;
export const advertisingUrlSchema = z.url().pipe(z.string().max(2000).refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "Use an HTTPS link without credentials"));
export const advertisingInputSchema = z.object({
  advertiser: z.string().trim().min(1).max(200),
  contactName: z.string().trim().min(1).max(200),
  contactEmail: z.union([z.email().max(254), z.literal("")]).transform((value) => value || null).nullable(),
  contactPhone: z.string().trim().max(50).transform((value) => value || null).nullable(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(500),
  targetUrl: advertisingUrlSchema,
  placements: z.array(z.enum(advertisingPlacements)).min(1).max(4).refine((items) => new Set(items).size === items.length),
  status: z.enum(advertisingStatuses),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  amountCents: z.number().int().min(0).max(100_000_000),
  priority: z.number().int().min(0).max(999),
  notes: z.string().trim().max(4000).nullable(),
  terms: z.string().trim().max(8000).nullable(),
}).strict().refine((value) => Date.parse(value.endsAt) > Date.parse(value.startsAt), { path: ["endsAt"], message: "End date must be after start date" });
export const advertisingContractSchema = advertisingInputSchema.safeExtend({
  id: z.string(), reference: z.string(), currency: z.literal("USD"), createdAt: z.string(), updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  image: z.object({ updatedAt: z.string() }).nullable(),
});
export const publicAdvertisingSchema = z.object({
  id: z.string(), advertiser: z.string(), title: z.string(), description: z.string(), targetUrl: advertisingUrlSchema,
  endsAt: z.string(), image: z.object({ updatedAt: z.string() }).nullable(),
});
export type AdvertisingContract = z.infer<typeof advertisingContractSchema>;
export type AdvertisingInput = z.infer<typeof advertisingInputSchema>;
export type PublicAdvertisement = z.infer<typeof publicAdvertisingSchema>;
export type AdvertisingPlacement = typeof advertisingPlacements[number];
