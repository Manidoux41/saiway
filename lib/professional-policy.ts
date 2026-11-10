import { z } from "zod";

export const professionalStatuses = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"] as const;
export const professionalCategories = ["HOTEL", "GUESTHOUSE", "AGENCY", "OTHER"] as const;
export const professionalDetails = z.object({
  companyName: z.string().trim().min(2).max(200),
  category: z.enum(professionalCategories),
  address: z.string().trim().min(3).max(500),
  contactName: z.string().trim().min(1).max(200),
  contactPhone: z.string().trim().min(8).max(30).regex(/^\+?[\d\s().-]+$/).refine(value => {
    const digits = value.replace(/\D/g, "").length;
    return digits >= 8 && digits <= 15;
  }),
}).strict();
export const professionalSchema = professionalDetails.extend({
  id: z.string(), userId: z.string(), status: z.enum(professionalStatuses),
  createdAt: z.string(), updatedAt: z.string(), reviewedAt: z.string().nullable(),
});
export type Professional = z.infer<typeof professionalSchema>;
