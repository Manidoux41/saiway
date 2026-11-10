import { z } from "zod";
import { contactQrImageSchema } from "@/lib/driver-contact-qr-client";
import { farePolicySchema } from "@/lib/fare-policy";
import { contactSettingsSchema } from "@/lib/contact-settings";

export const managementSchema = z.object({
  contact: contactSettingsSchema,
  cron: z.object({ gpsRetentionEnabled: z.boolean(), configured: z.boolean() }),
  farePolicy: farePolicySchema,
  tariffHistory: z.array(z.object({ id: z.string(), effectiveAt: z.string(), createdAt: z.string(), policy: farePolicySchema })).optional(),
  users: z.array(z.object({ id: z.string(), name: z.string(), email: z.string(), phone: z.string().nullable(), role: z.enum(["ADMIN", "DRIVER", "CUSTOMER"]), status: z.enum(["ACTIVE", "SUSPENDED", "INVITED"]), driver: z.object({ id: z.string(), isAvailable: z.boolean(), licenseNo: z.string().nullable(), licenseExpiresAt: z.string().nullable().optional(), licenseImages: z.array(z.object({ side: z.enum(["FRONT", "BACK"]), sizeBytes: z.number(), uploadedAt: z.string() })).optional(), photo: z.object({ uploadedAt: z.string() }).nullable().optional(), contactQrImages: z.array(contactQrImageSchema).optional() }).nullable() })),
  vehicles: z.array(z.object({ id: z.string(), name: z.string(), plate: z.string(), seats: z.number(), active: z.boolean(), iconCategory: z.enum(["TUK_TUK", "PASSAPP", "SEDAN", "SUV", "MINIVAN", "MINIBUS", "VAN", "OTHER"]), iconImage: z.object({ sizeBytes: z.number(), uploadedAt: z.string() }).nullable() })),
  hubs: z.array(z.object({ id: z.string(), name: z.string(), address: z.string().nullable(), latitude: z.number(), longitude: z.number(), active: z.boolean() })),
  entries: z.array(z.object({ id: z.string(), type: z.string(), label: z.string(), amountCents: z.number(), currency: z.string(), paidAt: z.string().nullable(), entryDate: z.string(), category: z.enum(["TRIP", "FUEL", "MAINTENANCE", "SALARY", "OTHER"]), sourceKey: z.string().nullable(), vehicleId: z.string().nullable(), notes: z.string().nullable(), updatedAt: z.string(), deletedAt: z.string().nullable() })),
  receipts: z.array(z.object({ id: z.string(), amountCents: z.number(), currency: z.string(), provider: z.string(), collectionMethod: z.enum(["CASH", "CARD", "ABA", "OTHER"]).nullable(), confirmedAt: z.string().nullable(), updatedAt: z.string(), booking: z.object({ reference: z.string(), status: z.string(), vehicleId: z.string().nullable(), driver: z.object({ user: z.object({ name: z.string() }) }).nullable() }) })),
  forecasts: z.array(z.object({ id: z.string(), month: z.string(), expectedRevenueCents: z.number(), expectedExpenseCents: z.number(), notes: z.string().nullable(), updatedAt: z.string() })),
  contracts: z.array(z.object({ id: z.string(), vehicleId: z.string(), provider: z.string(), monthlyCents: z.number(), status: z.string(), kind: z.enum(["RENTAL", "FINANCING"]), startsAt: z.string(), endsAt: z.string().nullable(), updatedAt: z.string(), vehicle: z.object({ name: z.string(), plate: z.string() }) })),
  pricing: z.array(z.object({ id: z.string(), name: z.string(), amountCents: z.number(), active: z.boolean(), effectiveAt: z.string(), direction: z.string().nullable(), tripType: z.string().nullable() })),
  settings: z.array(z.object({ key: z.string(), value: z.string() })),
});

export type ManagementData = z.infer<typeof managementSchema>;

type AdminErrorKey = "admin.sessionExpired" | "admin.emailExists" | "admin.recordExists" | "admin.invalidAccount" | "admin.invalidRecord" | "admin.requestFailed" | "admin.serverUnavailable" | "admin.invalidResponse" | "finance.conflict";

export class AdminRequestError extends Error {
  constructor(public readonly key: AdminErrorKey) {
    super(key);
  }
}

export function adminErrorKey(error: unknown): AdminErrorKey {
  return error instanceof AdminRequestError ? error.key : "admin.requestFailed";
}

export async function adminRequest(path: string, options?: RequestInit): Promise<unknown> {
  const response = await fetch(path, { ...options, cache: "no-store" });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new AdminRequestError("admin.sessionExpired");
    if (response.status === 409 && path === "/api/admin/users") throw new AdminRequestError("admin.emailExists");
    if (response.status === 409 && path === "/api/admin/management" && options?.method === "POST") throw new AdminRequestError("admin.recordExists");
    if (response.status === 409 && path === "/api/admin/management") throw new AdminRequestError("finance.conflict");
    if (response.status >= 500) throw new AdminRequestError("admin.serverUnavailable");
    throw new AdminRequestError(path === "/api/admin/users" ? "admin.invalidAccount" : "admin.invalidRecord");
  }
  try {
    return await response.json();
  } catch {
    throw new AdminRequestError("admin.invalidResponse");
  }
}
