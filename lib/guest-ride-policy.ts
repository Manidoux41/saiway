import { z } from "zod";

export const guestClosedStatuses = ["CANCELLED", "NO_SHOW", "REFUNDED", "TRIP_COMPLETED"];
export const guestCancellableStatuses = ["DRIVER_ASSIGNMENT_PENDING", "DRIVER_ASSIGNED", "DRIVER_ACCEPTED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED"];
export const guestGpsSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().min(0).max(100),
  capturedAt: z.iso.datetime({ offset: true }),
}).strict();
export function freshGuestGps(capturedAt: string, now = Date.now()) {
  const age = now - Date.parse(capturedAt);
  return age >= -10_000 && age <= 120_000;
}
export const guestRideViewSchema = z.object({
  reference: z.string(), status: z.string(), fromAddress: z.string(), toAddress: z.string().nullable(),
  priceCents: z.number().nullable(), currency: z.string(),
  driverName: z.string().nullable(), vehicle: z.object({ name: z.string(), plate: z.string() }).nullable(),
  location: z.object({ latitude: z.number(), longitude: z.number(), recordedAt: z.string() }).nullable(),
});
export type GuestRideView = z.infer<typeof guestRideViewSchema>;
