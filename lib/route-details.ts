import { z } from "zod";

export const locationPointSchema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).strict();
export const routeDetailsSchema = z.object({
  from: locationPointSchema, to: locationPointSchema,
  distanceMeters: z.number().finite().nonnegative(),
  durationSeconds: z.number().finite().nonnegative(),
  coordinates: z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(2).max(20000),
});
export type SavedRoute = z.infer<typeof routeDetailsSchema>;
