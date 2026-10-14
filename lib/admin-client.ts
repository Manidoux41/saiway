import { z } from "zod";

export const managementSchema = z.object({
  users: z.array(z.object({ id: z.string(), name: z.string(), email: z.string(), role: z.enum(["ADMIN", "DRIVER", "CUSTOMER"]), status: z.enum(["ACTIVE", "SUSPENDED", "INVITED"]) })),
  vehicles: z.array(z.object({ id: z.string(), name: z.string(), plate: z.string(), seats: z.number(), active: z.boolean() })),
  entries: z.array(z.object({ id: z.string(), type: z.string(), label: z.string(), amountCents: z.number(), paidAt: z.string().nullable() })),
  forecasts: z.array(z.object({ id: z.string(), month: z.string(), expectedRevenueCents: z.number(), expectedExpenseCents: z.number() })),
  contracts: z.array(z.object({ id: z.string(), provider: z.string(), monthlyCents: z.number(), status: z.string(), vehicle: z.object({ name: z.string(), plate: z.string() }) })),
});

export type ManagementData = z.infer<typeof managementSchema>;

type AdminErrorKey = "admin.sessionExpired" | "admin.emailExists" | "admin.invalidAccount" | "admin.invalidRecord" | "admin.requestFailed" | "admin.serverUnavailable" | "admin.invalidResponse";

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
    if (response.status >= 500) throw new AdminRequestError("admin.serverUnavailable");
    throw new AdminRequestError(path === "/api/admin/users" ? "admin.invalidAccount" : "admin.invalidRecord");
  }
  try {
    return await response.json();
  } catch {
    throw new AdminRequestError("admin.invalidResponse");
  }
}
