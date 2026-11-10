import { t } from './i18n.ts';
import { z } from 'zod';

export type AdPlacement = 'HOME' | 'BOOKING' | 'DRIVER';
export const advertisementSchema = z.object({
  id: z.string(), advertiser: z.string(), title: z.string(), description: z.string(),
  targetUrl: z.url().refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  }, t("Lien publicitaire non autorisé.")),
  endsAt: z.iso.datetime({ offset: true }),
  image: z.object({ updatedAt: z.string() }).nullable(),
});
export const advertisementsSchema = z.object({ advertisements: z.array(advertisementSchema) });
export type Advertisement = z.infer<typeof advertisementSchema>;
export const drivingStatuses = ['DRIVER_ACCEPTED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'TRIP_STARTED'];

export function advertisingPlacement(path: string, role?: 'customer' | 'driver'): AdPlacement | null {
  if (path === '/auth' || path === '/trips' && role === 'customer') return 'HOME';
  if (path === '/book' && role === 'customer') return 'BOOKING';
  if (path === '/trips' && role === 'driver') return 'DRIVER';
  return null;
}

export function nextAdvertisement(ads: Advertisement[], now: number) {
  return ads.find(ad => Date.parse(ad.endsAt) > now) ?? null;
}

export function advertisementImagePath(ad: Advertisement) {
  if (!ad.image) throw new Error(t("Cette publicité ne possède pas d’image."));
  return `/api/advertising/${encodeURIComponent(ad.id)}/image?version=${encodeURIComponent(ad.image.updatedAt)}`;
}
