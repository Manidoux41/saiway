import { z } from "zod";

export const vehicleExpenseSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  vehicleId: z.string(),
  category: z.enum(["FUEL", "MAINTENANCE"]),
  occurredAt: z.string(),
  odometerKm: z.string(),
  liters: z.string().nullable(),
  amountCents: z.number().int().positive(),
  currency: z.enum(["USD", "KHR"]),
  khrPerUsd: z.string().nullable(),
  usdCents: z.number().int().positive(),
  fullTank: z.boolean(),
  notes: z.string().nullable(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  reviewedAt: z.string().nullable(),
  reviewedBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  vehicle: z.object({ id: z.string(), name: z.string(), plate: z.string(), active: z.boolean() }),
  driver: z.object({ id: z.string(), name: z.string() }).nullable(),
});

export const vehicleExpenseResponseSchema = z.object({
  expense: vehicleExpenseSchema,
});

export const driverVehicleExpensesResponseSchema = z.object({
  vehicles: z.array(z.object({ id: z.string(), name: z.string(), plate: z.string(), active: z.boolean() })),
  expenses: z.array(vehicleExpenseSchema),
});

export const adminVehicleExpensesResponseSchema = z.object({
  vehicles: z.array(z.object({ id: z.string(), name: z.string(), plate: z.string(), active: z.boolean() })),
  expenses: z.array(vehicleExpenseSchema),
});

export type VehicleExpenseView = z.infer<typeof vehicleExpenseSchema>;
export type VehicleExpenseVehicle = z.infer<typeof driverVehicleExpensesResponseSchema>["vehicles"][number];
