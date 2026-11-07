import { z } from "zod";

export const driverAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
  availableSince: z.string(),
  selectedVehicleId: z.string().nullable(),
});
export type DriverAvailabilityState = z.infer<typeof driverAvailabilitySchema>;
