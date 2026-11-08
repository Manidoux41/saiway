import { z } from "zod";
export const payrollSnapshotSchema = z.object({
  employeeName: z.string(), month: z.string(), unpaidTrips: z.number(), undatedTrips: z.number(),
  cutoff: z.string(), contracts: z.array(z.object({ reference: z.string(), employedDays: z.number(), salaryCents: z.number(), proratedCents: z.number() })),
  employer: z.object({ name: z.string().nullable(), registrationNo: z.string().nullable(), address: z.string().nullable(), representative: z.string().nullable() }),
  sources: z.array(z.object({ reference: z.string(), completedAt: z.string(), amountCents: z.number(), payments: z.array(z.object({ id: z.string(), historicalDate: z.boolean() })) })),
});
export const payrollViewSchema = z.object({
  id: z.string(), driverId: z.string(), month: z.string(), status: z.enum(["DRAFT", "FINALIZED", "PAID"]),
  baseSalaryCents: z.number(), eligibleRevenueCents: z.number(), commissionCents: z.number(), bonusCents: z.number(), deductionCents: z.number(), netCents: z.number(), currency: z.literal("USD"),
  adjustmentNotes: z.string().nullable(), scheduledPayAt: z.string(), paidAt: z.string().nullable(), updatedAt: z.string(), snapshot: payrollSnapshotSchema,
});
export const payrollListSchema = z.object({ payrolls: z.array(payrollViewSchema), drivers: z.array(z.object({ id: z.string(), user: z.object({ name: z.string() }) })).optional() });
export type PayrollView = z.infer<typeof payrollViewSchema>;
