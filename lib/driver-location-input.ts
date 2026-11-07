import { z } from "zod";

export const driverPositionSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().nonnegative().max(100_000).nullable().optional(),
  heading: z.number().finite().min(0).lt(360).nullable().optional(),
  capturedAt: z.iso.datetime({ offset: true }).refine((value) => {
    const age = Date.now() - Date.parse(value);
    return age >= -5_000 && age <= 60_000;
  }, "GPS timestamp must be recent").transform((value) => new Date(Math.min(Date.now(), Date.parse(value)))).optional(),
}).strict();
